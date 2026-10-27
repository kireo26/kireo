-- Verifica di 20261104150000 (Mario, 27/10): il conto di quello che paghiamo
-- somma, per giorno e processo, e lo scrive solo la service-role.
--
-- CONTROPROVA: su una replica nata senza la migrazione lo script si ferma al
-- primo comando (la funzione non esiste), e `sql:tutti` lo conta rosso.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to authenticated, service_role;

-- 1 · due chiamate dello stesso processo si sommano in una riga.
set local role service_role;
select public.registra_consumo_ai('prova/somma', 'modello-x', false, 100, 20, 0, 5);
select public.registra_consumo_ai('prova/somma', 'modello-x', false, 50, 10, 7, 0);
set local role postgres;
insert into esiti
select 1, 'due chiamate dello stesso processo fanno una riga sommata', '1 riga, 2 chiamate, 150/30/7/5',
  count(*) || ' righe, ' || coalesce(max(chiamate), 0) || ' chiamate, ' || coalesce(max(token_input), 0) || '/' || coalesce(max(token_output), 0) || '/' || coalesce(max(token_cache_scrittura), 0) || '/' || coalesce(max(token_cache_lettura), 0),
  count(*) = 1 and max(chiamate) = 2 and max(token_input) = 150 and max(token_output) = 30 and max(token_cache_scrittura) = 7 and max(token_cache_lettura) = 5
from public.consumo_ai_giorno where processo = 'prova/somma';

-- 2 · il giorno è quello italiano.
insert into esiti
select 2, 'il giorno è in ora italiana', ((now() at time zone 'Europe/Rome')::date)::text, max(giorno)::text,
  max(giorno) = (now() at time zone 'Europe/Rome')::date
from public.consumo_ai_giorno where processo = 'prova/somma';

-- 3 · i profili di prova stanno in una riga a parte.
set local role service_role;
select public.registra_consumo_ai('prova/somma', 'modello-x', true, 1, 1, 0, 0);
set local role postgres;
insert into esiti
select 3, 'i profili di prova non si mescolano con la produzione', '2 righe', count(*) || ' righe', count(*) = 2
from public.consumo_ai_giorno where processo = 'prova/somma';

-- 4 · uno studente collegato non scrive il conto.
set local role authenticated;
do $$
declare v_esito text := 'scritto';
begin
  begin
    perform public.registra_consumo_ai('prova/client', 'modello-x', false, 1, 1, 0, 0);
  exception when others then v_esito := sqlstate;
  end;
  insert into esiti values (4, 'authenticated non esegue registra_consumo_ai', '42501', v_esito, v_esito = '42501');
end $$;

-- 5 · e non legge la tabella.
do $$
declare v_esito text := 'letta';
begin
  begin
    perform 1 from public.consumo_ai_giorno limit 1;
  exception when others then v_esito := sqlstate;
  end;
  insert into esiti values (5, 'authenticated non legge il conto', '42501', v_esito, v_esito = '42501');
end $$;

-- 6 · un consumo negativo si rifiuta (abbasserebbe il conto).
set local role service_role;
do $$
declare v_esito text := 'scritto';
begin
  begin
    perform public.registra_consumo_ai('prova/somma', 'modello-x', false, -500, 0, 0, 0);
  exception when others then v_esito := sqlerrm;
  end;
  insert into esiti values (6, 'un consumo negativo si rifiuta', 'consumo_negativo', v_esito, v_esito = 'consumo_negativo');
end $$;

set local role postgres;
select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
