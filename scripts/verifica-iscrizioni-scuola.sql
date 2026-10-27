-- Verifica di 20261103130000 (Mario, 27/10): le iscrizioni d'ufficio dicono
-- quanti sono entrati, quanti no e perché.
--
-- CONTROPROVA: su una replica nata senza la migrazione le funzioni rispondono
-- `void`, quindi sono rosse la 1, 2, 3 e 4 (l'esito non c'è). La 5 è verde
-- anche prima: l'iscrizione stessa non cambia.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-0000000000b1', 'ente-isc@test.it'),
  ('33333333-0000-0000-0000-0000000000b1', 'ref-isc@test.it'),
  ('22222222-0000-0000-0000-0000000000b1', 'ver1-isc@test.it'),
  ('22222222-0000-0000-0000-0000000000b2', 'ver2-isc@test.it'),
  ('22222222-0000-0000-0000-0000000000b3', 'nonver-isc@test.it'),
  ('22222222-0000-0000-0000-0000000000b4', 'altra-isc@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-0000000000b1', 'istituzione', 'E', 'Isc', '1980-01-01'),
  ('33333333-0000-0000-0000-0000000000b1', 'referente_scuola', 'Ref', 'Isc', '1980-01-01'),
  ('22222222-0000-0000-0000-0000000000b1', 'studente', 'V', 'Uno', '2008-01-01'),
  ('22222222-0000-0000-0000-0000000000b2', 'studente', 'V', 'Due', '2008-01-01'),
  ('22222222-0000-0000-0000-0000000000b3', 'studente', 'N', 'Ver', '2008-01-01'),
  ('22222222-0000-0000-0000-0000000000b4', 'studente', 'A', 'Ltra', '2008-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'Ente Isc', 'ente-isc', 'its', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000b1');
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('TESTISC1', 'Scuola Isc', 'MI', 'Liceo'), ('TESTISC2', 'Altra Isc', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato)
  values ('dd000000-0000-0000-0000-0000000000b1', 'TESTISC1', 'attiva');
insert into public.school_staff (scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da)
  values ('dd000000-0000-0000-0000-0000000000b1', '33333333-0000-0000-0000-0000000000b1', 'referente', true, '33333333-0000-0000-0000-0000000000b1');
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica) values
  ('22222222-0000-0000-0000-0000000000b1', 'TESTISC1', '5A', 2027, 'verificato'),
  ('22222222-0000-0000-0000-0000000000b2', 'TESTISC1', '5A', 2027, 'verificato'),
  ('22222222-0000-0000-0000-0000000000b3', 'TESTISC1', '5A', 2027, 'dichiarato'),
  ('22222222-0000-0000-0000-0000000000b4', 'TESTISC2', '5A', 2027, 'verificato');
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
  ('e0000000-0000-0000-0000-0000000000b1', 'Per la scuola', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000b1',
   now() + interval '3 days', now() + interval '3 days 2 hours', 'approvato', 'studenti'),
  ('e0000000-0000-0000-0000-0000000000b2', 'Per la classe', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000b1',
   now() + interval '4 days', now() + interval '4 days 2 hours', 'approvato', 'studenti');
-- Il verificato 2 si era già iscritto da sé.
insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine) values
  ('22222222-0000-0000-0000-0000000000b2', 'e0000000-0000-0000-0000-0000000000b1', 'iscritto', 'studente'),
  ('22222222-0000-0000-0000-0000000000b2', 'e0000000-0000-0000-0000-0000000000b2', 'iscritto', 'studente');
insert into public.classi (id, scuola_profilo_id, anno, sezione) values
  ('cc000000-0000-0000-0000-0000000000b1', 'dd000000-0000-0000-0000-0000000000b1', 5, 'A');
insert into public.classi_studenti (classe_id, student_id) values
  ('cc000000-0000-0000-0000-0000000000b1', '22222222-0000-0000-0000-0000000000b1'),
  ('cc000000-0000-0000-0000-0000000000b1', '22222222-0000-0000-0000-0000000000b2');

-- `to_jsonb(...)` su un risultato `void` dà null: così la prova gira nei due mondi.
do $$
declare v_s jsonb; v_c jsonb; v_d jsonb; v_righe integer; v_somma integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-0000-0000-0000-0000000000b1', true);
  -- Cinque chiesti: due verificati (uno già iscritto), un non verificato, uno
  -- di un'altra scuola, e un id che non è nessuno.
  execute $q$select to_jsonb(r) from public.iscrivi_studenti_evento('e0000000-0000-0000-0000-0000000000b1',
    array['22222222-0000-0000-0000-0000000000b1','22222222-0000-0000-0000-0000000000b2','22222222-0000-0000-0000-0000000000b3',
          '22222222-0000-0000-0000-0000000000b4','99999999-0000-0000-0000-000000000000']::uuid[]) r$q$ into v_s;
  execute $q$select to_jsonb(r) from public.iscrivi_classe_evento('cc000000-0000-0000-0000-0000000000b1',
    'e0000000-0000-0000-0000-0000000000b2', 'individuale') r$q$ into v_c;
  execute $q$select to_jsonb(r) from public.iscrivi_classe_evento('cc000000-0000-0000-0000-0000000000b1',
    'e0000000-0000-0000-0000-0000000000b2', 'dad') r$q$ into v_d;
  reset role;
  if jsonb_typeof(v_s) = 'object' then
    v_somma := (v_s->>'iscritti')::int + (v_s->>'gia_iscritti')::int + (v_s->>'non_verificati')::int + (v_s->>'altra_scuola')::int;
  end if;
  select count(*) into v_righe from public.iscrizioni_eventi where evento_id = 'e0000000-0000-0000-0000-0000000000b1';
  insert into esiti values (1, 'studenti: dice chi è entrato, chi c''era già, e perché gli altri no', 'iscritti 1 · già 1 · non verificati 1 · altra scuola 2',
    coalesce(v_s::text, 'null'),
    v_s->>'iscritti' = '1' and v_s->>'gia_iscritti' = '1' and v_s->>'non_verificati' = '1' and v_s->>'altra_scuola' = '2');
  insert into esiti values (2, 'studenti: la somma delle categorie è il numero dei chiesti (nessuno sparisce)', '5', coalesce(v_somma::text, 'null'), v_somma = 5);
  insert into esiti values (3, 'classe in presenza: iscritti 1, già iscritti 1', 'iscritti 1 · già 1',
    coalesce(v_c::text, 'null'), v_c->>'iscritti' = '1' and v_c->>'gia_iscritti' = '1' and v_c->>'gruppo' = 'false');
  insert into esiti values (4, 'classe a distanza: dice che è iscritta come gruppo', 'gruppo true', coalesce(v_d::text, 'null'), v_d->>'gruppo' = 'true');
  insert into esiti values (5, 'le righe scritte sono quelle di prima: i due verificati, nessun altro', '2', v_righe::text, v_righe = 2);
end $$;

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
