-- KIREO — la gemella delle missioni: stessa guardia, regola diversa attorno.
--
-- DA DOVE VIENE. La 20260919130000 ha chiuso su `registra_evidenze_test` il
-- caso trovato dal robot: un test che non produce nessuna prova si chiudeva
-- dichiarando di essere andato bene, e la seconda finalizzazione a vuoto
-- cancellava le prove che c'erano. `registra_evidence` (missioni Escape) aveva
-- lo stesso buco, e non era stato toccato perché la proprietà era stata
-- formulata sui test. Qui viene esteso, in due pezzi che NON sono la stessa
-- cosa — la distinzione è di Mario ed è scritta dentro la funzione, accanto
-- alla guardia, perché è lì che serve a chi legge.
--
--   · la PROTEZIONE DAL DELETE si estende senza altre condizioni: «non
--     cancellare quello che c'è quando non c'è niente da mettere al suo posto»
--     è identica sui due lati;
--   · il RIFIUTO DI COMPLETARE si estende anche lui, ma **senza nessun
--     ritentativo automatico**. Rifinalizzare un test non costa niente;
--     rifinalizzare una missione costa fino a tre chiamate AI. Un tentativo
--     che resta aperto lo riapre una persona.
--
-- COSA CAMBIA, e nient'altro: due `if` in testa alla funzione, prima del
-- delete. Il corpo qui sotto è quello VIVO (da 20260919120000, che a sua volta
-- veniva da 20260818100000) con quelle righe aggiunte e nessun altro tocco.
-- Nessun grant, nessuna colonna, nessun dato trasformato.
--
-- LE PROVE SONO GIÀ STATE PAGATE quando questa guardia scatta: le chiamate AI
-- avvengono nello scoring, prima della persistenza. La guardia non fa
-- risparmiare quel giro — impedisce il danno (il profilo svuotato, il
-- tentativo chiuso a vuoto) e lascia una riga in `guasti` che dice che quelle
-- chiamate sono state spese per niente.

create or replace function public.registra_evidence(p_attempt_id uuid, p_evidenze jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_aree text[];
  v_assi public.escape_asse[];
  v_area text;
  v_asse public.escape_asse;
begin
  select student_id into v_student from public.mission_attempt where id = p_attempt_id;
  if v_student is null or v_student is distinct from auth.uid() then
    raise exception 'non_autorizzato';
  end if;

  -- DUE DECISIONI, non una, e vanno tenute distinte perché la seconda porta
  -- con sé una regola che la prima non ha.
  --
  -- 1 · NON CANCELLARE QUELLO CHE C'È QUANDO NON C'È NIENTE DA METTERE AL SUO
  --     POSTO. Qui sotto c'è un `delete from evidence where attempt_id = …`
  --     seguito da un insert: con un array vuoto il delete passava e l'insert
  --     non metteva niente, quindi una seconda finalizzazione a vuoto non
  --     lasciava il profilo com'era — glielo SVUOTAVA. È identica sui due lati
  --     (test e missioni) e non ha controindicazioni.
  --
  -- 2 · UN TENTATIVO CHE NON HA PRODOTTO NIENTE NON SI COMPLETA. In fondo alla
  --     funzione c'è `update mission_attempt set stato='completata'`: senza
  --     questa guardia una missione senza prove si chiudeva dichiarando di
  --     essere andata bene, e il profilo restava vuoto senza che niente lo
  --     dicesse.
  --
  --     MA QUI, A DIFFERENZA DEI TEST, NON CI VA NESSUN RITENTATIVO
  --     AUTOMATICO — ed è la differenza fra le due che si dimentica per prima.
  --     Rifinalizzare un test non costa niente: lo scoring è deterministico.
  --     Rifinalizzare una missione costa fino a TRE chiamate AI, perché gli
  --     step aperti vengono ricalcolati da capo. Quindi un tentativo che resta
  --     aperto lo riapre una persona, non un retry: né il client, né un cron,
  --     né una riga di codice che «riprova fra poco». La route che chiama
  --     (app/api/escape/finalizza) non invita a riprovare, e quella scelta di
  --     testo è parte della regola, non una rifinitura.
  --
  -- NULL-SAFE PER COSTRUZIONE, in due `if` invece che in uno: `p_evidenze is
  -- null or jsonb_array_length(p_evidenze) = 0` in un'unica condizione
  -- dipenderebbe dal corto circuito, e su un jsonb che non è un array
  -- `jsonb_array_length` solleva un errore diverso. Prima la forma, poi la
  -- lunghezza.
  if p_evidenze is null or jsonb_typeof(p_evidenze) is distinct from 'array' then
    raise exception 'nessuna_prova';
  end if;
  if jsonb_array_length(p_evidenze) = 0 then
    raise exception 'nessuna_prova';
  end if;

  select array_agg(distinct a) into v_aree from (
    select area_slug as a from public.evidence where attempt_id = p_attempt_id and area_slug is not null
    union
    select nullif(e->>'area_slug','') as a from jsonb_array_elements(p_evidenze) e where nullif(e->>'area_slug','') is not null
  ) t;

  select array_agg(distinct a::public.escape_asse) into v_assi from (
    select asse::text as a from public.evidence where attempt_id = p_attempt_id and asse is not null
    union
    select nullif(e->>'asse','') as a from jsonb_array_elements(p_evidenze) e where nullif(e->>'asse','') is not null
  ) t;

  delete from public.evidence where attempt_id = p_attempt_id;

  insert into public.evidence
    (student_id, attempt_id, area_slug, asse, categoria, dimensione, valore, peso, fonte, step_id, motivazione)
  select
    v_student, p_attempt_id,
    nullif(e->>'area_slug',''),
    nullif(e->>'asse','')::public.escape_asse,
    coalesce(
      nullif(e->>'categoria','')::public.evidence_categoria,
      -- Nessun ramo else: derivo 'area'/'stile' dalle colonne (per i test, che
      -- non mandano il campo), ma una riga area+asse NULL senza categoria
      -- dichiarata resta NULL → l'INSERT fallisce sul vincolo not null. Fallire
      -- rumorosamente è voluto: significa che qualcuno ha aggiunto un'emissione
      -- senza dichiararne la natura, ed è il momento in cui vogliamo saperlo.
      case
        when nullif(e->>'area_slug','') is not null then 'area'::public.evidence_categoria
        when nullif(e->>'asse','') is not null then 'stile'::public.evidence_categoria
      end
    ),
    (e->>'dimensione')::public.escape_dimensione,
    (e->>'valore')::numeric,
    (e->>'peso')::numeric,
    'mission'::public.escape_fonte,
    e->>'step_id',
    e->>'motivazione'
  from jsonb_array_elements(p_evidenze) as e;

  foreach v_area in array coalesce(v_aree, '{}') loop
    perform public.ricalcola_area_signal(v_student, v_area);
  end loop;
  foreach v_asse in array coalesce(v_assi, '{}') loop
    perform public.ricalcola_style_signal(v_student, v_asse);
  end loop;

  update public.mission_attempt
  set stato = 'completata', completed_at = coalesce(completed_at, now()), stanza_corrente = 5, updated_at = now()
  where id = p_attempt_id and stato <> 'completata';
end;
$$;