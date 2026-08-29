-- ═══════════════════════════════════════════════════════════════════════════
-- Il perimetro del CASO D: quante volte la frase «ti orienti verso X e non ci
-- hai ancora fatto niente» avrebbe qualcosa da dire, e su quali aree.
--
-- Un'area entra nel caso D per uno studente quando, insieme:
--   1. ha prove di TEST      (`evidence.fonte = 'test'`)   → l'ha dichiarata;
--   2. non ha prove di MISSIONE (`fonte = 'mission'`)      → non ci ha agito;
--   3. ha almeno DUE azioni distinte su quell'area          → non un clic solo;
--   4. è un'area in cui si PUÒ agire                        → la frase non deve
--      mandare lo studente contro una porta chiusa.
--
-- Le due soglie (max due aree nominate, min due azioni) e l'esclusione delle
-- aree non agibili sono decisioni già prese: qui si contano, non si discutono.
--
-- SULLA CONDIZIONE 3. «Due azioni distinte» conta le RIGHE di prova di test su
-- quell'area, che possono venire da T1 e da T3 (T2 non emette righe d'area).
-- Nel caso reale che ha fissato la soglia erano appunto T1 + il rigioco in T3,
-- non due risposte dentro T1: T3 aveva trovato l'area abbastanza in alto da
-- metterla in coppia, che è una conferma e non una ripetizione.
--
-- SULLA CONDIZIONE 4. L'elenco delle aree non agibili è una COPIA di ciò che
-- dice il censimento del motore (`npm run censimento`): SQL non legge il config
-- TypeScript. Oggi contiene la sola Sicurezza & Difesa — un tag in tutto il
-- motore, e per giunta un gettone. Se il contenuto delle missioni cambia,
-- questo elenco va rifatto: sbaglia in silenzio, a differenza della query sulle
-- trappole, quindi vale la pena ricontrollarlo quando si toccano le missioni.
-- ═══════════════════════════════════════════════════════════════════════════

with non_agibili (area_slug) as (
  values ('sicurezza-difesa')
),
per_area as (
  select e.student_id,
         e.area_slug,
         count(*) filter (where e.fonte = 'test')                as righe_test,
         count(*) filter (where e.fonte = 'mission')             as righe_missione,
         count(distinct e.test_attempt_id) filter (where e.fonte = 'test') as tentativi_test
  from public.evidence e
  where e.area_slug is not null
    -- Gli account di prova (il robot del banco) fuori da ogni conto: queste
    -- righe descrivono studenti, e una riga fabbricata non è uno studente.
    and not public.e_profilo_di_prova(e.student_id)
  group by e.student_id, e.area_slug
),
caso_d as (
  select p.*
  from per_area p
  left join non_agibili n on n.area_slug = p.area_slug
  where p.righe_test >= 2          -- due azioni distinte
    and p.righe_missione = 0       -- dichiarata e mai agita
    and n.area_slug is null        -- area in cui si può agire
)
-- 1) quanti studenti cadono nel caso D, e con quante aree ciascuno
select 'per studente' as vista,
       d.student_id::text as chiave,
       count(*)::text     as aree_in_caso_d,
       string_agg(d.area_slug, ', ' order by d.righe_test desc, d.area_slug) as dettaglio
from caso_d d
group by d.student_id

union all

-- 2) quante volte ogni area finisce nel caso D (su quali aree cadrebbe la frase)
select 'per area', d.area_slug, count(*)::text, null
from caso_d d
group by d.area_slug

union all

-- 3) il conto che serve a scrivere la frase: su quanti studenti CON ALMENO UN
--    TEST comparirebbe. Se comparisse quasi sempre si scrive in un modo, se
--    comparisse a uno su venti in un altro.
select 'totale',
       'studenti con almeno un test',
       (select count(distinct student_id)::text from public.evidence
         where fonte = 'test' and not public.e_profilo_di_prova(student_id)),
       (select count(distinct student_id)::text || ' di questi cadono nel caso D' from caso_d)

order by 1, 3 desc, 2;
