-- KIREO Escape — «non misurato» ≠ «zero» (opzione A).
--
-- Prima di questa migrazione una dimensione senza prove (es. la bravura di
-- un'area che lo studente ha solo sfiorato con curiosità) veniva scritta come 0:
-- una barra vuota che si legge «sei scarso», non «non l'abbiamo ancora misurato».
-- È una bugia — KIREO afferma un giudizio (zero bravura) su un'azione che lo
-- studente non ha mai compiuto. La correzione: dove non c'è prova per una
-- dimensione, la colonna resta NULL, e la card dirà «non ancora misurata».
--
-- Tre parti:
--   1. le 4 colonne _score di area_signal diventano nullable (via NULL, non 0);
--   2. ricalcola_area_signal smette di coalesce-are a 0 le 4 medie (NULL resta
--      NULL quando la dimensione non ha prove);
--   3. si forza il ricalcolo di TUTTE le righe esistenti, così nessuna riga
--      già scritta resta ambigua (uno 0 che significava «non misurato»).
--
-- Invariati e verificati safe con NULL:
--   - il CHECK `_score between 0 and 100` accetta NULL (NULL between … è NULL,
--     non FALSE): nessun bisogno di ridefinirlo;
--   - v_has_se/v_has_perf restano boolean non-null (coalesce(sum(peso),0) > 0):
--     il ramo da_verificare tocca v_self_efficacy/v_performance solo quando
--     ENTRAMBE hanno prove, quindi mai su un NULL;
--   - confidence usa sum(peso) TOTALE (tutte le dimensioni), non per-dimensione:
--     non diventa NULL. Invariata.

-- ============ parte 1 — colonne nullable ============
alter table public.area_signal alter column interest_score      drop not null;
alter table public.area_signal alter column interest_score      drop default;
alter table public.area_signal alter column performance_score   drop not null;
alter table public.area_signal alter column performance_score   drop default;
alter table public.area_signal alter column self_efficacy_score drop not null;
alter table public.area_signal alter column self_efficacy_score drop default;
alter table public.area_signal alter column curiosity_score     drop not null;
alter table public.area_signal alter column curiosity_score     drop default;

-- ============ parte 2 — ricalcola_area_signal senza coalesce a 0 ============
-- Unico cambiamento vs 20260810110000: le 4 medie perdono il `coalesce(…, 0)`
-- esterno. `round(100 * sum(valore*peso) filter(…) / nullif(sum(peso) filter(…),0))`
-- è già NULL quando quella dimensione non ha prove (nullif → divisione per NULL
-- → NULL → round(NULL) → NULL): prima veniva schiacciato a 0, ora resta NULL.
-- Tutto il resto (guardie, confidence, status, upsert, delete-se-vuoto) è
-- identico byte per byte.
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
    round(100 * sum(valore*peso) filter (where dimensione='interest')      / nullif(sum(peso) filter (where dimensione='interest'),0)),
    round(100 * sum(valore*peso) filter (where dimensione='performance')   / nullif(sum(peso) filter (where dimensione='performance'),0)),
    round(100 * sum(valore*peso) filter (where dimensione='self_efficacy') / nullif(sum(peso) filter (where dimensione='self_efficacy'),0)),
    round(100 * sum(valore*peso) filter (where dimensione='curiosity')     / nullif(sum(peso) filter (where dimensione='curiosity'),0)),
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

-- ============ parte 3 — ricalcolo forzato di tutte le righe esistenti ============
-- La migrazione chiude il ciclo da sola: senza questo, le righe già scritte con
-- 0 «non misurato» resterebbero ambigue finché lo studente non rigioca. Ciclo su
-- ogni coppia (student_id, area_slug) esistente e ricomputo: idempotente (full
-- recompute), gli 0 fittizi diventano NULL, gli 0 veri (prova con valore 0)
-- restano 0. `ricalcola_area_signal` cancella da sé le righe rimaste senza prove
-- (v_peso_tot = 0), quindi il loop legge un elenco che non si accorcia sotto i
-- piedi (la SELECT è già materializzata in un cursore implicito).
do $$
declare r record;
begin
  for r in select student_id, area_slug from public.area_signal loop
    perform public.ricalcola_area_signal(r.student_id, r.area_slug);
  end loop;
end;
$$;

-- ============ migrazione inversa (NON eseguita — scritta adesso) ============
-- Per tornare indietro, in QUEST'ORDINE:
--   1. ricomputare i NULL a 0 sulle righe esistenti (le colonne torneranno
--      not null solo se nessuna resta NULL):
--        update public.area_signal set
--          interest_score      = coalesce(interest_score, 0),
--          performance_score   = coalesce(performance_score, 0),
--          self_efficacy_score = coalesce(self_efficacy_score, 0),
--          curiosity_score     = coalesce(curiosity_score, 0);
--   2. ripristinare default e not null:
--        alter table public.area_signal alter column interest_score      set default 0;
--        alter table public.area_signal alter column interest_score      set not null;
--        (idem performance_score / self_efficacy_score / curiosity_score)
--   3. ri-eseguire per intero 20260810110000_escape_funzioni.sql (o solo la
--      CREATE OR REPLACE di ricalcola_area_signal in quel file) per rimettere i
--      quattro coalesce(…, 0).
