-- Verifica di 20261202100000 (Mario, 01/11): l'account sparisce, il nome resta
-- sulle certificazioni; il referente non se ne va senza un successore.
--
-- CONTROPROVA: su una replica nata senza la migrazione la funzione
-- `stato_cancellazione_mio_account` e `passa_referente` non esistono, e il
-- tutor che ha verificato uno studente non si cancella (la chiave lo blocca).
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

insert into auth.users (id, email) values
  ('44444444-0000-0000-0000-0000000000a1', 'ref-canc@test.it'),
  ('44444444-0000-0000-0000-0000000000a2', 'tutor-canc@test.it'),
  ('44444444-0000-0000-0000-0000000000a3', 'tutor2-canc@test.it'),
  ('44444444-0000-0000-0000-0000000000a4', 'stud-canc@test.it'),
  ('44444444-0000-0000-0000-0000000000a5', 'doc-canc@test.it'),
  ('44444444-0000-0000-0000-0000000000a6', 'ente-canc@test.it'),
  ('44444444-0000-0000-0000-0000000000a7', 'stud2-canc@test.it'),
  ('44444444-0000-0000-0000-0000000000a8', 'ref2-canc@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('44444444-0000-0000-0000-0000000000a1', 'referente_scuola', 'Rita', 'Ref', '1980-01-01'),
  ('44444444-0000-0000-0000-0000000000a2', 'tutor_scuola', 'Tino', 'Tut', '1980-01-01'),
  ('44444444-0000-0000-0000-0000000000a3', 'tutor_scuola', 'Tea', 'Tut', '1980-01-01'),
  ('44444444-0000-0000-0000-0000000000a4', 'studente', 'Sara', 'Stu', '2008-01-01'),
  ('44444444-0000-0000-0000-0000000000a5', 'docente', 'Dino', 'Doc', '1975-01-01'),
  ('44444444-0000-0000-0000-0000000000a6', 'istituzione', 'Elio', 'Ente', '1975-01-01'),
  ('44444444-0000-0000-0000-0000000000a7', 'studente', 'Sole', 'Stu', '2008-01-01'),
  ('44444444-0000-0000-0000-0000000000a8', 'referente_scuola', 'Rosa', 'Ref', '1980-01-01');
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('TESTCAN1', 'Scuola Canc', 'MI', 'Liceo'), ('TESTCAN2', 'Scuola Altra', 'MI', 'Liceo')
  on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato) values
  ('dd000000-0000-0000-0000-0000000000c1', 'TESTCAN1', 'attiva'),
  ('dd000000-0000-0000-0000-0000000000c2', 'TESTCAN2', 'attiva');
insert into public.school_staff (id, scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da) values
  ('ee000000-0000-0000-0000-0000000000c1', 'dd000000-0000-0000-0000-0000000000c1', '44444444-0000-0000-0000-0000000000a1', 'referente', true, '44444444-0000-0000-0000-0000000000a1'),
  ('ee000000-0000-0000-0000-0000000000c2', 'dd000000-0000-0000-0000-0000000000c1', '44444444-0000-0000-0000-0000000000a2', 'tutor', true, '44444444-0000-0000-0000-0000000000a1'),
  ('ee000000-0000-0000-0000-0000000000c3', 'dd000000-0000-0000-0000-0000000000c1', '44444444-0000-0000-0000-0000000000a3', 'tutor', true, '44444444-0000-0000-0000-0000000000a1'),
  ('ee000000-0000-0000-0000-0000000000c8', 'dd000000-0000-0000-0000-0000000000c2', '44444444-0000-0000-0000-0000000000a8', 'referente', true, '44444444-0000-0000-0000-0000000000a8');
-- Il tutor verifica la studentessa: è la sua firma.
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica, verificato_da, verificato_il)
  values ('44444444-0000-0000-0000-0000000000a4', 'TESTCAN1', '4A', 2028, 'verificato', '44444444-0000-0000-0000-0000000000a2', now());

create function pg_temp.come(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); end $$;
create function pg_temp.prova(u uuid) returns text language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.come(u);
  begin r := public.delete_own_account(); return coalesce(r ->> 'esito', 'null');
  exception when others then return 'rifiutato: ' || sqlerrm; end;
end $$;

-- 1 · una studentessa senza firme si cancella per intero.
do $$ declare e text := pg_temp.prova('44444444-0000-0000-0000-0000000000a7'); begin
  insert into esiti values (1, 'chi non ha firmato niente si cancella per intero', 'cancellato, nessuna riga',
    e || ', profilo ' || (select count(*) from public.profiles where id = '44444444-0000-0000-0000-0000000000a7')
      || ', utente ' || (select count(*) from auth.users where id = '44444444-0000-0000-0000-0000000000a7'),
    e = 'cancellato'
      and not exists (select 1 from public.profiles where id = '44444444-0000-0000-0000-0000000000a7')
      and not exists (select 1 from auth.users where id = '44444444-0000-0000-0000-0000000000a7'));
end $$;

-- 2 · un docente senza firme: lo stesso.
do $$ declare e text := pg_temp.prova('44444444-0000-0000-0000-0000000000a5'); begin
  insert into esiti values (2, 'un docente senza firme si cancella per intero', 'cancellato', e,
    e = 'cancellato' and not exists (select 1 from public.profiles where id = '44444444-0000-0000-0000-0000000000a5'));
end $$;

-- 3 · il referente non se ne va senza un successore, e lo stato lo dice prima.
do $$ declare s jsonb; e text; begin
  perform pg_temp.come('44444444-0000-0000-0000-0000000000a1');
  s := public.stato_cancellazione_mio_account();
  e := pg_temp.prova('44444444-0000-0000-0000-0000000000a1');
  insert into esiti values (3, 'il referente: lo stato dice «passa la scuola», la cancellazione rifiuta, niente si tocca',
    'referente_senza_successore, 2 tutor, rifiutato, utente c''è',
    (s ->> 'motivo') || ', ' || (s ->> 'tutor_attivi') || ', ' || e,
    s ->> 'motivo' = 'referente_senza_successore' and (s ->> 'tutor_attivi')::int = 2
      and e like 'rifiutato: referente_senza_successore%'
      and exists (select 1 from auth.users where id = '44444444-0000-0000-0000-0000000000a1'));
end $$;

-- 4 · il tutor che ha verificato una studentessa: l'account sparisce, il nome resta.
do $$ declare s jsonb; e text; p record; begin
  perform pg_temp.come('44444444-0000-0000-0000-0000000000a2');
  s := public.stato_cancellazione_mio_account();
  e := pg_temp.prova('44444444-0000-0000-0000-0000000000a2');
  select nome, cognome, cancellato_il, data_nascita into p from public.profiles where id = '44444444-0000-0000-0000-0000000000a2';
  insert into esiti values (4, 'chi ha firmato: lo stato lo dice, l''utente sparisce, resta una lapide con il nome',
    'resta_il_nome, cancellato_resta_il_nome, Tino Tut, data di nascita vuota',
    coalesce(s ->> 'resta_il_nome', 'null') || ', ' || e || ', ' || coalesce(p.nome || ' ' || p.cognome, 'nessun profilo')
      || ', nascita ' || coalesce(p.data_nascita::text, 'vuota'),
    (s ->> 'resta_il_nome')::boolean and e = 'cancellato_resta_il_nome'
      and p.nome = 'Tino' and p.cancellato_il is not null and p.data_nascita is null
      and not exists (select 1 from auth.users where id = '44444444-0000-0000-0000-0000000000a2'));
end $$;

-- 5 · e la firma è ancora sua; la sua riga nello staff no.
insert into esiti select 5, 'la verifica porta ancora il suo nome, la sua riga nello staff è sparita',
  'verificato_da il tutor, 0 righe di staff',
  coalesce((select verificato_da::text from public.student_profiles where user_id = '44444444-0000-0000-0000-0000000000a4'), 'null')
    || ', ' || (select count(*) from public.school_staff where id = 'ee000000-0000-0000-0000-0000000000c2'),
  (select verificato_da from public.student_profiles where user_id = '44444444-0000-0000-0000-0000000000a4') = '44444444-0000-0000-0000-0000000000a2'
    and not exists (select 1 from public.school_staff where id = 'ee000000-0000-0000-0000-0000000000c2');

-- 6 · la lapide non si cancella due volte, e non si vede come una persona viva.
do $$ declare s jsonb; begin
  s := public.stato_cancellazione_account('44444444-0000-0000-0000-0000000000a2');
  insert into esiti values (6, 'una lapide non ha più un account da cancellare', 'profilo_mancante', s ->> 'motivo',
    s ->> 'motivo' = 'profilo_mancante');
end $$;

-- 7 · un tutor non passa la scuola; il referente non la passa a un tutor di un'altra scuola.
do $$ declare e1 text := 'riuscito'; e2 text := 'riuscito'; begin
  perform pg_temp.come('44444444-0000-0000-0000-0000000000a3');
  begin perform public.passa_referente('ee000000-0000-0000-0000-0000000000c3'); exception when others then e1 := sqlerrm; end;
  perform pg_temp.come('44444444-0000-0000-0000-0000000000a8');
  begin perform public.passa_referente('ee000000-0000-0000-0000-0000000000c3'); exception when others then e2 := sqlerrm; end;
  insert into esiti values (7, 'solo il referente passa la scuola, e solo a un tutor della sua', 'non_referente, tutor_non_valido',
    e1 || ', ' || e2, e1 = 'non_referente' and e2 = 'tutor_non_valido');
end $$;

-- 8 · il referente passa la scuola: lui tutor senza deleghe, l'altra referente.
do $$ declare r record; t record; begin
  perform pg_temp.come('44444444-0000-0000-0000-0000000000a1');
  perform public.passa_referente('ee000000-0000-0000-0000-0000000000c3');
  select * into r from public.school_staff where id = 'ee000000-0000-0000-0000-0000000000c1';
  select * into t from public.school_staff where id = 'ee000000-0000-0000-0000-0000000000c3';
  insert into esiti values (8, 'il passaggio: chi lascia è tutor senza deleghe, chi entra è referente, e i ruoli seguono',
    'tutor/false, referente, tutor_scuola, referente_scuola',
    r.ruolo_staff || '/' || r.puo_verificare_studenti || ', ' || t.ruolo_staff || ', '
      || (select ruolo from public.profiles where id = '44444444-0000-0000-0000-0000000000a1') || ', '
      || (select ruolo from public.profiles where id = '44444444-0000-0000-0000-0000000000a3'),
    r.ruolo_staff = 'tutor' and not r.puo_verificare_studenti and not r.puo_gestire_classi
      and not r.puo_certificare_presenze and not r.puo_inviare_comunicazioni and t.ruolo_staff = 'referente'
      and (select ruolo from public.profiles where id = '44444444-0000-0000-0000-0000000000a1') = 'tutor_scuola'
      and (select ruolo from public.profiles where id = '44444444-0000-0000-0000-0000000000a3') = 'referente_scuola');
end $$;

-- 9 · e adesso se ne va: ha invitato due tutor, quindi resta il nome.
do $$ declare e text := pg_temp.prova('44444444-0000-0000-0000-0000000000a1'); begin
  insert into esiti values (9, 'dopo il passaggio il referente di prima se ne va, e resta il nome sugli inviti',
    'cancellato_resta_il_nome, creato_da ancora lui', e,
    e = 'cancellato_resta_il_nome'
      and (select creato_da from public.school_staff where id = 'ee000000-0000-0000-0000-0000000000c3') = '44444444-0000-0000-0000-0000000000a1');
end $$;

-- 10 · l'account di un ente non si cancella da qui.
do $$ declare e text := pg_temp.prova('44444444-0000-0000-0000-0000000000a6'); begin
  insert into esiti values (10, 'un ente non si cancella da qui, e l''account resta', 'rifiutato: ruolo_non_previsto', e,
    e like 'rifiutato: ruolo_non_previsto%' and exists (select 1 from auth.users where id = '44444444-0000-0000-0000-0000000000a6'));
end $$;

-- 11 · il cruscotto di Supabase (un delete su auth.users) porta via il profilo come prima.
do $$ begin
  insert into auth.users (id, email) values ('44444444-0000-0000-0000-0000000000a9', 'dash@test.it');
  insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values ('44444444-0000-0000-0000-0000000000a9', 'studente', 'Dash', 'X', '2008-01-01');
  delete from auth.users where id = '44444444-0000-0000-0000-0000000000a9';
  insert into esiti values (11, 'cancellare l''utente da fuori porta via il profilo, come la chiave di prima', '0 profili',
    (select count(*) from public.profiles where id = '44444444-0000-0000-0000-0000000000a9') || ' profili',
    not exists (select 1 from public.profiles where id = '44444444-0000-0000-0000-0000000000a9'));
end $$;

-- 12 · i permessi: la regola per uuid non la esegue il client, la cancellazione non la esegue un visitatore.
insert into esiti select 12, 'stato per uuid chiuso al client, cancellazione e passaggio chiusi ad anon', 'f f f f',
  has_function_privilege('authenticated', 'public.stato_cancellazione_account(uuid)', 'execute') || ' '
    || has_function_privilege('anon', 'public.delete_own_account()', 'execute') || ' '
    || has_function_privilege('anon', 'public.passa_referente(uuid)', 'execute') || ' '
    || has_function_privilege('anon', 'public.stato_cancellazione_mio_account()', 'execute'),
  not has_function_privilege('authenticated', 'public.stato_cancellazione_account(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.delete_own_account()', 'execute')
    and not has_function_privilege('anon', 'public.passa_referente(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.stato_cancellazione_mio_account()', 'execute');

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where not coalesce(ok, false)) || ' ROTTE su ' || count(*) as riepilogo from esiti;

rollback;
