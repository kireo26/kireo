-- Verifica di 20261209100000 (Mario, 04/11): l'ente legge solo nome e cognome
-- dello studente con cui conversa e del docente iscritto a un suo evento per
-- docenti, e niente di un altro ente.
--
-- CONTROPROVA: su una replica nata senza la migrazione la 1 e la 2 sono rosse
-- (le due policy lasciano leggere data di nascita e telefono: il difetto di
-- prima) e lo sono anche la 3-7, perché le funzioni non ci sono. Verde solo il
-- controllo (8).
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('79999999-0000-0000-0000-0000000000e1', 'ente@nomi.test'),
  ('79999999-0000-0000-0000-0000000000e2', 'altroente@nomi.test'),
  ('79999999-0000-0000-0000-0000000000b1', 'stu@nomi.test'),
  ('79999999-0000-0000-0000-0000000000b2', 'stualtro@nomi.test'),
  ('79999999-0000-0000-0000-0000000000d1', 'doc@nomi.test');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita, telefono) values
  ('79999999-0000-0000-0000-0000000000e1', 'istituzione', 'Elio', 'Ente', '1980-01-01', null),
  ('79999999-0000-0000-0000-0000000000e2', 'istituzione', 'Aldo', 'Altro', '1980-01-01', null),
  ('79999999-0000-0000-0000-0000000000b1', 'studente', 'Stella', 'Scrive', '2008-01-01', '333999000'),
  ('79999999-0000-0000-0000-0000000000b2', 'studente', 'Bruno', 'Altrove', '2008-01-01', '333999111'),
  ('79999999-0000-0000-0000-0000000000d1', 'docente', 'Dario', 'Docente', '1975-01-01', '333999222');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('79999999-1111-0000-0000-0000000000f1', 'Ente Nomi', 'ente-nomi', 'universita', 'attiva'),
  ('79999999-1111-0000-0000-0000000000f2', 'Ente Altro', 'ente-altro-nomi', 'universita', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('79999999-0000-0000-0000-0000000000e1', '79999999-1111-0000-0000-0000000000f1'),
  ('79999999-0000-0000-0000-0000000000e2', '79999999-1111-0000-0000-0000000000f2');
insert into public.conversazioni_enti (id, student_id, istituzione_id) values
  ('79999999-2222-0000-0000-0000000000a1', '79999999-0000-0000-0000-0000000000b1', '79999999-1111-0000-0000-0000000000f1'),
  ('79999999-2222-0000-0000-0000000000a2', '79999999-0000-0000-0000-0000000000b2', '79999999-1111-0000-0000-0000000000f2');
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, filone) values
  ('79999999-3333-0000-0000-0000000000a1', 'Webinar docenti', 'x', 'webinar', '79999999-1111-0000-0000-0000000000f1', now() + interval '3 days', now() + interval '3 days 1 hour', 'approvato', 'docenti', 'ai_didattica'),
  ('79999999-3333-0000-0000-0000000000a2', 'Webinar docenti altrove', 'x', 'webinar', '79999999-1111-0000-0000-0000000000f2', now() + interval '3 days', now() + interval '3 days 1 hour', 'approvato', 'docenti', 'ai_didattica');
insert into public.iscrizioni_eventi (evento_id, student_id, stato) values
  ('79999999-3333-0000-0000-0000000000a1', '79999999-0000-0000-0000-0000000000d1', 'iscritto'),
  ('79999999-3333-0000-0000-0000000000a2', '79999999-0000-0000-0000-0000000000d1', 'iscritto');

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

-- 1. L'ente non legge data di nascita e telefono dello studente con cui conversa.
insert into esiti select 1, 'l''ente non legge data di nascita e telefono di chi gli scrive', '—', v, v = '—'
from (select pg_temp.come('79999999-0000-0000-0000-0000000000e1',
  $q$select string_agg(coalesce(data_nascita::text, '') || '/' || coalesce(telefono, ''), ',') from public.profiles where id = '79999999-0000-0000-0000-0000000000b1'$q$) v) x;

-- 2. …né quelli del docente iscritto a un suo evento per docenti.
insert into esiti select 2, 'l''ente non legge data di nascita e telefono di un docente iscritto', '—', v, v = '—'
from (select pg_temp.come('79999999-0000-0000-0000-0000000000e1',
  $q$select string_agg(coalesce(data_nascita::text, '') || '/' || coalesce(telefono, ''), ',') from public.profiles where id = '79999999-0000-0000-0000-0000000000d1'$q$) v) x;

-- 3. Legge il nome di chi gli scrive, e solo delle sue conversazioni.
insert into esiti select 3, 'l''ente legge il nome di chi gli scrive, non di chi scrive a un altro', 'Stella Scrive', v, v = 'Stella Scrive'
from (select pg_temp.come('79999999-0000-0000-0000-0000000000e1',
  $q$select string_agg(nome || ' ' || cognome, ', ') from public.nomi_degli_studenti_in_conversazione()$q$) v) x;

-- 4. Legge il nome del docente iscritto al suo evento.
insert into esiti select 4, 'l''ente legge il nome del docente iscritto al suo evento', 'Dario Docente', v, v = 'Dario Docente'
from (select pg_temp.come('79999999-0000-0000-0000-0000000000e1',
  $q$select string_agg(nome || ' ' || cognome, ', ') from public.nomi_dei_docenti_iscritti('79999999-3333-0000-0000-0000000000a1')$q$) v) x;

-- 5. Non quello dell'evento di un altro ente (lo stesso docente).
insert into esiti select 5, 'l''ente non legge i docenti iscritti all''evento di un altro', '—', v, v = '—'
from (select pg_temp.come('79999999-0000-0000-0000-0000000000e1',
  $q$select string_agg(nome, ',') from public.nomi_dei_docenti_iscritti('79999999-3333-0000-0000-0000000000a2')$q$) v) x;

-- 6. Uno studente non usa nessuna delle due porte.
insert into esiti select 6, 'uno studente non legge niente da qui', '—|—', v, v = '—|—'
from (select pg_temp.come('79999999-0000-0000-0000-0000000000b1',
  $q$select coalesce((select string_agg(nome, ',') from public.nomi_degli_studenti_in_conversazione()), '—') || '|' || coalesce((select string_agg(nome, ',') from public.nomi_dei_docenti_iscritti('79999999-3333-0000-0000-0000000000a1')), '—')$q$) v) x;

-- 7. Un visitatore non le esegue (e se mancano, è rossa).
insert into esiti select 7, 'anon non esegue nessuna delle due', 'false', v::text, v is false
from (select case when to_regprocedure('public.nomi_degli_studenti_in_conversazione()') is null or to_regprocedure('public.nomi_dei_docenti_iscritti(uuid)') is null then null
  else has_function_privilege('anon', 'public.nomi_degli_studenti_in_conversazione()', 'execute') or has_function_privilege('anon', 'public.nomi_dei_docenti_iscritti(uuid)', 'execute') end v) x;

-- 8. Il controllo: lo studente legge ancora il proprio telefono.
insert into esiti select 8, 'controllo: lo studente legge ancora il proprio telefono', '333999000', v, v = '333999000'
from (select pg_temp.come('79999999-0000-0000-0000-0000000000b1',
  $q$select telefono from public.profiles where id = '79999999-0000-0000-0000-0000000000b1'$q$) v) x;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
