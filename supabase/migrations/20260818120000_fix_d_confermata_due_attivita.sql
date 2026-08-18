-- KIREO Escape — Fix D: «confermata» richiede ≥2 attività distinte.
--
-- Finora un'area andava `confermata` sul solo peso accumulato (confidence ≥ 0.66):
-- una singola missione con abbastanza prove bastava a «confermare». Ma una sola
-- fonte non conferma niente — conferma è quando lo stesso segnale ricompare in
-- situazioni DIVERSE. Fix D aggiunge quel requisito strutturale: `confermata`
-- solo se confidence ≥ 0.66 E almeno due attività distinte hanno prodotto prove
-- per quell'area.
--
-- «Attività distinta»:
--   - due missioni DIVERSE, oppure un test + una missione → distinte;
--   - due tentativi della STESSA missione → una sola.
-- Chiave d'identità: mission_attempt.mission_slug per le missioni (NON
-- attempt_id), una chiave unica 't' per il test. Keyare su mission_slug rende la
-- regola vera indipendentemente dalla futura «regola del replay» (max un secondo
-- tentativo, profilo che registra solo il primo), NON costruita qui: oggi il
-- replay riscrive lo stesso attempt, ma per-mission_slug regge anche quando non
-- sarà più così.
--
-- Raggio: solo questa funzione + ricalcolo forzato. Nessuna colonna, nessun enum
-- nuovo, nessuna modifica applicativa (gli stati confermata/emergente esistono
-- già). La modifica vive SOLO nel ramo `status`: punteggi e confidence invariati.
-- Fix D può solo far scendere confermata→emergente, mai promuovere, mai toccare
-- da_verificare.
--
-- Basata sulla versione post-item-1 (20260818110000): le 4 medie restano SENZA
-- coalesce(…,0) (NULL = «non misurato»). Unica differenza vs quella: il conteggio
-- v_attivita_distinte e la condizione aggiuntiva su `confermata`.

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
  -- per evitare ambiguità.
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

-- ============ ricalcolo forzato di tutte le righe esistenti ============
-- Come nell'item 1: la migrazione chiude il ciclo da sola, così il nuovo status
-- si applica subito (nessuna riga confermata «vecchia» resta finché lo studente
-- non rigioca). Idempotente su punteggi/confidence (stesse prove → stessi numeri):
-- cambia SOLO lo status, e solo dove serve.
do $$
declare r record;
begin
  for r in select student_id, area_slug from public.area_signal loop
    perform public.ricalcola_area_signal(r.student_id, r.area_slug);
  end loop;
end;
$$;

-- ============ migrazione inversa (NON eseguita — scritta adesso) ============
-- Per tornare indietro: ri-eseguire la CREATE OR REPLACE di ricalcola_area_signal
-- della versione post-item-1 (20260818110000_area_signal_score_nullable.sql), che
-- non ha il conteggio v_attivita_distinte né la condizione aggiuntiva, poi il
-- ricalcolo forzato (il DO block qui sopra) per riportare gli status. NON tornare
-- alla 20260810110000: quella rimetterebbe anche i coalesce(…,0), disfacendo l'item 1.
