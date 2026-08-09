-- KIREO Escape — funzioni di scrittura del profilo (function-only write,
-- stesso principio di consegna_fase_workshop/avanza_fase_workshop).

-- ============ ricalcola_area_signal (interna, ricomputo idempotente) ============
-- Ricomputa la riga area_signal di UNA (studente, area) dalla somma di TUTTE
-- le prove correnti per quella coppia (qualsiasi fonte: mission/workshop/
-- activity). Full recompute = idempotente per costruzione, nessun doppio
-- conteggio. Interna: revocata da authenticated/anon/public, chiamata solo in
-- contesto definer da registra_evidence (e, in futuro, dal cross-feed workshop).
create or replace function public.ricalcola_area_signal(p_student_id uuid, p_area_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_interest smallint; v_performance smallint; v_self_efficacy smallint; v_curiosity smallint;
  v_has_se boolean; v_has_perf boolean;
  v_peso_tot numeric; v_confidence numeric; v_status public.area_signal_status;
begin
  select
    coalesce(round(100 * sum(valore*peso) filter (where dimensione='interest')      / nullif(sum(peso) filter (where dimensione='interest'),0)), 0),
    coalesce(round(100 * sum(valore*peso) filter (where dimensione='performance')   / nullif(sum(peso) filter (where dimensione='performance'),0)), 0),
    coalesce(round(100 * sum(valore*peso) filter (where dimensione='self_efficacy') / nullif(sum(peso) filter (where dimensione='self_efficacy'),0)), 0),
    coalesce(round(100 * sum(valore*peso) filter (where dimensione='curiosity')     / nullif(sum(peso) filter (where dimensione='curiosity'),0)), 0),
    coalesce(sum(peso) filter (where dimensione='self_efficacy'),0) > 0,
    coalesce(sum(peso) filter (where dimensione='performance'),0) > 0,
    coalesce(sum(peso), 0)
  into v_interest, v_performance, v_self_efficacy, v_curiosity, v_has_se, v_has_perf, v_peso_tot
  from public.evidence
  where student_id = p_student_id and area_slug = p_area_slug;

  if v_peso_tot = 0 then
    delete from public.area_signal where student_id = p_student_id and area_slug = p_area_slug;
    return;
  end if;

  -- confidence: satura a 1 quando il peso accumulato raggiunge la soglia
  v_confidence := least(1.0, v_peso_tot / 10.0);   -- SOGLIA_CONFIDENZA = 10 (tarabile)

  -- status: la tensione autoefficacia≠performance (il segnale più utile
  -- dell'orientamento) prevale, ma solo se ENTRAMBE le dimensioni hanno prove.
  if v_has_se and v_has_perf and abs(v_self_efficacy - v_performance) >= 30 then
    v_status := 'da_verificare';
  elsif v_confidence >= 0.66 then
    v_status := 'confermata';
  else
    v_status := 'emergente';
  end if;

  insert into public.area_signal
    (student_id, area_slug, interest_score, performance_score, self_efficacy_score,
     curiosity_score, confidence, status, updated_at)
  values
    (p_student_id, p_area_slug, v_interest, v_performance, v_self_efficacy,
     v_curiosity, v_confidence, v_status, now())
  on conflict (student_id, area_slug) do update set
    interest_score = excluded.interest_score,
    performance_score = excluded.performance_score,
    self_efficacy_score = excluded.self_efficacy_score,
    curiosity_score = excluded.curiosity_score,
    confidence = excluded.confidence,
    status = excluded.status,
    updated_at = now();
end;
$$;

revoke all on function public.ricalcola_area_signal(uuid, text) from public, authenticated, anon;

-- ============ registra_evidence (studente, a fine missione) ============
-- Riceve le prove calcolate lato server (route Escape: step strutturati in
-- modo deterministico dal config, step aperti via Haiku) e le persiste, poi
-- ricomputa area_signal per le aree toccate. Idempotente: cancella e
-- reinserisce le prove di QUESTO attempt (le prove workshop/activity,
-- attempt_id null, non si toccano). Ownership verificata (attempt del chiamante).
--
-- Nota threat-model: la route calcola le prove dal contenuto AUTOREVOLE letto
-- dal DB (step_response), non da input fidato del client — come consegna-tappa
-- del workshop. Il caso peggiore resta uno studente che gioca il PROPRIO
-- profilo, autolesivo per l'orientamento: gate formativo, non confine di
-- sicurezza. Non può comunque toccare il profilo di altri (auth.uid()).
create or replace function public.registra_evidence(p_attempt_id uuid, p_evidenze jsonb)
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
  select student_id into v_student from public.mission_attempt where id = p_attempt_id;
  if v_student is null or v_student <> auth.uid() then
    raise exception 'non_autorizzato';
  end if;

  -- aree da ricalcolare = quelle già presenti per questo attempt UNITE a
  -- quelle nel nuovo lotto (così un'area rimossa in un ri-invio viene comunque
  -- ricalcolata e perde il suo contributo).
  select array_agg(distinct a) into v_aree from (
    select area_slug as a from public.evidence
      where attempt_id = p_attempt_id and area_slug is not null
    union
    select nullif(e->>'area_slug','') as a from jsonb_array_elements(p_evidenze) e
      where nullif(e->>'area_slug','') is not null
  ) t;

  delete from public.evidence where attempt_id = p_attempt_id;

  insert into public.evidence
    (student_id, attempt_id, area_slug, dimensione, valore, peso, fonte, step_id, motivazione)
  select
    v_student, p_attempt_id,
    nullif(e->>'area_slug',''),
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

  update public.mission_attempt
  set stato = 'completata',
      completed_at = coalesce(completed_at, now()),
      stanza_corrente = 5,
      updated_at = now()
  where id = p_attempt_id and stato <> 'completata';
end;
$$;

grant execute on function public.registra_evidence(uuid, jsonb) to authenticated;
