-- Verifica di 20261208100000 (Mario, 04/11): un collega di staff si legge solo
-- per nome e cognome, anche disattivato; e la scuola legge chi ha verificato un
-- suo studente, niente di più.
--
-- CONTROPROVA: su una replica nata senza la migrazione la 1 è rossa (la policy
-- lascia leggere data di nascita e telefono di un collega attivo) e le altre non
-- partono (le funzioni non ci sono). La 1 è anche il difetto di prima.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('78888888-0000-0000-0000-0000000000a1', 'ref@coll.test'),
  ('78888888-0000-0000-0000-0000000000a2', 'tutor@coll.test'),
  ('78888888-0000-0000-0000-0000000000a5', 'spento@coll.test'),
  ('78888888-0000-0000-0000-0000000000a6', 'altroref@coll.test'),
  ('78888888-0000-0000-0000-0000000000b1', 'vera@coll.test'),
  ('78888888-0000-0000-0000-0000000000b2', 'alba@coll.test'),
  ('78888888-0000-0000-0000-0000000000b3', 'dora@coll.test');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita, telefono) values
  ('78888888-0000-0000-0000-0000000000a1', 'referente_scuola', 'Rita', 'Referente', '1980-01-01', '333000111'),
  ('78888888-0000-0000-0000-0000000000a2', 'tutor_scuola', 'Tino', 'Tutor', '1981-01-01', '333111222'),
  ('78888888-0000-0000-0000-0000000000a5', 'tutor_scuola', 'Sara', 'Spenta', '1982-01-01', '333222333'),
  ('78888888-0000-0000-0000-0000000000a6', 'referente_scuola', 'Otto', 'Altrove', '1979-01-01', null),
  ('78888888-0000-0000-0000-0000000000b1', 'studente', 'Vera', 'Verificata', '2008-01-01', null),
  ('78888888-0000-0000-0000-0000000000b2', 'studente', 'Alba', 'Altrove', '2008-01-01', null),
  ('78888888-0000-0000-0000-0000000000b3', 'studente', 'Dora', 'Dichiarata', '2008-01-01', null);
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('TESTCOL1', 'Scuola Col', 'MI', 'Liceo'), ('TESTCOL2', 'Altra Col', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato) values
  ('de000000-0000-0000-0000-0000000000f1', 'TESTCOL1', 'attiva'),
  ('de000000-0000-0000-0000-0000000000f2', 'TESTCOL2', 'attiva');
insert into public.school_staff (scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da,
                                 puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni) values
  ('de000000-0000-0000-0000-0000000000f1', '78888888-0000-0000-0000-0000000000a1', 'referente', true, '78888888-0000-0000-0000-0000000000a1', true, true, true, true),
  ('de000000-0000-0000-0000-0000000000f1', '78888888-0000-0000-0000-0000000000a2', 'tutor', true, '78888888-0000-0000-0000-0000000000a1', true, false, false, false),
  ('de000000-0000-0000-0000-0000000000f1', '78888888-0000-0000-0000-0000000000a5', 'tutor', false, '78888888-0000-0000-0000-0000000000a1', false, false, false, false),
  ('de000000-0000-0000-0000-0000000000f2', '78888888-0000-0000-0000-0000000000a6', 'referente', true, '78888888-0000-0000-0000-0000000000a6', true, true, true, true);
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica, verificato_da, verificato_il) values
  ('78888888-0000-0000-0000-0000000000b1', 'TESTCOL1', '5A', 2027, 'verificato', '78888888-0000-0000-0000-0000000000a5', now()),
  ('78888888-0000-0000-0000-0000000000b2', 'TESTCOL2', '5A', 2027, 'verificato', '78888888-0000-0000-0000-0000000000a6', now()),
  ('78888888-0000-0000-0000-0000000000b3', 'TESTCOL1', '5A', 2027, 'dichiarato', null, null);

create function pg_temp.come(p_chi uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', p_chi::text, true);
  execute p_sql into v;
  reset role;
  return coalesce(v, '—');
exception when others then
  reset role;
  return '!' || sqlerrm;
end $$;

-- 1. Il tutor non legge la data di nascita né il telefono del referente.
insert into esiti select 1, 'il tutor non legge data di nascita e telefono di un collega', '—', v, v = '—'
from (select pg_temp.come('78888888-0000-0000-0000-0000000000a2',
  $q$select string_agg(coalesce(data_nascita::text, '') || '/' || coalesce(telefono, ''), ',') from public.profiles where id = '78888888-0000-0000-0000-0000000000a1'$q$) v) x;

-- 2. Il referente legge i nomi di tutto il suo staff, anche la tutor disattivata.
insert into esiti select 2, 'il referente legge i nomi dello staff, anche chi è disattivato',
  'Rita Referente, Sara Spenta, Tino Tutor', v, v = 'Rita Referente, Sara Spenta, Tino Tutor'
from (select pg_temp.come('78888888-0000-0000-0000-0000000000a1',
  $q$select string_agg(nome || ' ' || cognome, ', ' order by cognome) from public.nomi_dello_staff()$q$) v) x;

-- 3. …e non quelli di un'altra scuola (la 2 lo prova: Otto non c'è), né lo vede uno studente.
insert into esiti select 3, 'uno studente non legge nessun nome dello staff', '—', v, v = '—'
from (select pg_temp.come('78888888-0000-0000-0000-0000000000b1',
  $q$select string_agg(nome, ',') from public.nomi_dello_staff()$q$) v) x;

-- 4. Chi ha verificato: il tutor legge il nome della collega disattivata che ha verificato Vera.
insert into esiti select 4, 'il tutor legge chi ha verificato un suo studente, anche se disattivata', 'Sara Spenta', v, v = 'Sara Spenta'
from (select pg_temp.come('78888888-0000-0000-0000-0000000000a2',
  $q$select string_agg(nome || ' ' || cognome, ',') from public.verificatore_dello_studente('78888888-0000-0000-0000-0000000000b1')$q$) v) x;

-- 5. Non chi ha verificato uno studente di un'altra scuola.
insert into esiti select 5, 'non legge chi ha verificato uno studente di un''altra scuola', '—', v, v = '—'
from (select pg_temp.come('78888888-0000-0000-0000-0000000000a2',
  $q$select string_agg(nome, ',') from public.verificatore_dello_studente('78888888-0000-0000-0000-0000000000b2')$q$) v) x;

-- 6. Uno studente solo dichiarato non ha un verificatore.
insert into esiti select 6, 'uno studente solo dichiarato non ha nessun verificatore', '—', v, v = '—'
from (select pg_temp.come('78888888-0000-0000-0000-0000000000a1',
  $q$select string_agg(nome, ',') from public.verificatore_dello_studente('78888888-0000-0000-0000-0000000000b3')$q$) v) x;

-- 7. Lo studente stesso non legge chi l'ha verificato da qui.
insert into esiti select 7, 'lo studente non usa questa porta', '—', v, v = '—'
from (select pg_temp.come('78888888-0000-0000-0000-0000000000b1',
  $q$select string_agg(nome, ',') from public.verificatore_dello_studente('78888888-0000-0000-0000-0000000000b1')$q$) v) x;

-- 8. Un visitatore non esegue nessuna delle due (e se mancano, è rossa).
insert into esiti select 8, 'anon non esegue nessuna delle due', 'false', v::text, v is false
from (select case when to_regprocedure('public.nomi_dello_staff()') is null or to_regprocedure('public.verificatore_dello_studente(uuid)') is null then null
  else has_function_privilege('anon', 'public.nomi_dello_staff()', 'execute') or has_function_privilege('anon', 'public.verificatore_dello_studente(uuid)', 'execute') end v) x;

-- 9. Il controllo: il proprio profilo si legge ancora per intero.
insert into esiti select 9, 'controllo: il tutor legge ancora il proprio telefono', '333111222', v, v = '333111222'
from (select pg_temp.come('78888888-0000-0000-0000-0000000000a2',
  $q$select telefono from public.profiles where id = '78888888-0000-0000-0000-0000000000a2'$q$) v) x;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
