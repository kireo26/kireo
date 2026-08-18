-- KIREO Escape — Blocco B (parte 1/2): esporre `attivita_distinte` su area_signal.
--
-- La barra di eleggibilità della vista affinità (item 3) è «≥2 attività distinte»
-- — lo stesso conteggio che `ricalcola_area_signal` calcola già per il Fix D, ma
-- che finora buttava via dopo aver deciso lo status. La sezione affinità sulla
-- home deve poterlo LEGGERE per filtrare le aree eleggibili: lo `status` non è un
-- proxy (un'area con 2 attività e confidence <0.66 è `emergente` ma eleggibile),
-- e ricalcolarlo in TS creerebbe una seconda verità che diverge dalla prima.
-- Quindi: colonna, scritta dalla stessa funzione che già la calcola. Fonte unica.
--
-- Raggio: la colonna + una sola aggiunta a INSERT/UPSERT dentro la funzione
-- (la logica di conteggio v_attivita_distinte e quella di status sono INVARIATE
-- dal Fix D, 20260818120000) + ricalcolo forzato. Nessuna modifica applicativa
-- qui: la sezione affinità arriva dopo l'apply, quando la colonna esiste.
--
-- `attivita_distinte` è un count(distinct …): sempre ≥0 e mai NULL quando la riga
-- esiste (la riga esiste solo se v_peso_tot > 0, cioè ≥1 prova). Quindi la
-- aggiungo nullable, la riempio col ricalcolo forzato, poi la vincolo NOT NULL.

-- ============ parte 1 — colonna (nullable → backfill → not null) ============
alter table public.area_signal add column attivita_distinte smallint;

-- ============ parte 2 — ricalcola_area_signal scrive anche attivita_distinte ============
-- Identica alla versione Fix D (20260818120000) tranne: la colonna
-- attivita_distinte nell'INSERT e nell'ON CONFLICT. Il valore v_attivita_distinte
-- e il ramo status sono byte-per-byte gli stessi.
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
  v_attivita_distinte integer;
begin
  -- Join su mission_attempt per risalire al mission_slug (una lookup su PK).
  -- student_id esiste in ENTRAMBE le tabelle → qualifico tutto con e./ma.
  select
    round(100 * sum(e.valore*e.peso) filter (where e.dimensione='interest')      / nullif(sum(e.peso) filter (where e.dimensione='interest'),0)),
    round(100 * sum(e.valore*e.peso) filter (where e.dimensione='performance')   / nullif(sum(e.peso) filter (where e.dimensione='performance'),0)),
    round(100 * sum(e.valore*e.peso) filter (where e.dimensione='self_efficacy') / nullif(sum(e.peso) filter (where e.dimensione='self_efficacy'),0)),
    round(100 * sum(e.valore*e.peso) filter (where e.dimensione='curiosity')     / nullif(sum(e.peso) filter (where e.dimensione='curiosity'),0)),
    coalesce(sum(e.peso) filter (where e.dimensione='self_efficacy'),0) > 0,
    coalesce(sum(e.peso) filter (where e.dimensione='performance'),0) > 0,
    coalesce(sum(e.peso), 0),
    count(distinct case
      when e.fonte = 'mission' then 'm:' || ma.mission_slug   -- una missione = una chiave, N tentativi = 1
      when e.fonte = 'test'    then 't'                       -- il test = attività singola
      else e.fonte::text  -- workshop/activity (cross-feed non ancora attivo): quando
                          -- arriveranno, questa chiave andrà raffinata come mission_slug
    end)
  into v_interest, v_performance, v_self_efficacy, v_curiosity, v_has_se, v_has_perf, v_peso_tot, v_attivita_distinte
  from public.evidence e
  left join public.mission_attempt ma on ma.id = e.attempt_id
  where e.student_id = p_student_id and e.area_slug = p_area_slug;

  if v_peso_tot = 0 then
    delete from public.area_signal where student_id = p_student_id and area_slug = p_area_slug;
    return;
  end if;

  -- confidence: satura a 1 quando il peso accumulato raggiunge la soglia
  v_confidence := least(1.0, v_peso_tot / 10.0);   -- SOGLIA_CONFIDENZA = 10 (tarabile)

  -- status: la tensione autoefficacia≠performance (il segnale più utile
  -- dell'orientamento) prevale, ma solo se ENTRAMBE le dimensioni hanno prove.
  -- Fix D: `confermata` richiede ANCHE ≥2 attività distinte — una sola fonte,
  -- per quanto ricca, non conferma; conferma è il segnale che ritorna altrove.
  --
  -- DECISIONE ESPLICITA (non un buco nella regola): `da_verificare` sta PRIMA nel
  -- ramo e NON è soggetto al requisito delle due attività. Una contraddizione fra
  -- quanto sei bravo e quanto ti SENTI bravo è un'OSSERVAZIONE, non una
  -- conclusione: si può fare — e vale la pena dirla — anche su una singola
  -- attività. Solo la CONFERMA («questo segnale è solido») pretende che sia
  -- ricomparso altrove. Chi legge fra sei mesi: questo è voluto, non dimenticato.
  if v_has_se and v_has_perf and abs(v_self_efficacy - v_performance) >= 30 then
    v_status := 'da_verificare';
  elsif v_confidence >= 0.66 and v_attivita_distinte >= 2 then
    v_status := 'confermata';
  else
    v_status := 'emergente';
  end if;

  insert into public.area_signal
    (student_id, area_slug, interest_score, performance_score, self_efficacy_score,
     curiosity_score, confidence, status, attivita_distinte, updated_at)
  values
    (p_student_id, p_area_slug, v_interest, v_performance, v_self_efficacy,
     v_curiosity, v_confidence, v_status, v_attivita_distinte, now())
  on conflict (student_id, area_slug) do update set
    interest_score = excluded.interest_score,
    performance_score = excluded.performance_score,
    self_efficacy_score = excluded.self_efficacy_score,
    curiosity_score = excluded.curiosity_score,
    confidence = excluded.confidence,
    status = excluded.status,
    attivita_distinte = excluded.attivita_distinte,
    updated_at = now();
end;
$$;

revoke all on function public.ricalcola_area_signal(uuid, text) from public, authenticated, anon;

-- ============ parte 3 — ricalcolo forzato + vincolo NOT NULL ============
-- Riempie attivita_distinte su tutte le righe esistenti (idempotente su tutto il
-- resto: stesse prove → stessi numeri), poi la vincola NOT NULL (sicuro: dopo il
-- ricalcolo ogni riga ha un conteggio ≥1).
do $$
declare r record;
begin
  for r in select student_id, area_slug from public.area_signal loop
    perform public.ricalcola_area_signal(r.student_id, r.area_slug);
  end loop;
end;
$$;

alter table public.area_signal alter column attivita_distinte set not null;

-- ============ migrazione inversa (NON eseguita — scritta adesso) ============
-- Per tornare indietro:
--   1. ri-eseguire la CREATE OR REPLACE di ricalcola_area_signal della versione
--      Fix D (20260818120000_fix_d_confermata_due_attivita.sql) — quella NON
--      referenzia la colonna attivita_distinte nell'INSERT/UPSERT, sganciando la
--      dipendenza;
--   2. alter table public.area_signal drop column attivita_distinte;
-- L'ordine conta: la funzione va prima riportata a non usare la colonna, altrimenti
-- il drop fallisce (o la funzione resta rotta al primo ricalcolo). NON tornare alla
-- 20260810110000 né alla 20260818110000: perderesti Fix D e/o i punteggi nullable.
