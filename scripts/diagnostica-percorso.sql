-- KIREO — Diagnostica dello stato di avanzamento del percorso studente.
-- Da eseguire nel SQL Editor di Supabase (gira come service_role: bypassa la
-- RLS, quindi vede tutti gli studenti). Non è una migrazione: nessuno schema
-- viene toccato, sono solo SELECT di sola lettura.
--
-- SCOPO: capire, sui dati reali, quanti studenti soddisfano 0/1/2/3/4 delle
-- quattro condizioni del percorso (lib/percorso/stato.ts) e, per chi ne
-- soddisfa 3, quale sia quella mancante — prima di usare le soglie come gate.
--
-- ─────────────────────────────────────────── GRANA SCELTA
-- La valutazione è PER STUDENTE, sulla sua AREA MIGLIORE (quella dove soddisfa
-- più condizioni). Motivo: il gate sbloccherebbe l'assistente per l'area che
-- qualifica per prima, quindi "quante condizioni soddisfa uno studente" =
-- "quanto è vicino a sbloccarlo da qualche parte". Due condizioni sono globali
-- (Test = Fase 1/T1, Esperienza = missione o workshop), due sono per area
-- (Affinità = prime N, Guide = tutte e tre): per ogni studente si prende
-- l'area che massimizza il totale.
--
-- ─────────────────────────────────────────── SORGENTE DELL'AFFINITÀ
-- La CTE `affinita_top` legge area_signal.interest_score, coerente con la
-- scelta fatta in lib/percorso/stato.ts (leggiAffinita). Il TOP_N è 3, come
-- TOP_N_AFFINITA nel modulo.
-- ⚠️ Se in futuro cambia la sorgente dell'affinità (es. score_aree) o il
-- valore di TOP_N, AGGIORNARE QUI: la CTE `affinita_top` e il numero `3` nel
-- filtro `rango <= 3`, per tenere la diagnostica allineata al modulo.
--
-- ─────────────────────────────────────────── ATTENZIONE AL CAMPIONE
-- Se `studenti_totali` (prima query) è basso, le proporzioni non sono
-- significative: con pochi studenti reali la distribuzione dice poco. Leggere
-- i numeri assoluti, non tarare le soglie finché il campione non è adeguato.

-- (0) Dimensione del campione: leggere questo PRIMA di interpretare il resto.
select count(*) as studenti_totali from public.profiles where ruolo = 'studente';

-- Le CTE condivise dalle due query finali. In Supabase SQL Editor si possono
-- eseguire i due blocchi (1) e (2) separatamente: ciascuno ripete le CTE.

-- ============================================================ (1) ISTOGRAMMA
with studenti as (
  select id as student_id from public.profiles where ruolo = 'studente'
),
test_ok as (                                                       -- Fase 1 = test T1 «Da dove parti»
  select distinct student_id from public.test_attempt
  where test_slug = 'da-dove-parti' and stato = 'completata'
),
esperienza_ok as (                                                 -- ≥1 missione completata O ≥1 workshop consegnato
  select distinct student_id from public.mission_attempt where stato = 'completata'
  union
  select distinct wi.student_id
  from public.workshop_iscrizioni wi
  where exists (select 1 from public.workshop_consegne wc where wc.iscrizione_id = wi.id)
     or exists (select 1 from public.workshop_elaborati we where we.iscrizione_id = wi.id and we.stato = 'consegnato')
),
affinita_top as (                                                  -- prime 3 aree per interest_score (⚠️ sorgente/TOP_N)
  select student_id, area_slug from (
    select student_id, area_slug,
           row_number() over (partition by student_id
                              order by interest_score desc, confidence desc, area_slug) as rango
    from public.area_signal
  ) r where rango <= 3
),
guide_ok as (                                                      -- tutte e tre le guide dell'area (livelli 1/2/3)
  select student_id, area_slug
  from public.activity_log
  where tipo_attivita = 'download_guida' and livello in (1,2,3)
  group by student_id, area_slug
  having count(distinct livello) = 3
),
aree(area_slug) as (values
  ('informatica-digitale'),('salute-professioni-sanitarie'),('ristorazione-turismo'),
  ('meccanica-meccatronica'),('agrifood-ambiente'),('arte-design-moda'),('musica-spettacolo'),
  ('energia-sostenibilita'),('edilizia-architettura'),('economia-management'),('giurisprudenza-pa'),
  ('mobilita-sostenibile'),('scienze-educazione'),('comunicazione-media'),('scienze-ricerca'),
  ('sicurezza-difesa'),('lingue-relazioni-internazionali'),('studi-umanistici-beni-culturali')
),
per_area as (
  select s.student_id, a.area_slug,
    (s.student_id in (select student_id from test_ok))::int as c_test,
    (exists (select 1 from affinita_top t where t.student_id = s.student_id and t.area_slug = a.area_slug))::int as c_affinita,
    (exists (select 1 from guide_ok g where g.student_id = s.student_id and g.area_slug = a.area_slug))::int as c_guide,
    (s.student_id in (select student_id from esperienza_ok))::int as c_esperienza
  from studenti s cross join aree a
),
per_area_tot as (
  select *, (c_test + c_affinita + c_guide + c_esperienza) as tot from per_area
),
best as (                                                          -- area migliore per studente
  select distinct on (student_id) student_id, c_test, c_affinita, c_guide, c_esperienza, tot
  from per_area_tot
  order by student_id, tot desc, area_slug
)
select tot as condizioni_soddisfatte, count(*) as studenti
from best group by tot order by tot;

-- ============================================== (2) CONDIZIONE MANCANTE A 3/4
with studenti as (
  select id as student_id from public.profiles where ruolo = 'studente'
),
test_ok as (
  select distinct student_id from public.test_attempt
  where test_slug = 'da-dove-parti' and stato = 'completata'
),
esperienza_ok as (
  select distinct student_id from public.mission_attempt where stato = 'completata'
  union
  select distinct wi.student_id
  from public.workshop_iscrizioni wi
  where exists (select 1 from public.workshop_consegne wc where wc.iscrizione_id = wi.id)
     or exists (select 1 from public.workshop_elaborati we where we.iscrizione_id = wi.id and we.stato = 'consegnato')
),
affinita_top as (
  select student_id, area_slug from (
    select student_id, area_slug,
           row_number() over (partition by student_id
                              order by interest_score desc, confidence desc, area_slug) as rango
    from public.area_signal
  ) r where rango <= 3
),
guide_ok as (
  select student_id, area_slug
  from public.activity_log
  where tipo_attivita = 'download_guida' and livello in (1,2,3)
  group by student_id, area_slug
  having count(distinct livello) = 3
),
aree(area_slug) as (values
  ('informatica-digitale'),('salute-professioni-sanitarie'),('ristorazione-turismo'),
  ('meccanica-meccatronica'),('agrifood-ambiente'),('arte-design-moda'),('musica-spettacolo'),
  ('energia-sostenibilita'),('edilizia-architettura'),('economia-management'),('giurisprudenza-pa'),
  ('mobilita-sostenibile'),('scienze-educazione'),('comunicazione-media'),('scienze-ricerca'),
  ('sicurezza-difesa'),('lingue-relazioni-internazionali'),('studi-umanistici-beni-culturali')
),
per_area as (
  select s.student_id, a.area_slug,
    (s.student_id in (select student_id from test_ok))::int as c_test,
    (exists (select 1 from affinita_top t where t.student_id = s.student_id and t.area_slug = a.area_slug))::int as c_affinita,
    (exists (select 1 from guide_ok g where g.student_id = s.student_id and g.area_slug = a.area_slug))::int as c_guide,
    (s.student_id in (select student_id from esperienza_ok))::int as c_esperienza
  from studenti s cross join aree a
),
per_area_tot as (
  select *, (c_test + c_affinita + c_guide + c_esperienza) as tot from per_area
),
best as (
  select distinct on (student_id) student_id, c_test, c_affinita, c_guide, c_esperienza, tot
  from per_area_tot
  order by student_id, tot desc, area_slug
)
select
  case
    when c_test = 0       then 'Test (Fase 1)'
    when c_affinita = 0   then 'Affinità (prime 3)'
    when c_guide = 0      then 'Guide (tutte e tre)'
    when c_esperienza = 0 then 'Esperienza (missione o workshop)'
  end as condizione_mancante,
  count(*) as studenti
from best
where tot = 3
group by 1
order by studenti desc;
