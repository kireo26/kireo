-- IL CONSENSO ALLE COMUNICAZIONI DI KIREO SI SCRIVE SOLO DALLA SUA FUNZIONE.
--
-- Prova la migrazione 20261107100000. Gira in una transazione con ROLLBACK.
-- Su una replica nata senza la migrazione si ferma al primo comando (la
-- colonna non c'è): la controprova delle singole proprietà si fa togliendo i
-- pezzi della funzione, non la migrazione intera.

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values ('c0c0c0c0-0000-0000-0000-00000000000c', 'consenso@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
  values ('c0c0c0c0-0000-0000-0000-00000000000c', 'studente', 'C', 'Onsenso', '2005-01-01');

-- 0) premessa: un profilo nuovo nasce senza risposta («mai chiesto»)
insert into esiti select 0, 'un profilo nuovo nasce senza risposta (NULL, non no)',
  'null/null', comunicazioni_kireo is null and comunicazioni_kireo_il is null,
  coalesce(comunicazioni_kireo::text, 'null') || '/' || coalesce(comunicazioni_kireo_il::text, 'null')
  from public.profiles where id = 'c0c0c0c0-0000-0000-0000-00000000000c';

set local role authenticated;
set local request.jwt.claim.sub = 'c0c0c0c0-0000-0000-0000-00000000000c';

-- 1) lo studente non scrive il consenso dal client, e 9) nemmeno la sua data.
-- Una colonna per prova: scritte insieme, il rifiuto di una copre l'altra (una
-- controprova che concedeva la sola prima restava verde).
do $$ begin
  update public.profiles set comunicazioni_kireo = true where id = auth.uid();
  insert into esiti values (1, 'lo studente scrive il consenso dal client', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (1, 'lo studente scrive il consenso dal client', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  update public.profiles set comunicazioni_kireo_il = now() - interval '1 year' where id = auth.uid();
  insert into esiti values (9, 'lo studente scrive la data del consenso dal client', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (9, 'lo studente scrive la data del consenso dal client', 'RESPINTO', sqlstate = '42501', 'respinto: ' || sqlerrm);
end $$;

-- 2) dalla registrazione, su una risposta che non c'è, scrive
do $$ declare v boolean; begin
  v := public.imposta_comunicazioni_kireo(true, 'registrazione');
  insert into esiti values (2, 'lo studente dice sì alla registrazione', 'true', v is true, coalesce(v::text, 'null'));
exception when others then
  insert into esiti values (2, 'lo studente dice sì alla registrazione', 'true', false, 'respinto: ' || sqlerrm);
end $$;

-- 3) dal profilo cambia, e la data la mette il server
do $$ declare v boolean; begin
  v := public.imposta_comunicazioni_kireo(false, 'profilo');
  insert into esiti values (3, 'lo studente dice no dal profilo', 'false', v is false, coalesce(v::text, 'null'));
exception when others then
  insert into esiti values (3, 'lo studente dice no dal profilo', 'false', false, 'respinto: ' || sqlerrm);
end $$;

-- 4) una seconda conferma dell'email non sovrascrive la scelta fatta dopo
do $$ declare v boolean; begin
  v := public.imposta_comunicazioni_kireo(true, 'registrazione');
  insert into esiti values (4, 'lo studente riconferma l''email: il «no» dato dopo dal profilo resta', 'false', v is false, coalesce(v::text, 'null'));
exception when others then
  insert into esiti values (4, 'lo studente riconferma l''email: il «no» dato dopo dal profilo resta', 'false', false, 'respinto: ' || sqlerrm);
end $$;

-- 5) un'origine inventata si rifiuta
do $$ begin
  perform public.imposta_comunicazioni_kireo(true, 'ente');
  insert into esiti values (5, 'lo studente passa un''origine inventata', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (5, 'lo studente passa un''origine inventata', 'RESPINTO', sqlerrm like '%origine_non_valida%', 'respinto: ' || sqlerrm);
end $$;

reset role;

-- 6) la data è del server: è di oggi, non di un anno fa
insert into esiti select 6, 'la data del consenso la mette il server', 'oggi',
  comunicazioni_kireo_il > now() - interval '1 hour', coalesce(comunicazioni_kireo_il::text, 'null')
  from public.profiles where id = 'c0c0c0c0-0000-0000-0000-00000000000c';

-- 7) anon non la esegue
insert into esiti select 7, 'anon esegue la funzione del consenso', 'false',
  not has_function_privilege('anon', 'public.imposta_comunicazioni_kireo(boolean, text)', 'execute'),
  has_function_privilege('anon', 'public.imposta_comunicazioni_kireo(boolean, text)', 'execute')::text;

-- 8) controllo: lo studente legge ancora il proprio consenso
set local role authenticated;
set local request.jwt.claim.sub = 'c0c0c0c0-0000-0000-0000-00000000000c';
do $$ declare v boolean; begin
  select comunicazioni_kireo into v from public.profiles where id = auth.uid();
  insert into esiti values (8, 'lo studente legge il proprio consenso', 'false', v is false, coalesce(v::text, 'null'));
exception when others then
  insert into esiti values (8, 'lo studente legge il proprio consenso', 'false', false, 'respinto: ' || sqlerrm);
end $$;
reset role;

-- 10) la seconda protezione, provata da sola. Sulle due colonne ce ne sono due
-- sovrapposte: il privilegio revocato (la §1 e la §9, che accettano SOLO
-- 42501) e il CHECK che pretende la data insieme alla risposta. Una prova sola
-- su due protezioni racconta quella esterna e tace sull'altra (Mario, 28/10),
-- quindi il CHECK si prova da postgres, dove il privilegio non c'è: se un
-- giorno si allenta, è questa che diventa rossa, non la §1.
do $$ begin
  update public.profiles set comunicazioni_kireo = true, comunicazioni_kireo_il = null
   where id = 'c0c0c0c0-0000-0000-0000-00000000000c';
  insert into esiti values (10, 'una risposta senza la sua data (da postgres, oltre il privilegio)', 'RESPINTO dal CHECK', false, '*** PASSA ***');
exception when others then
  insert into esiti values (10, 'una risposta senza la sua data (da postgres, oltre il privilegio)', 'RESPINTO dal CHECK', sqlstate = '23514', sqlstate || ': ' || sqlerrm);
end $$;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
