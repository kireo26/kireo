-- Verifica di 20261108110000 (28/10): una «comunicazione mirata» non si scrive
-- più, da nessuna strada; una newsletter sì.
--
-- OGNI ROSSO DICE QUALE PROTEZIONE GUARDA (Mario, 28/10: una controprova vale
-- solo se il rosso è quello che aspettava). Sulla colonna `tipo` ci sono due
-- cose: la policy di insert dell'ente (che non guarda il tipo) e il vincolo.
-- Le prove 2 e 3 pretendono il codice del vincolo, 23514: un rifiuto per un
-- altro motivo (un privilegio, una policy, una fixture rotta) NON le fa verdi.
--
-- LA CONTROPROVA, su una replica NATA SENZA la migrazione: rosse la 2 e la 3
-- (l'insert riesce), verdi la 1 e la 4 (il controllo: la newsletter si scrive
-- comunque).
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values ('11111111-0000-0000-0000-0000000000c1', 'ente-com@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000c1', 'istituzione', 'E', 'Com', '1980-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'Ente Com', 'ente-com', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1');

-- Dal client, come il form dell'ente.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-0000-0000-0000-0000000000c1';

do $$ begin
  insert into public.comunicazioni (istituzione_id, tipo, oggetto, corpo, stato)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'newsletter', 'o', 'c', 'in_approvazione');
  insert into esiti values (1, 'l''ente propone una newsletter dal client (controllo)', 'riuscito', 'riuscito', true);
exception when others then
  insert into esiti values (1, 'l''ente propone una newsletter dal client (controllo)', 'riuscito', sqlstate || ' ' || sqlerrm, false);
end $$;

do $$ begin
  insert into public.comunicazioni (istituzione_id, tipo, oggetto, corpo, stato)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'comunicazione_kireo', 'o', 'c', 'in_approvazione');
  insert into esiti values (2, 'l''ente non scrive una comunicazione mirata dal client', '23514', 'riuscito', false);
exception when others then
  insert into esiti values (2, 'l''ente non scrive una comunicazione mirata dal client', '23514', sqlstate, sqlstate = '23514');
end $$;

reset role;
set local role postgres;

-- Il vincolo vale anche dove la policy non c'entra: dal SQL Editor.
do $$ begin
  insert into public.comunicazioni (istituzione_id, tipo, oggetto, corpo, stato)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'comunicazione_kireo', 'o', 'c', 'approvata');
  insert into esiti values (3, 'nemmeno dal SQL Editor (il vincolo, non la policy)', '23514', 'riuscito', false);
exception when others then
  insert into esiti values (3, 'nemmeno dal SQL Editor (il vincolo, non la policy)', '23514', sqlstate, sqlstate = '23514');
end $$;

do $$ begin
  insert into public.comunicazioni (istituzione_id, tipo, oggetto, corpo, stato)
  values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'newsletter', 'o', 'c', 'approvata');
  insert into esiti values (4, 'dal SQL Editor una newsletter si scrive (controllo)', 'riuscito', 'riuscito', true);
exception when others then
  insert into esiti values (4, 'dal SQL Editor una newsletter si scrive (controllo)', 'riuscito', sqlstate || ' ' || sqlerrm, false);
end $$;

select n, cosa, atteso, trovato, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
