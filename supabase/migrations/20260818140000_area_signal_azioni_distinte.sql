-- KIREO Escape — «aree sfiorate» sul conteggio delle AZIONI, non delle celle vuote.
--
-- Il criterio del Blocco A per mandare un'area nell'elenco «sfiorate» era «≥3
-- dimensioni su 4 a NULL»: un conteggio di celle vuote, non una misura di quanta
-- prova c'è. Metteva Edilizia (1 gettone, conf 0.100) fra le card piene ed Energia
-- (1 gettone, conf 0.080) fra le sfiorate, benché nascano dalla STESSA azione.
--
-- Il criterio giusto è il numero di AZIONI distinte che hanno prodotto l'area:
-- un'area la cui presenza nel profilo nasce da UNA SOLA azione è «sfiorata». È lo
-- stesso concetto della barra di eleggibilità (attivita_distinte), a un'altra
-- granularità — attività (missioni/test) vs azioni (step). Una sola nozione di
-- sufficienza, due livelli, ENTRAMBI in DB e calcolati nello stesso punto: contare
-- l'uno in DB e l'altro in TS creerebbe due definizioni destinate a divergere.
--
-- azioni_distinte = count(distinct (attempt_id, test_attempt_id, step_id)): un
-- gettone speso è UNA azione anche se emette due righe (interest+curiosity con lo
-- stesso step_id → stessa tripla → contate 1). La tripla distingue anche lo stesso
-- step in missioni diverse. Verificato su +test2: edilizia/energia 1, arte 3,
-- agrifood/meccanica 4, informatica 5, scienze 6 → soglia (<2) taglia 5 piene / 2
-- sfiorate, nessuna area sul confine.
--
-- Raggio: la colonna + una sola aggiunta a SELECT/INSERT/UPSERT dentro la funzione
-- (attivita_distinte e status invariati) + ricalcolo forzato + i due COMMENT.

-- ============ parte 1 — colonna (nullable → backfill → not null) ============
alter table public.area_signal add column azioni_distinte smallint;

-- ============ parte 2 — ricalcola_area_signal calcola e scrive azioni_distinte ============
-- Identica alla versione 20260818130000 tranne: v_azioni_distinte (il count sulla
-- tripla) nella SELECT, e la colonna azioni_distinte in INSERT/ON CONFLICT.
-- attivita_distinte, i punteggi e il ramo status sono byte-per-byte gli stessi.
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
  v_azioni_distinte integer;
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
    end),
    count(distinct (e.attempt_id, e.test_attempt_id, e.step_id))  -- AZIONI: uno step = una azione (il gettone emette 2 righe, 1 tripla)
  into v_interest, v_performance, v_self_efficacy, v_curiosity, v_has_se, v_has_perf, v_peso_tot, v_attivita_distinte, v_azioni_distinte
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
     curiosity_score, confidence, status, attivita_distinte, azioni_distinte, updated_at)
  values
    (p_student_id, p_area_slug, v_interest, v_performance, v_self_efficacy,
     v_curiosity, v_confidence, v_status, v_attivita_distinte, v_azioni_distinte, now())
  on conflict (student_id, area_slug) do update set
    interest_score = excluded.interest_score,
    performance_score = excluded.performance_score,
    self_efficacy_score = excluded.self_efficacy_score,
    curiosity_score = excluded.curiosity_score,
    confidence = excluded.confidence,
    status = excluded.status,
    attivita_distinte = excluded.attivita_distinte,
    azioni_distinte = excluded.azioni_distinte,
    updated_at = now();
end;
$$;

revoke all on function public.ricalcola_area_signal(uuid, text) from public, authenticated, anon;

-- ============ parte 3 — ricalcolo forzato + vincolo NOT NULL ============
do $$
declare r record;
begin
  for r in select student_id, area_slug from public.area_signal loop
    perform public.ricalcola_area_signal(r.student_id, r.area_slug);
  end loop;
end;
$$;

alter table public.area_signal alter column azioni_distinte set not null;

-- ============ parte 4 — COMMENT ON COLUMN: i due nomi si somigliano troppo ============
-- Chi apre lo schema fra sei mesi non ha modo di distinguerli senza questi commenti.
comment on column public.area_signal.attivita_distinte is
  'Quante ATTIVITÀ distinte hanno prodotto prove per quest''area. Attività = una missione (per slug, N tentativi contano 1) oppure il test. Usata per la barra di eleggibilità e per lo stato confermata.';
comment on column public.area_signal.azioni_distinte is
  'Quante AZIONI distinte hanno prodotto prove per quest''area. Azione = uno step (attempt_id, test_attempt_id, step_id): un gettone speso è UNA azione anche se emette due righe. Usata per decidere se un''area è "sfiorata" nel display.';

-- ============ migrazione inversa (NON eseguita — scritta adesso) ============
-- Per tornare indietro:
--   1. ri-eseguire la CREATE OR REPLACE di ricalcola_area_signal della versione
--      20260818130000 (senza v_azioni_distinte e senza la colonna in INSERT/UPSERT);
--   2. alter table public.area_signal drop column azioni_distinte;
-- (il COMMENT sparisce col drop della colonna; quello su attivita_distinte resta,
-- innocuo). Ordine: prima la funzione, poi il drop, altrimenti il drop fallisce.
