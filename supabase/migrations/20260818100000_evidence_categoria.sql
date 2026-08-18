-- KIREO Escape — Fix B (parte 2/2): categoria dichiarata su ogni prova.
--
-- Ogni riga di `evidence` deve avere una categoria dichiarata e un consumatore
-- dichiarato: una riga che non sappiamo nominare finisce consumata per sbaglio
-- (è successo con esplora_libero, pescato da `.is("asse", null)` nell'esito).
--   - 'area'             → alimenta area_signal. area_slug valorizzato.
--   - 'stile'            → alimenta style_signal. asse valorizzato.
--   - 'qualita_missione' → qualità del ragionamento SENZA area (performance/
--                          self_efficacy la cui area non deriva da una scelta, o
--                          con motivazione identica su più aree). area+asse null.
--                          NON alimenta area_signal né style_signal.
--   - 'esplorazione'     → «come hai esplorato» (esplora_libero). area+asse null.
--
-- Questa migrazione è la parte 2 del Fix B: la parte 1 (logica in scoring.ts)
-- è già in main. NON applicare la 1 in produzione senza questa: senza la colonna,
-- l'esito pesca le righe qualita_missione in «Perché lo diciamo».

-- ============ enum ============
create type public.evidence_categoria as enum ('area', 'stile', 'qualita_missione', 'esplorazione');

-- ============ colonna (nullable → backfill → not null) ============
alter table public.evidence add column categoria public.evidence_categoria;

-- Backfill deterministico delle righe esistenti (pre-Fix-B):
--   area_slug valorizzato → 'area'; asse valorizzato → 'stile';
--   area+asse entrambi null → 'esplorazione'. Assunzione verificata: prima del
--   Fix B l'UNICO emettitore di righe area+asse null era esplora_libero
--   (tutte le performance/self_efficacy avevano un'area). Le righe
--   qualita_missione non esistono ancora in DB (le produce solo la parte 1).
--   VERIFICATO sul DB reale (18/08): 0 righe con area_slug E asse entrambi
--   valorizzati; l'unica riga area+asse null è s1_materiali/curiosity
--   (esplora_libero). L'assunzione del backfill regge su dati reali.
update public.evidence
set categoria = case
  when area_slug is not null then 'area'::public.evidence_categoria
  when asse is not null then 'stile'::public.evidence_categoria
  else 'esplorazione'::public.evidence_categoria
end
where categoria is null;

alter table public.evidence alter column categoria set not null;

-- ============ registra_evidence (missioni) — aggiunge categoria all'INSERT ============
-- Unico cambiamento vs 20260813110000: la colonna `categoria` nell'INSERT, letta
-- dal JSON (scoring.ts la manda su ogni riga) con fallback derivato dalle colonne
-- per robustezza. La logica di ricalcolo (v_aree/v_assi) è INVARIATA: le righe
-- qualita_missione/esplorazione hanno area+asse null → escluse da entrambi i
-- ricalcoli, per costruzione, senza codice dedicato.
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
  if v_student is null or v_student <> auth.uid() then
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

grant execute on function public.registra_evidence(uuid, jsonb) to authenticated;

-- ============ registra_evidenze_test (test) — aggiunge categoria all'INSERT ============
-- I test (lib/test/scoring.ts) NON mandano `categoria`: la deriva dalle colonne
-- (le prove di test sono solo 'area'/'stile'). Una prova test area+asse null non
-- esiste, quindi la derivazione le copre tutte senza mai cadere nel NULL.
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
  if v_student is null or v_student <> auth.uid() then
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

grant execute on function public.registra_evidenze_test(uuid, jsonb) to authenticated;

-- ============ migrazione inversa (NON eseguita — scritta adesso, non alle 23) ============
-- Sul database non esiste `git revert`. Se serve tornare indietro, in QUEST'ORDINE:
--   1. ripristinare le due funzioni alla versione senza `categoria`: ri-eseguire
--      per intero 20260813110000_evidence_scrittura_assi.sql (le sue CREATE OR
--      REPLACE non referenziano evidence_categoria → sganciano la dipendenza dal type);
--   2. alter table public.evidence drop column categoria;
--   3. drop type public.evidence_categoria;
-- L'ordine conta: il type non si può droppare finché le funzioni (passo 1) o la
-- colonna (passo 2) lo referenziano ancora.
