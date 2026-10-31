-- L'ESITO DELLA REGISTRAZIONE DI UNA DIRETTA (20261122100000).
--
-- Gira in una transazione con ROLLBACK, nel SQL Editor così com'è.
--
-- L'esito lo scrive solo la sonda del server (service role): il client lo legge
-- e non lo scrive, né l'ente né l'admin collegato. Esito e ora stanno insieme.
--
-- Rosse attese su una replica nata senza 20261122100000: 1, 2, 3, 5 (la colonna
-- non c'è). Verde nei due mondi: 4 (il client non aggiorna un evento approvato).

begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

insert into auth.users(id, email) values ('f1000000-0000-0000-0000-0000000000b1', 'ente-reg@prova.it');
insert into public.profiles(id, ruolo, nome, cognome) values ('f1000000-0000-0000-0000-0000000000b1', 'istituzione', 'E', 'Reg');
insert into public.istituzioni(id, nome, slug, tipo, stato, piano_id) values
  ('e1000000-0000-0000-0000-0000000000b1', 'Ente Reg', 'ente-reg', 'its', 'attiva', (select id from public.piani where nome = 'free'));
insert into public.institution_profiles(user_id, istituzione_id) values ('f1000000-0000-0000-0000-0000000000b1', 'e1000000-0000-0000-0000-0000000000b1');
insert into public.eventi(id, titolo, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, hosting_diretta, youtube_video_id,
  checklist_diretta, checklist_diretta_accettata_il)
values ('ab000000-0000-0000-0000-0000000000b1', 'Diretta finita', 'webinar', 'e1000000-0000-0000-0000-0000000000b1',
  now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'approvato', 'studenti', 'proprio', '5doxLWDlAJU',
  jsonb_build_object('non_in_elenco', now(), 'incorporamento_attivo', now(), 'chat_disattivata', now(), 'no_contenuti_terzi', now()), now());

-- La sonda (service role, qui postgres) scrive esito e ora insieme.
do $$ begin
  update public.eventi set registrazione_esito = 'disponibile', registrazione_sondata_il = now() where id = 'ab000000-0000-0000-0000-0000000000b1';
  insert into esiti values (1, 'la sonda scrive l''esito e l''ora', 'riuscito', true, 'riuscito');
exception when others then
  insert into esiti values (1, 'la sonda scrive l''esito e l''ora', 'riuscito', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  update public.eventi set registrazione_esito = 'non_trovata' where id = 'ab000000-0000-0000-0000-0000000000b1';
  update public.eventi set registrazione_sondata_il = null where id = 'ab000000-0000-0000-0000-0000000000b1';
  insert into esiti values (2, 'un esito senza la sua ora non si scrive', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (2, 'un esito senza la sua ora non si scrive', 'RESPINTO', sqlerrm like '%eventi_registrazione_sondata_con_data%', 'respinto: ' || sqlerrm);
end $$;

set local role anon;
do $$ declare v text; begin
  select registrazione_esito into v from public.eventi where id = 'ab000000-0000-0000-0000-0000000000b1';
  insert into esiti values (3, 'chi non ha fatto l''accesso legge l''esito (la card dei passati lo usa)', 'disponibile', v = 'disponibile', coalesce(v, 'null'));
exception when others then
  insert into esiti values (3, 'chi non ha fatto l''accesso legge l''esito (la card dei passati lo usa)', 'disponibile', false, 'errore: ' || sqlerrm);
end $$;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-0000000000b1';
do $$ begin
  update public.eventi set registrazione_esito = 'disponibile', registrazione_sondata_il = now() where id = 'ab000000-0000-0000-0000-0000000000b1';
  insert into esiti values (4, 'l''ente non scrive l''esito della propria registrazione', 'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (4, 'l''ente non scrive l''esito della propria registrazione', 'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

reset role;
do $$ begin
  insert into esiti values (5, 'nessun collegato ha il privilegio di scrivere l''esito', 'nessuno',
    not has_column_privilege('authenticated', 'public.eventi', 'registrazione_esito', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.eventi', 'registrazione_esito', 'INSERT')
    and has_column_privilege('authenticated', 'public.eventi', 'registrazione_esito', 'SELECT'),
    'update ' || has_column_privilege('authenticated', 'public.eventi', 'registrazione_esito', 'UPDATE')::text);
exception when others then
  insert into esiti values (5, 'nessun collegato ha il privilegio di scrivere l''esito', 'nessuno', false, 'errore: ' || sqlerrm);
end $$;

select n, proprieta, atteso, case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
