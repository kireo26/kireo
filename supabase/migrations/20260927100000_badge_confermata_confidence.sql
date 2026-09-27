-- Il badge «confermata» guarda solo `confidence` — e `attivita_distinte` esce
-- dall'ultima condizione di visibilità che lo usava.
--
-- ═══ PERCHÉ, in una riga ═══
-- La barra che decide chi entra nella classifica delle affinità è passata da
-- `attivita_distinte >= 2` a `confidence >= 0,40` (lib/percorso/stato.ts,
-- `eleggibilePerAffinita`). Questa migrazione è la SECONDA METÀ di quel cambio,
-- non un seguito: senza, il badge resterebbe l'unico posto in cui il conteggio
-- delle attività sopravvive, e farebbe mentire l'etichetta.
--
-- ═══ IL NUMERO CHE L'HA DECISO ═══
-- Misurato il 27/09 su un profilo reale (`area_signal`, non una ricostruzione):
-- il prodotto metteva in classifica `comunicazione-media` con confidence 0,120 —
-- la più bassa della tabella — e teneva fuori `edilizia-architettura` con 1,000,
-- diciassette prove, una missione intera. Con la barra nuova quelle tre aree
-- ricche entrano, e con la regola VECCHIA del badge mostrerebbero «emergente»:
--   edilizia-architettura   confidence 1,000   17 prove   →  «Sta emergendo»
--   giurisprudenza-pa       confidence 0,810   10 prove   →  «Sta emergendo»
--   meccanica-meccatronica  confidence 0,800    8 prove   →  «Sta emergendo»
-- Tre aree, le più solide del profilo, che dicono a uno studente il contrario di
-- quello che i numeri dicono di lui.
--
-- ═══ COSA CAMBIA, ESATTAMENTE ═══
-- Una riga di codice su 81 [verificato confrontando le righe non-commento della
-- funzione viva con quelle di questa]:
--   -  elsif v_confidence >= 0.66 and v_attivita_distinte >= 2 then
--   +  elsif v_confidence >= 0.66 then
-- Tutto il resto della funzione è estratto dalla definizione viva
-- (20260826120000_primo_tentativo_valido.sql) e riportato invariato, non
-- riscritto: il filtro del primo tentativo valido, le medie pesate, la
-- confidence, `attivita_distinte` e `azioni_distinte` — che CONTINUANO a essere
-- calcolate e salvate. Escono da una CONDIZIONE, non dalla tabella: restano un
-- dato diagnostico, e il giorno che servissero sono lì.
--
-- ═══ 0,66 NON È 0,40, anche dove coincidono ═══
-- Due livelli con due mestieri: 0,40 fa entrare in classifica, 0,66 dà il badge.
-- Un'area a 0,50 entra SENZA badge, ed è giusto. Se il badge scendesse a 0,40
-- diventerebbe per costruzione sempre vero per chiunque sia in classifica, cioè
-- smetterebbe di dire qualcosa. Sul profilo misurato non c'è niente fra 0,39 e
-- 0,80, quindi i due livelli sembrano la stessa cosa: è una proprietà di quel
-- profilo, non della regola.
--
-- ═══ APPLICAZIONE ═══
-- Via SQL Editor. Trasforma i dati che sono già live: il ricalcolo in coda
-- riscrive `status` per le righe esistenti, ed è il punto — senza, la correzione
-- varrebbe solo per le attività future e le righe già scritte resterebbero con
-- l'etichetta sbagliata. Dopo, `scripts/verifica-badge-confidence.sql` prova le
-- sei proprietà in una transazione con ROLLBACK.

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
  -- IL BADGE GUARDA SOLO `confidence`, dal 27/09. Prima chiedeva ANCHE
  -- `attivita_distinte >= 2` (Fix D: «una sola fonte, per quanto ricca, non
  -- conferma»), e quando la barra di ingresso delle affinità è passata a
  -- `confidence >= 0,40` quel pezzo è diventato l'ULTIMO posto in cui il
  -- conteggio delle attività sopravviveva — e faceva mentire l'etichetta:
  -- misurato su un profilo reale, `edilizia-architettura` con confidence 1,000 e
  -- diciassette prove avrebbe mostrato «emergente», e con lei `giurisprudenza-pa`
  -- (0,810) e `meccanica-meccatronica` (0,800). Tre aree, le più ricche del
  -- profilo, che dicono a uno studente «sta appena emergendo».
  --
  -- Va nello STESSO passaggio della barra, non dopo: in mezzo ci sarebbe una
  -- versione del prodotto in cui quelle tre righe sono già in classifica e
  -- portano il badge sbagliato.
  --
  -- `da_verificare` resta PRIMA nel ramo, e la ragione non cambia: una
  -- contraddizione fra quanto sei bravo e quanto ti SENTI bravo è
  -- un'OSSERVAZIONE, non una conclusione — si può fare, e vale la pena dirla,
  -- anche su una attività sola.
  if v_has_se and v_has_perf and abs(v_self_efficacy - v_performance) >= 30 then
    v_status := 'da_verificare';
  elsif v_confidence >= 0.66 then
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

-- Il revoke è IDEMPOTENTE e sta qui per una ragione di forma, non di necessità:
-- `create or replace function` PRESERVA i privilegi [verificato su Postgres 16 il
-- 26/09], quindi la revoca della migrazione originale non è stata disfatta. Sta
-- scritto perché chi legge non debba andare a controllarlo, e perché il file
-- resti leggibile da solo.
revoke all on function public.ricalcola_area_signal(uuid, text) from public, authenticated, anon;

-- ── ricalcolo forzato: le righe già scritte con la regola vecchia ────────────
-- È la parte che conta. Senza, `edilizia-architettura` resterebbe «emergente»
-- finché quello studente non tocca di nuovo quell'area — e per un'area di una
-- missione già chiusa potrebbe non succedere mai.
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
