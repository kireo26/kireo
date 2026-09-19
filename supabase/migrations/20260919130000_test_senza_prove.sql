-- KIREO — un test che non produce nessuna prova non è un test completato.
--
-- IL CASO, trovato il 19/09 dal robot del banco. Le quattordici risposte di T1
-- erano salvate in una forma che la route non sa leggere, quindi lo scoring ha
-- calcolato ZERO prove. La route ha chiamato questa funzione con un array
-- vuoto, questa funzione non ha trovato niente da fare, e in fondo ha marcato
-- il tentativo `completata`. Nessun errore da nessuna parte: `area_signal` è
-- rimasta vuota, e il primo ad accorgersene è stato T3 — due test più tardi —
-- dicendo che le aree candidate erano meno di tre.
--
-- È LA SPECIE DEL FEEDBACK FINALE DEL 18/09: un lavoro che non c'è, dichiarato
-- riuscito. Lì il guasto era del robot e la riparazione è stata dare un nome a
-- ciò che si era arreso; qui tocca gli studenti veri, e il profilo che resta
-- vuoto è il profilo su cui si regge tutto quello che il prodotto dirà di loro.
--
-- COSA CAMBIA, e nient'altro: due `if` in testa alla funzione, prima del
-- delete. Il corpo qui sotto è quello VIVO (da 20260919120000, che a sua volta
-- veniva da 20260818100000) con quelle righe aggiunte e nessun altro tocco.
-- Nessun grant, nessuna colonna, nessun dato trasformato.
--
-- IL NOME DELL'ECCEZIONE È INTERCETTABILE, come `fase_non_aperta` o
-- `troppe_conversazioni_oggi`: la route non ci arriva mai (si ferma prima e
-- registra il guasto), ma un chiamante futuro deve poter distinguere «non
-- c'era niente da salvare» da «il salvataggio si è rotto».
--
-- QUELLO CHE QUESTA MIGRAZIONE NON FA, ed è una decisione da prendere, non una
-- dimenticanza: la gemella `registra_evidence` (missioni Escape) ha lo stesso
-- buco — un array vuoto marca il tentativo `completata` e cancella le prove
-- che c'erano. Non è toccata qui perché la proprietà l'abbiamo formulata sui
-- test, e perché lì una traccia già esiste (`mission_attempt.revisore_esito`
-- registra i fallimenti del revisore, e la route scrive un guasto): il profilo
-- vuoto di una missione non è invisibile come quello di un test. Se si decide
-- che vale anche là, sono le stesse quattro righe.

create or replace function public.registra_evidenze_test(p_attempt_id uuid, p_evidenze jsonb)
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
  select student_id into v_student from public.test_attempt where id = p_attempt_id;
  if v_student is null or v_student is distinct from auth.uid() then
    raise exception 'non_autorizzato';
  end if;

  -- UN TEST CHE NON PRODUCE NESSUNA PROVA NON È UN TEST COMPLETATO.
  --
  -- Fino al 19/09 questa funzione accettava un array vuoto: non cancellava
  -- niente, non inseriva niente, non ricalcolava niente — e in fondo marcava
  -- comunque il tentativo `completata`. Il profilo restava vuoto e il primo ad
  -- accorgersene era T3, due test più tardi, dicendo che le aree candidate
  -- erano meno di tre. Un test che non ha prodotto niente si chiudeva
  -- dichiarando di essere andato bene: la specie del feedback finale del 18/09.
  --
  -- PERCHÉ ANCHE QUI, e non solo nella route che chiama. Primo: questa
  -- funzione è l'unico posto che scrive `stato='completata'` su un tentativo,
  -- quindi è il livello a cui l'invariante si tiene per QUALUNQUE chiamante —
  -- e `authenticated` l'esecuzione ce l'ha. Secondo, ed è il caso peggiore: la
  -- funzione CANCELLA le prove esistenti prima di reinserirle, quindi una
  -- seconda finalizzazione con l'array vuoto non lasciava il profilo com'era,
  -- glielo svuotava. La guardia sta prima del delete, non dopo.
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
    select area_slug as a from public.evidence where test_attempt_id = p_attempt_id and area_slug is not null
    union
    select nullif(e->>'area_slug','') as a from jsonb_array_elements(p_evidenze) e where nullif(e->>'area_slug','') is not null
  ) t;

  select array_agg(distinct a::public.escape_asse) into v_assi from (
    select asse::text as a from public.evidence where test_attempt_id = p_attempt_id and asse is not null
    union
    select nullif(e->>'asse','') as a from jsonb_array_elements(p_evidenze) e where nullif(e->>'asse','') is not null
  ) t;

  delete from public.evidence where test_attempt_id = p_attempt_id;

  insert into public.evidence
    (student_id, test_attempt_id, area_slug, asse, categoria, dimensione, valore, peso, fonte, step_id, motivazione)
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
    'test'::public.escape_fonte,
    e->>'item_id',
    e->>'motivazione'
  from jsonb_array_elements(p_evidenze) as e;

  foreach v_area in array coalesce(v_aree, '{}') loop
    perform public.ricalcola_area_signal(v_student, v_area);
  end loop;
  foreach v_asse in array coalesce(v_assi, '{}') loop
    perform public.ricalcola_style_signal(v_student, v_asse);
  end loop;

  update public.test_attempt
  set stato = 'completata', completed_at = coalesce(completed_at, now()), updated_at = now()
  where id = p_attempt_id and stato <> 'completata';
end;
$$;