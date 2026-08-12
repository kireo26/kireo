-- KIREO — Test attitudinali, Fase 2. Scrittura delle prove di STILE.
--
-- Aggiorna le due funzioni di scrittura del profilo (registra_evidence per le
-- missioni, registra_evidenze_test per i test) perché sappiano scrivere anche la
-- colonna `evidence.asse` e ricalcolare `style_signal` per gli assi toccati,
-- oltre ad `area_signal` per le aree. Nessun cambio di firma: CREATE OR REPLACE
-- sulle funzioni esistenti. Da applicare DOPO 20260813100000_style_signal.sql
-- (che crea l'enum escape_asse, la colonna e la tabella).

-- ============ registra_evidence (missioni) ============
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

  -- aree toccate (presenti per questo attempt UNITE al nuovo lotto)
  select array_agg(distinct a) into v_aree from (
    select area_slug as a from public.evidence where attempt_id = p_attempt_id and area_slug is not null
    union
    select nullif(e->>'area_slug','') as a from jsonb_array_elements(p_evidenze) e where nullif(e->>'area_slug','') is not null
  ) t;

  -- assi toccati (idem)
  select array_agg(distinct a::public.escape_asse) into v_assi from (
    select asse::text as a from public.evidence where attempt_id = p_attempt_id and asse is not null
    union
    select nullif(e->>'asse','') as a from jsonb_array_elements(p_evidenze) e where nullif(e->>'asse','') is not null
  ) t;

  delete from public.evidence where attempt_id = p_attempt_id;

  insert into public.evidence
    (student_id, attempt_id, area_slug, asse, dimensione, valore, peso, fonte, step_id, motivazione)
  select
    v_student, p_attempt_id,
    nullif(e->>'area_slug',''),
    nullif(e->>'asse','')::public.escape_asse,
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

-- ============ registra_evidenze_test (test) ============
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
    (student_id, test_attempt_id, area_slug, asse, dimensione, valore, peso, fonte, step_id, motivazione)
  select
    v_student, p_attempt_id,
    nullif(e->>'area_slug',''),
    nullif(e->>'asse','')::public.escape_asse,
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
