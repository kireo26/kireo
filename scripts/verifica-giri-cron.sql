-- Verifica di 20261209110000 (04/11): i giri dei cron li scrive e li legge solo
-- il server.
--
-- CONTROPROVA: su una replica nata senza la migrazione sono rosse tutte e quattro
-- (la tabella non c'è).
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;
create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;

insert into esiti select 1, 'il client non legge né scrive i giri', 'false', v::text, v is false
from (select case when to_regclass('public.giri_cron') is null then null else
  has_table_privilege('anon', 'public.giri_cron', 'SELECT') or has_table_privilege('authenticated', 'public.giri_cron', 'SELECT')
  or has_table_privilege('authenticated', 'public.giri_cron', 'INSERT') or has_table_privilege('authenticated', 'public.giri_cron', 'UPDATE') end v) x;

insert into esiti select 2, 'il server scrive e legge un giro', 'true', v::text, v is true
from (select case when to_regclass('public.giri_cron') is null then null else
  has_table_privilege('service_role', 'public.giri_cron', 'INSERT') and has_table_privilege('service_role', 'public.giri_cron', 'SELECT')
  and has_table_privilege('service_role', 'public.giri_cron', 'UPDATE') end v) x;

do $$
declare v text;
begin
  insert into public.giri_cron (processo, programmato) values ('cron/prova', true);
  begin
    update public.giri_cron set finito_il = partito_il - interval '1 minute' where processo = 'cron/prova';
    v := 'accettato';
  exception when check_violation then v := 'rifiutato';
  end;
  insert into esiti values (3, 'una fine prima dell''inizio si rifiuta', 'rifiutato', v, v = 'rifiutato');
exception when others then
  insert into esiti values (3, 'una fine prima dell''inizio si rifiuta', 'rifiutato', '!' || sqlerrm, false);
end $$;

insert into esiti select 4, 'la riga nasce con partito_il scritto dal database, e senza fine', 'true', v::text, v is true
from (select case when to_regclass('public.giri_cron') is null then null else
  (select partito_il is not null and finito_il is null from public.giri_cron where processo = 'cron/prova' limit 1) end v) x;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
