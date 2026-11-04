-- Verifica di 20261207110000 (Mario, 04/11): la scuola legge il nome di chi ha
-- certificato una presenza dei suoi studenti, anche un tutor disattivato e chi
-- ha cancellato l'account, e niente di più.
--
-- CONTROPROVA: su una replica nata senza la migrazione non parte (la funzione
-- non c'è). La 3 è il controllo che mostra il difetto di prima: la lettura
-- diretta di `profiles` non arriva alla lapide, in tutti e due i mondi.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('77777777-0000-0000-0000-0000000000a1', 'ref@cert.test'),
  ('77777777-0000-0000-0000-0000000000a2', 'tutor@cert.test'),
  ('77777777-0000-0000-0000-0000000000a4', 'ente@cert.test'),
  ('77777777-0000-0000-0000-0000000000b1', 'vera@cert.test'),
  ('77777777-0000-0000-0000-0000000000b2', 'altra@cert.test');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita, telefono) values
  ('77777777-0000-0000-0000-0000000000a1', 'referente_scuola', 'Rita', 'Referente', '1980-01-01', null),
  ('77777777-0000-0000-0000-0000000000a2', 'tutor_scuola', 'Tino', 'Tutor', '1981-01-01', '333111222'),
  ('77777777-0000-0000-0000-0000000000a4', 'istituzione', 'Elio', 'Ente', null, null),
  ('77777777-0000-0000-0000-0000000000b1', 'studente', 'Vera', 'Cert', '2008-01-01', null),
  ('77777777-0000-0000-0000-0000000000b2', 'studente', 'Alba', 'Altrove', '2008-01-01', null);
-- La lapide: un referente che si è cancellato. Il profilo resta, senza auth e
-- senza riga nello staff (20261202100000).
insert into public.profiles (id, ruolo, nome, cognome, cancellato_il) values
  ('77777777-0000-0000-0000-0000000000a3', 'referente_scuola', 'Giulia', 'Lapide', now());
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('TESTCRT1', 'Scuola Cert', 'MI', 'Liceo'), ('TESTCRT2', 'Altra Cert', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato) values ('dd000000-0000-0000-0000-0000000000f1', 'TESTCRT1', 'attiva');
insert into public.school_staff (scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da,
                                 puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni) values
  ('dd000000-0000-0000-0000-0000000000f1', '77777777-0000-0000-0000-0000000000a1', 'referente', true, '77777777-0000-0000-0000-0000000000a1', true, true, true, true),
  ('dd000000-0000-0000-0000-0000000000f1', '77777777-0000-0000-0000-0000000000a2', 'tutor', false, '77777777-0000-0000-0000-0000000000a1', false, false, true, false);
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica) values
  ('77777777-0000-0000-0000-0000000000b1', 'TESTCRT1', '5A', 2027, 'verificato'),
  ('77777777-0000-0000-0000-0000000000b2', 'TESTCRT2', '5A', 2027, 'verificato');
insert into public.istituzioni (id, nome, slug, tipo, stato) values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Ente Cert', 'ente-cert', 'its', 'attiva');
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
  ('e0000000-0000-0000-0000-0000000000f1', 'Uno', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'approvato', 'studenti'),
  ('e0000000-0000-0000-0000-0000000000f2', 'Due', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'approvato', 'studenti'),
  ('e0000000-0000-0000-0000-0000000000f3', 'Tre', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() - interval '1 days', now() - interval '1 days' + interval '1 hour', 'approvato', 'studenti');
insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, certificata_da_tipo, certificata_da_user, certificata_il, ore_riconosciute) values
  ('77777777-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000f1', 'partecipato', 'scuola', 'scuola', '77777777-0000-0000-0000-0000000000a2', now(), 1),
  ('77777777-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000f2', 'partecipato', 'scuola', 'scuola', '77777777-0000-0000-0000-0000000000a3', now(), 1),
  ('77777777-0000-0000-0000-0000000000b2', 'e0000000-0000-0000-0000-0000000000f3', 'partecipato', 'studente', 'ente', '77777777-0000-0000-0000-0000000000a4', now(), 1);

create function pg_temp.nomi_come(p_chi uuid) returns text language plpgsql as $$
declare v text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', p_chi::text, true);
  select coalesce(string_agg(nome || ' ' || cognome, ', ' order by cognome), '—') into v
    from public.nomi_dei_certificatori(array['77777777-0000-0000-0000-0000000000a2', '77777777-0000-0000-0000-0000000000a3', '77777777-0000-0000-0000-0000000000a4']::uuid[]);
  reset role;
  return v;
exception when others then
  reset role;
  return '!' || sqlerrm;
end $$;

-- 1. Il referente legge il tutor disattivato e la lapide, che hanno certificato i suoi studenti.
insert into esiti select 1, 'il referente legge chi ha certificato i suoi studenti, anche disattivato o cancellato',
  'Giulia Lapide, Tino Tutor', v, v = 'Giulia Lapide, Tino Tutor'
from (select pg_temp.nomi_come('77777777-0000-0000-0000-0000000000a1') v) x;

-- 2. …e non chi ha certificato lo studente di un'altra scuola (la 1 lo prova: l'ente non c'è).
insert into esiti select 2, 'il referente NON legge chi ha certificato uno studente di un''altra scuola',
  'Elio Ente assente', v, position('Elio' in v) = 0
from (select pg_temp.nomi_come('77777777-0000-0000-0000-0000000000a1') v) x;

-- 3. Il controllo: la strada di prima, `profiles` dal client, non arriva alla lapide.
do $$
declare v int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-0000000000a1', true);
  select count(*) into v from public.profiles where id in ('77777777-0000-0000-0000-0000000000a2', '77777777-0000-0000-0000-0000000000a3');
  reset role;
  insert into esiti values (3, 'controllo: dal client il referente non legge né il tutor disattivato né la lapide', '0', v::text, v = 0);
end $$;

-- 4. Uno studente non legge niente.
insert into esiti select 4, 'uno studente non legge nessun nome', '—', v, v = '—'
from (select pg_temp.nomi_come('77777777-0000-0000-0000-0000000000b1') v) x;

-- 5. Un visitatore non la esegue.
insert into esiti values (5, 'anon non la esegue', 'false',
  has_function_privilege('anon', 'public.nomi_dei_certificatori(uuid[])', 'execute')::text,
  not has_function_privilege('anon', 'public.nomi_dei_certificatori(uuid[])', 'execute'));

-- 6. Restituisce solo l'id, il nome e il cognome.
insert into esiti select 6, 'restituisce solo id, nome e cognome', 'user_id uuid, nome text, cognome text', r,
  r = 'TABLE(user_id uuid, nome text, cognome text)'
from (select pg_get_function_result('public.nomi_dei_certificatori(uuid[])'::regprocedure) r) x;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
