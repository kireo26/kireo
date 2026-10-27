-- IL CENSIMENTO DELLE COLONNE CHE IL CLIENT SCRIVE (Mario, 27/10: «la quarta
-- volta non è un caso: è un modo di scrivere le policy»). Sola lettura: si può
-- lanciare anche in produzione, ed è il modo di sapere se la replica dice il vero
-- (il modo 4) — il conto del 27/10 è stato fatto sulla replica.
--
-- Per ogni tabella con una policy di INSERT, UPDATE o ALL concessa ad
-- `authenticated` (o a `public`): le colonne che `authenticated` può scrivere
-- (privilegi di colonna) e quante ne sono escluse. ⚠️ Una policy `ALL` solo
-- per l'admin (`current_ruolo() = 'admin'`) compare lo stesso: va tolta a mano,
-- guardando la seconda query. Le colonne «che decidono» NON le dice questa
-- query: sono una lettura (vedi CLAUDE.md, «Il censimento delle colonne che il
-- client scrive»).
--
-- La terza metà, che la query non vede: un `with check` che fissa un valore
-- (es. `stato = 'in_approvazione'`), un CHECK, un trigger che riscrive. Una
-- colonna scrivibile qui può essere chiusa da uno dei tre.

with pol as (
  select tablename, string_agg(distinct cmd, ',') cmds
  from pg_policies where schemaname='public'
    and cmd in ('INSERT','UPDATE','ALL')
    and (roles @> array['authenticated']::name[] or roles @> array['public']::name[])
  group by tablename)
select p.tablename, p.cmds,
  string_agg(case when has_column_privilege('authenticated', format('public.%I',p.tablename), a.attname, 'INSERT') then a.attname end, ' ' order by a.attnum) ins,
  string_agg(case when has_column_privilege('authenticated', format('public.%I',p.tablename), a.attname, 'UPDATE') then a.attname end, ' ' order by a.attnum) upd,
  count(*) filter (where not has_column_privilege('authenticated', format('public.%I',p.tablename), a.attname, 'INSERT') or not has_column_privilege('authenticated', format('public.%I',p.tablename), a.attname, 'UPDATE')) ristrette
from pol p join pg_attribute a on a.attrelid = format('public.%I',p.tablename)::regclass and a.attnum>0 and not a.attisdropped
group by p.tablename, p.cmds order by 1;

-- Le policy, con la condizione (chi passa).
select tablename, policyname, cmd, regexp_replace(coalesce(with_check, qual, ''), '\s+', ' ', 'g') as condizione
from pg_policies
where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'ALL')
  and (roles @> array['authenticated']::name[] or roles @> array['public']::name[])
order by 1, 2;
