-- L'USCITA DALLE COMUNICAZIONI DI KIREO VALE PER CHI HA RICEVUTO L'EMAIL.
--
-- Prova la migrazione 20261126100000. Il caso di Mario, rifatto: l'email è di
-- A, nel browser è collegato B, e il ritiro con il codice di A deve toccare A e
-- lasciare B com'era. Gira in una transazione con ROLLBACK.

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('c1c1c1c1-0000-0000-0000-00000000000a', 'riceve@prova.it'),
  ('c1c1c1c1-0000-0000-0000-00000000000b', 'collegato@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita) values
  ('c1c1c1c1-0000-0000-0000-00000000000a', 'studente', 'A', 'Riceve', '2005-01-01'),
  ('c1c1c1c1-0000-0000-0000-00000000000b', 'studente', 'B', 'Collegato', '2005-01-01');
update public.profiles set comunicazioni_kireo = true, comunicazioni_kireo_il = now() - interval '10 days'
 where id in ('c1c1c1c1-0000-0000-0000-00000000000a', 'c1c1c1c1-0000-0000-0000-00000000000b');

-- 1) un profilo nuovo nasce con il suo codice (il trigger)
insert into esiti select 1, 'un profilo nuovo nasce con il suo codice', '2 codici', count(*) = 2, count(*)::text
  from public.codici_consenso_kireo
 where profile_id in ('c1c1c1c1-0000-0000-0000-00000000000a', 'c1c1c1c1-0000-0000-0000-00000000000b');

-- 2) la pagina legge lo stato dal codice di A
insert into esiti select 2, 'il codice di A dice lo stato di A', 'true', i.consenso is true, coalesce(i.consenso::text, 'null')
  from public.codici_consenso_kireo c, lateral public.consenso_kireo_con_codice_info(c.codice) i
 where c.profile_id = 'c1c1c1c1-0000-0000-0000-00000000000a';

-- 3) il caso di Mario: B è collegato, il codice è di A. Il ritiro tocca A…
do $$ declare v boolean; begin
  perform set_config('request.jwt.claim.sub', 'c1c1c1c1-0000-0000-0000-00000000000b', true);
  v := public.ritira_consenso_kireo_con_codice(
         (select codice from public.codici_consenso_kireo where profile_id = 'c1c1c1c1-0000-0000-0000-00000000000a'));
  insert into esiti select 3, 'il ritiro con il codice di A tocca A, con un collegato B', 'true / A false',
    v is true and comunicazioni_kireo is false and comunicazioni_kireo_il > now() - interval '1 minute',
    coalesce(v::text, 'null') || ' / A ' || coalesce(comunicazioni_kireo::text, 'null')
    from public.profiles where id = 'c1c1c1c1-0000-0000-0000-00000000000a';
end $$;

-- 4) …e lascia B com'era
insert into esiti select 4, 'B, il collegato, resta com''era', 'true, data vecchia',
  comunicazioni_kireo is true and comunicazioni_kireo_il < now() - interval '9 days',
  coalesce(comunicazioni_kireo::text, 'null')
  from public.profiles where id = 'c1c1c1c1-0000-0000-0000-00000000000b';

-- 5) un codice che non c'è non tocca niente, e lo dice
insert into esiti select 5, 'un codice inventato non tocca niente', 'false',
  public.ritira_consenso_kireo_con_codice('00000000-0000-0000-0000-000000000000') is false, 'falso atteso';

-- 6) il client non legge i codici (sono una chiave per ritirare il consenso di qualcuno)
insert into esiti select 6, 'il client non legge i codici', 'nessun privilegio',
  not has_table_privilege('authenticated', 'public.codici_consenso_kireo', 'SELECT')
  and not has_table_privilege('anon', 'public.codici_consenso_kireo', 'SELECT'), 'privilegi letti';

-- 7) e non esegue le due funzioni: le chiama solo il server
insert into esiti select 7, 'le funzioni del codice non le esegue il client', 'nessun privilegio',
  not has_function_privilege('anon', 'public.ritira_consenso_kireo_con_codice(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.ritira_consenso_kireo_con_codice(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.consenso_kireo_con_codice_info(uuid)', 'execute'), 'privilegi letti';

-- 8) la coda della newsletter porta il codice di chi la riceve
insert into esiti select 8, 'la coda della newsletter ha la colonna del codice', 'presente',
  exists (select 1 from pg_proc p where p.proname = 'newsletter_da_inviare'
           and pg_get_function_result(p.oid) like '%codice_consenso uuid%'), 'firma letta';

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
