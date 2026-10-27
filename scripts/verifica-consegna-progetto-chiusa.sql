-- Verifica di 20261104130000 (Mario, 27/10): la consegna finale del progetto
-- non si chiama più dal client, e le strade vive dell'elaborato restano.
--
-- CONTROPROVA: su una replica nata senza la migrazione è rossa la 1 (la
-- funzione esiste e `authenticated` la esegue). La 2 e la 3 sono il controllo:
-- verdi in tutti e due i mondi, dicono che il drop non ha portato via le
-- funzioni che il prodotto usa davvero.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;

insert into esiti
select 1, 'consegna_progetto_workshop non esiste più', 'assente',
  case when to_regprocedure('public.consegna_progetto_workshop(uuid, jsonb)') is null then 'assente'
       else 'presente, authenticated la esegue: ' || has_function_privilege('authenticated', 'public.consegna_progetto_workshop(uuid, jsonb)', 'execute')::text end,
  to_regprocedure('public.consegna_progetto_workshop(uuid, jsonb)') is null;

insert into esiti
select 2, 'la consegna di una tappa resta, e authenticated la chiama', 'presente, eseguibile',
  coalesce(has_function_privilege('authenticated', p.oid, 'execute')::text, 'assente'),
  coalesce(has_function_privilege('authenticated', p.oid, 'execute'), false)
from (select to_regprocedure('public.consegna_fase_workshop(uuid, text, integer)') as oid) p;

insert into esiti
select 3, 'l''avanzamento del cron resta', 'presente',
  case when count(*) > 0 then 'presente' else 'assente' end, count(*) > 0
from pg_proc where proname = 'avanza_fase_workshop' and pronamespace = 'public'::regnamespace;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
