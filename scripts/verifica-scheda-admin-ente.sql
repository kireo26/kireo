-- LA PAGINA DI UN ENTE NELL'AREA ADMIN (20261127100000).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
--
-- Rosse attese su una replica nata senza 20261127100000: tutte (la funzione
-- non c'è). Con la divisione tolta (un conto solo) è rossa la 2.

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values
  ('ad000000-0000-0000-0000-0000000000d1', 'admin-scheda@prova.it'),
  ('f1000000-0000-0000-0000-0000000000d1', 'ente-scheda@prova.it'),
  ('51000000-0000-0000-0000-0000000000d1', 'stud-scheda@prova.it'),
  ('d0000000-0000-0000-0000-0000000000d1', 'doc-scheda@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita) values
  ('ad000000-0000-0000-0000-0000000000d1', 'admin', 'A', 'Dmin', null),
  ('f1000000-0000-0000-0000-0000000000d1', 'istituzione', 'Rita', 'Ente', null),
  ('51000000-0000-0000-0000-0000000000d1', 'studente', 'S', 'Tud', '2008-01-01'),
  ('d0000000-0000-0000-0000-0000000000d1', 'docente', 'D', 'Oc', null);
insert into public.istituzioni(id, nome, slug, tipo, stato, piano_id) values
  ('e1000000-0000-0000-0000-0000000000d1', 'Ente Scheda', 'ente-scheda', 'its', 'attiva', (select id from public.piani where nome = 'free'));
insert into public.institution_profiles(user_id, istituzione_id) values
  ('f1000000-0000-0000-0000-0000000000d1', 'e1000000-0000-0000-0000-0000000000d1');
insert into public.seguiti(student_id, istituzione_id) values
  ('51000000-0000-0000-0000-0000000000d1', 'e1000000-0000-0000-0000-0000000000d1'),
  ('d0000000-0000-0000-0000-0000000000d1', 'e1000000-0000-0000-0000-0000000000d1');

set local role authenticated;
set local request.jwt.claim.sub = 'ad000000-0000-0000-0000-0000000000d1';

do $$ declare v jsonb; begin
  v := public.scheda_admin_ente('e1000000-0000-0000-0000-0000000000d1');
  insert into esiti values (1, 'l''admin legge la scheda di un ente', 'un oggetto', v is not null, coalesce(v::text, 'null'));
  insert into esiti values (2, 'chi segue si conta diviso: studenti e altri', '1 e 1',
    (v ->> 'seguaci_studenti') = '1' and (v ->> 'seguaci_altri') = '1', coalesce(v::text, 'null'));
  insert into esiti values (3, 'gli account dell''ente con nome ed email', 'Rita, ente-scheda@prova.it',
    jsonb_array_length(v -> 'account') = 1 and (v -> 'account' -> 0 ->> 'email') = 'ente-scheda@prova.it' and (v -> 'account' -> 0 ->> 'nome') = 'Rita',
    coalesce((v -> 'account')::text, 'null'));
exception when others then
  insert into esiti values (1, 'l''admin legge la scheda di un ente', 'un oggetto', false, 'errore: ' || sqlerrm);
end $$;

do $$ declare v jsonb; begin
  v := public.scheda_admin_ente('e9990000-0000-0000-0000-000000000000');
  insert into esiti values (4, 'un ente che non esiste dà null, non zeri', 'null', v is null, coalesce(v::text, 'null'));
exception when others then
  insert into esiti values (4, 'un ente che non esiste dà null, non zeri', 'null', false, 'errore: ' || sqlerrm);
end $$;

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000d1';
do $$ begin
  perform public.scheda_admin_ente('e1000000-0000-0000-0000-0000000000d1');
  insert into esiti values (5, 'l''ente stesso non la legge', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (5, 'l''ente stesso non la legge', 'RESPINTO', sqlerrm = 'non_autorizzato', 'respinto: ' || sqlerrm);
end $$;

reset role;
do $$ begin
  insert into esiti values (6, 'un visitatore non la esegue', 'false',
    not has_function_privilege('anon', 'public.scheda_admin_ente(uuid)', 'execute'), 'controllato');
exception when others then
  insert into esiti values (6, 'un visitatore non la esegue', 'false', false, 'errore: ' || sqlerrm);
end $$;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
