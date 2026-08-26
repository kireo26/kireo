-- KIREO Escape — non far pagare allo studente un guasto nostro.
--
-- IL BUCO. Dal 23/08 il profilo conta il PRIMO tentativo completato di ogni
-- missione: rigiocare finché «viene bene» sarebbe barare, e la regola resta.
-- Ma se in quel primo tentativo il revisore è fallito (`revisore_esito =
-- 'non_riuscito'` — chiave assente, chiamata o estrazione andata male), quel
-- tentativo non è una misurazione: è un guasto. E siccome i tentativi
-- successivi vengono ignorati per costruzione, quel profilo resta senza le
-- righe del revisore PER SEMPRE. Prima del 23/08 rigiocare rimediava; dopo no.
-- È una regressione introdotta da una correzione giusta.
--
-- QUANTO PESA. In dieci missioni su undici la BRAVURA d'area ha una sola
-- sorgente: il revisore della proposta finale (l'unica altra è un 0,9 fisso
-- negli abbinamenti della Missione 10). Quindi un revisore fallito al primo
-- tentativo non lascia un buco in una dimensione: lascia lo studente senza
-- bravura in quell'area, definitivamente.
--
-- LA REGOLA. Conta il primo tentativo completato in cui il revisore ha girato;
-- se sono falliti tutti, conta il primo. Non è una scappatoia per rigiocare
-- fino a un voto migliore — fra due tentativi entrambi validi vince sempre il
-- più vecchio, esattamente come prima. Cambia solo che un guasto nostro non
-- vale come prestazione sua.
--
-- Un `revisore_esito` NULL (proposta non scritta, o tentativo antecedente al
-- campo) NON è un fallimento: `coalesce(..., '')` lo tratta come «non fallito»,
-- quindi i tentativi vecchi si comportano esattamente come oggi.
--
-- VERIFICATO su Postgres 16 prima di scrivere, quattro casi: primo fallito con
-- due buoni dopo → sceglie il primo buono; tutti falliti → sceglie il primo
-- (mai zero righe); nessuno fallito → identico a oggi; esito NULL → identico a
-- oggi. Rispetto a 20260823100000 cambia SOLO la condizione sul ramo missione:
-- punteggi, confidence, attivita_distinte, azioni_distinte e status sono
-- byte-per-byte gli stessi — del codice E, qui, anche del risultato, perché per
-- ogni studente senza tentativi falliti la riga scelta è la stessa di prima.

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
  left join public.test_attempt   ta on ta.id = e.test_attempt_id
  where e.student_id = p_student_id and e.area_slug = p_area_slug
    and (
      -- missione: il primo tentativo completata per (studente, mission_slug) IN
      -- CUI IL REVISORE HA GIRATO. Un tentativo qualifica se non ne esiste uno
      -- "migliore": migliore = riuscito quando questo è fallito, oppure —
      -- a parità di riuscita — precedente. Se sono falliti tutti, resta il
      -- primo (nessuno è migliore di nessuno) e non si perde nulla.
      (e.fonte='mission' and not exists (
         select 1 from public.mission_attempt m2
         where m2.student_id = e.student_id and m2.mission_slug = ma.mission_slug and m2.stato='completata'
           and (
             (coalesce(m2.revisore_esito, '') <> 'non_riuscito' and coalesce(ma.revisore_esito, '') = 'non_riuscito')
             or (
               (coalesce(m2.revisore_esito, '') = 'non_riuscito') = (coalesce(ma.revisore_esito, '') = 'non_riuscito')
               and (m2.started_at < ma.started_at or (m2.started_at = ma.started_at and m2.id < ma.id))
             )
           )))
      or
      -- test: solo l'ULTIMO tentativo completata per (studente, test_slug)
      (e.fonte='test' and not exists (
         select 1 from public.test_attempt t2
         where t2.student_id = e.student_id and t2.test_slug = ta.test_slug and t2.stato='completata'
           and (t2.started_at > ta.started_at or (t2.started_at = ta.started_at and t2.id > ta.id))))
      or
      -- workshop/activity (cross-feed non attivo): invariato
      e.fonte not in ('mission','test')
    );

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

-- ── ricalcolo forzato: applica subito il filtro a tutte le righe esistenti ──
-- Auto-corregge i profili già sporchi (i 3 account di prova). Idempotente sui
-- profili senza rigiochi: stessa evidence filtrata = stessi numeri (cambia solo
-- updated_at). NOTA DI SCALA (registrata, non risolta qui): è un unico DO che
-- chiama la funzione per ogni riga di area_signal, in UNA transazione. Con pochi
-- account è nulla; con centinaia di studenti sono migliaia di chiamate in una
-- transazione sola e andrà spezzato a blocchi. Rivalutare quando il volume cresce.

-- ── ricalcolo forzato: i profili già scritti con la regola vecchia ──────────
-- Chi ha un primo tentativo fallito ha oggi un profilo degradato che nessun
-- rigioco può riparare: senza questo passaggio la correzione varrebbe solo per
-- le partite future, e proprio gli studenti già danneggiati resterebbero tali.
--
-- ⚠️ Come i ricalcoli forzati precedenti, gira in UNA transazione: con poche
-- decine di studenti è nulla, a centinaia va spezzata a blocchi (nota già in
-- CLAUDE.md, «batching del ricalcolo forzato alla scala»).
do $$
declare r record;
begin
  for r in select student_id, area_slug from public.area_signal loop
    perform public.ricalcola_area_signal(r.student_id, r.area_slug);
  end loop;
end $$;
