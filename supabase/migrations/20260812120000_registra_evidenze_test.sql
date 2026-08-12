-- KIREO — Test attitudinali, Fase 1. Migrazione C: la funzione di scrittura.
--
-- registra_evidenze_test: gemella di registra_evidence, ma keyed su
-- test_attempt_id. Riceve le prove calcolate lato server (route /api/test/
-- finalizza: scoring deterministico dal config, dalle risposte AUTOREVOLI in
-- test_response) e le persiste con fonte='test', poi ricomputa area_signal per
-- le aree toccate. Idempotente: cancella e reinserisce le prove di QUESTO
-- tentativo (le prove mission/workshop/activity non si toccano). Ownership
-- verificata (student_id = auth.uid()).
--
-- Nota threat-model: identica a registra_evidence. Il caso peggiore resta uno
-- studente che gioca il PROPRIO profilo (autolesivo per l'orientamento): gate
-- formativo, non confine di sicurezza. Il peso basso delle prove di test (0.35)
-- fa sì che le missioni successive correggano comunque un test compilato
-- strategicamente. Non può toccare il profilo di altri (auth.uid()).
create or replace function public.registra_evidenze_test(p_attempt_id uuid, p_evidenze jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_aree text[];
  v_area text;
begin
  select student_id into v_student from public.test_attempt where id = p_attempt_id;
  if v_student is null or v_student <> auth.uid() then
    raise exception 'non_autorizzato';
  end if;

  -- aree da ricalcolare = quelle già presenti per questo tentativo UNITE a
  -- quelle nel nuovo lotto (così un'area rimossa in un ri-invio perde il suo
  -- contributo al profilo).
  select array_agg(distinct a) into v_aree from (
    select area_slug as a from public.evidence
      where test_attempt_id = p_attempt_id and area_slug is not null
    union
    select nullif(e->>'area_slug','') as a from jsonb_array_elements(p_evidenze) e
      where nullif(e->>'area_slug','') is not null
  ) t;

  delete from public.evidence where test_attempt_id = p_attempt_id;

  insert into public.evidence
    (student_id, test_attempt_id, area_slug, dimensione, valore, peso, fonte, step_id, motivazione)
  select
    v_student, p_attempt_id,
    nullif(e->>'area_slug',''),
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

  update public.test_attempt
  set stato = 'completata',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_attempt_id and stato <> 'completata';
end;
$$;

grant execute on function public.registra_evidenze_test(uuid, jsonb) to authenticated;
