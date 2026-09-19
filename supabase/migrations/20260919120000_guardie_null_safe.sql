-- KIREO — tre guardie che con NULL non scattano, e i ruoli che non le chiamano.
--
-- TROVATE il 19/09 cercando la classe che Mario ha nominato dopo la scoperta
-- sui grant: SECURITY DEFINER che SCRIVONO senza consultare `auth.uid()`.
-- Cercandola sono uscite anche queste tre, che `auth.uid()` lo consultano —
-- ma con un confronto che quando il valore è NULL **non scatta**.
--
-- `X <> NULL` non è falso: è NULL. Un `if` su NULL non esegue il ramo. Quindi
-- una guardia scritta come `if mio <> tuo then raise` LASCIA PASSARE
-- esattamente chi non ha un'identità — che è il caso che doveva fermare.
-- È la stessa specie già corretta sei volte in questo progetto (vedi CLAUDE.md,
-- «la terza volta: una proprietà dichiarata guardando l'intenzione»): la
-- riga dice chi può entrare e ne fa entrare uno in più.
--
-- 1. `rispondi_proposta_incontro` — LA PIÙ GRAVE, e non ha bisogno di nessuna
--    stranezza dei permessi. `current_istituzione_id()` è NULL per chiunque non
--    sia un ente: uno studente, un docente, una scuola, un admin. Con la
--    guardia vecchia, **qualunque utente collegato** poteva accettare o
--    rifiutare la proposta di incontro di una scuola al posto dell'ente, e
--    far partire la notifica. SECURITY DEFINER, quindi la RLS non lo ferma.
--
-- 2-3. `registra_evidence` / `registra_evidenze_test` — `v_student is null or
--    v_student <> auth.uid()`. Con un chiamante ANONIMO `auth.uid()` è NULL,
--    quindi la seconda metà vale NULL e l'intera condizione diventa
--    `false or NULL` = NULL: non scatta. Un utente autenticato invece era
--    protetto (il confronto fra due uuid veri funziona), quindi qui il buco
--    era solo verso anon — che però l'esecuzione ce l'ha per costruzione
--    (vedi sotto).
--
-- E IL SECONDO MOTIVO PER CUI QUESTA MIGRAZIONE ESISTE: i default privileges
-- di Supabase concedono EXECUTE ad `anon` e `authenticated` su ogni funzione
-- nuova dello schema `public`. Tutte e tre erano concesse esplicitamente a
-- `authenticated` e **nessuna aveva mai revocato `anon`** — perché nessuno
-- sapeva di doverlo fare: un `grant … to authenticated` si legge come «solo
-- authenticated», e non lo è. Le tre servono a una sessione autenticata
-- (l'ente che risponde, lo studente che finalizza la missione): `anon` non
-- deve poterle chiamare, e da qui in poi lo dice una riga invece di un'assunzione.
--
-- I CORPI qui sotto sono quelli VIVI, estratti dalle loro migrazioni con una
-- sostituzione di una riga sola ciascuno, verificando che la riga da cambiare
-- esistesse davvero (mai una replace ottimista). Niente altro è stato toccato.

-- da 20260727220000_proposte_incontro.sql, con la sola riga della guardia cambiata
create or replace function public.rispondi_proposta_incontro(p_proposta_id uuid, p_accetta boolean, p_risposta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_istituzione_id uuid;
  v_proposta_da uuid;
  v_stato public.proposta_incontro_stato;
begin
  select istituzione_id, proposta_da, stato into v_istituzione_id, v_proposta_da, v_stato
  from public.proposte_incontro where id = p_proposta_id;

  if v_istituzione_id is null then
    raise exception 'proposta_non_trovata';
  end if;
  if v_istituzione_id is distinct from public.current_istituzione_id() then
    raise exception 'non_autorizzato';
  end if;
  if v_stato <> 'inviata' then
    raise exception 'proposta_gia_gestita';
  end if;

  update public.proposte_incontro
  set stato = (case when p_accetta then 'accettata' else 'rifiutata' end)::public.proposta_incontro_stato,
      risposta_ente = p_risposta,
      risposta_il = now()
  where id = p_proposta_id;

  insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
  values (v_proposta_da, 'proposta_incontro_risposta', p_proposta_id);
end;
$$;

-- da 20260818100000_evidence_categoria.sql, con la sola riga della guardia cambiata
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

-- da 20260818100000_evidence_categoria.sql, con la sola riga della guardia cambiata
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

-- ── i ruoli, nominati ───────────────────────────────────────────────────────
-- `from public` non toglierebbe niente ad anon: quel permesso non arriva da
-- PUBLIC ma dai default privileges, che lo concedono al ruolo. Quindi il ruolo
-- si nomina. [verificato sul DB live il 19/09]
revoke all on function public.rispondi_proposta_incontro(uuid, boolean, text) from public, anon;
grant execute on function public.rispondi_proposta_incontro(uuid, boolean, text) to authenticated;

revoke all on function public.registra_evidence(uuid, jsonb) from public, anon;
grant execute on function public.registra_evidence(uuid, jsonb) to authenticated;

revoke all on function public.registra_evidenze_test(uuid, jsonb) from public, anon;
grant execute on function public.registra_evidenze_test(uuid, jsonb) to authenticated;

-- ── cosa NON chiude questa migrazione ──────────────────────────────────────
-- Nello schema `public` ci sono ~88 funzioni eseguibili da `anon`, e per quasi
-- tutte è innocuo: guardano `auth.uid()` e con NULL si chiudono da sole, oppure
-- sono pubbliche di proposito (`check_class_code` e `verifica_attestato`
-- servono PRIMA del login, `conteggio_follower` è solo un numero). Una revoca
-- di massa romperebbe quelle, quindi non si fa.
--
-- La classe da sorvegliare resta la stessa che ha prodotto queste tre, e da
-- oggi la guarda `npm run test:guardie`: una SECURITY DEFINER che SCRIVE e la
-- cui autorizzazione poggia su un confronto che con NULL non scatta. Il test
-- pretende `is distinct from` su quei confronti, e nomina il file quando non
-- lo trova.
