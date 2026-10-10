-- LA MISURA DEL LETTORE LESSICALE, cioè l'unica cosa che rende credibile
-- `scripts/lib/cascata-profili.js`.
--
-- Quel modulo deriva «le tabelle le cui righe appartengono a una persona»
-- dalla cascata di `on delete cascade` a partire da `profiles` — e lo fa
-- leggendo le MIGRAZIONI, non il database, perché i controlli girano con
-- `npm test` e lì una replica non c'è. Quindi non è la verità: è
-- un'approssimazione, e un'approssimazione di cui nessuno misura lo scarto è
-- una cosa che si crede sulla parola.
--
-- Questo file stampa la verità. Si incolla nel SQL Editor di Supabase (o si
-- lancia su una replica) e si confronta la sua uscita con
--
--     node -e "const {cascataDaProfili}=require('./scripts/lib/cascata-profili.js'); \
--       const {cascata}=cascataDaProfili(); \
--       console.log([...cascata.entries()].map(([t,v])=>v+' '+t).sort().join('\n'))"
--
-- Misurato il 10/10/2026 su una replica con tutte le 115 migrazioni: IDENTICHE,
-- 39 tabelle, tabella per tabella e livello per livello. Il giorno in cui
-- divergono è il lettore lessicale a doversi spiegare, non questo file.
--
-- Non modifica niente: è di sola lettura, e non serve nemmeno una transazione.

-- ── la chiusura transitiva della cascata da `profiles`
with recursive fk as (
  select c.relname as tabella,
         cl2.relname as madre,
         con.confdeltype as azione
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_class cl2 on cl2.oid = con.confrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f' and n.nspname = 'public'
),
discese (tabella, livello) as (
  select tabella, 1 from fk where madre = 'profiles' and azione = 'c'
  union
  select f.tabella, d.livello + 1
  from fk f join discese d on f.madre = d.tabella
  where f.azione = 'c' and f.tabella <> d.tabella and d.livello < 6
)
select min(livello) as livello, tabella
from discese
group by tabella
order by min(livello), tabella;

-- ── e il controprova dell'inferenza: le FK verso profiles/student_profiles
--    che NON sono in cascata devono essere TUTTE colonne di responsabilità,
--    cioè nominare chi ha agito su una riga di qualcun altro. Se qui comparisse
--    una colonna che somiglia a un proprietario (`student_id`, `user_id`),
--    l'inferenza «la cascata dice chi è il proprietario» avrebbe un'eccezione
--    e andrebbe riscritta.
select c.relname as tabella,
       a.attname as colonna,
       case con.confdeltype when 'n' then 'set null' when 'a' then 'blocca' else con.confdeltype::text end as azione
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_class cl2 on cl2.oid = con.confrelid
join pg_namespace n on n.oid = c.relnamespace
join unnest(con.conkey) k on true
join pg_attribute a on a.attrelid = c.oid and a.attnum = k
where con.contype = 'f'
  and n.nspname = 'public'
  and cl2.relname in ('profiles', 'student_profiles')
  and con.confdeltype <> 'c'
order by 1, 2;
