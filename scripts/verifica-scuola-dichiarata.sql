-- UNA SCUOLA DICHIARATA NON È UN TITOLO.
--
-- Prova la migrazione 20261005110000. Gira in una transazione con ROLLBACK: si
-- incolla nel SQL Editor di Supabase senza lasciare niente.
--
-- SI ESEGUE, NON SI LEGGE. Le due scritture della catena sono entrambe
-- legittime prese da sole (il ruolo è self-service di proposito, la scuola si
-- dichiara come la dichiara uno studente): il difetto sta in quello che la
-- SECONDA concede, e si vede solo leggendo i dati di un'altra scuola dopo
-- averla dichiarata.
--
-- SU UNA REPLICA NATA SENZA la migrazione le proprietà 3-8 sono ROTTE — e la
-- controprova va fatta ricostruendo, perché `drop policy` non si disfà
-- riapplicando un file.

\set ON_ERROR_STOP off
begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

-- ─────────────────────────────── fixture
insert into public.schools(codice_meccanografico, denominazione, provincia, tipo_istituto)
  values ('ZZ00000009', 'Liceo Altrui', 'Napoli', 'Liceo');

-- una studentessa MINORENNE di quella scuola, con le sue aree di interesse e
-- un'attività certificata
insert into auth.users(id, email) values ('dddddddd-0000-0000-0000-00000000000d', 'giulia@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
  values ('dddddddd-0000-0000-0000-00000000000d', 'studente', 'Giulia', 'Rossi', '2010-01-01');
insert into public.student_profiles(user_id, school_code, classe, anno_diploma)
  values ('dddddddd-0000-0000-0000-00000000000d', 'ZZ00000009', '3ª A', 2029);
insert into public.student_area_interests(user_id, area_slug)
  values ('dddddddd-0000-0000-0000-00000000000d', 'salute-professioni-sanitarie');
insert into public.activities(id, titolo, tipo, ore_pcto)
  values ('ffffffff-0000-0000-0000-00000000000f', 'Attività', 'workshop', 4);
insert into public.student_activities(student_id, activity_id, stato, ore_certificate)
  values ('dddddddd-0000-0000-0000-00000000000d', 'ffffffff-0000-0000-0000-00000000000f', 'completata', 4);
insert into public.conventions(school_code, stato)
  values ('ZZ00000009', 'attiva');
-- UN CODICE CLASSE CHE ESISTE GIÀ, e non è un dettaglio: la proprietà 8 («i
-- codici classe») prima lo creava DOPO le sonde, quindi era verde perché la
-- tabella era vuota — una proprietà che non può fallire è una proprietà che
-- nessuno sa essere vacua.
insert into public.class_codes(convention_id, codice, classe, max_usi)
  values ((select id from public.conventions where school_code = 'ZZ00000009'), 'KIREO-VR01', '3ª A', 30);

-- l'intruso: un account qualunque
insert into auth.users(id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'intruso@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', 'studente', 'I', 'Ntruso', '2006-01-01');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';

-- ═══ 1-2) LE DUE SCRITTURE DELLA CATENA RESTANO LEGITTIME ═══
-- Si eseguono per provare che dopo la cura non aprono più niente, non perché
-- siano il difetto.
do $$ begin
  update public.profiles set ruolo = 'docente' where id = auth.uid();
  insert into esiti values (1, 'darsi il ruolo docente (self-service, deliberato)',
    'riesce', true, 'riuscito: il ruolo da solo non deve aprire niente');
exception when others then
  insert into esiti values (1, 'darsi il ruolo docente (self-service, deliberato)',
    'riesce', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.teacher_profiles(user_id, school_code, materia)
    values (auth.uid(), 'ZZ00000009', 'Matematica');
  insert into esiti values (2, 'dichiarare una scuola qualunque (come fa uno studente)',
    'riesce', true, 'riuscito: dichiarare non e'' verificare');
exception when others then
  insert into esiti values (2, 'dichiarare una scuola qualunque (come fa uno studente)',
    'riesce', false, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 3-8) E ORA NON LEGGE NIENTE DI QUELLA SCUOLA ═══
do $$
declare v text; n int;
begin
  select string_agg(nome || ' ' || cognome, ', ') into v
    from public.profiles where ruolo = 'studente' and id <> auth.uid();
  insert into esiti values (3, 'nome e cognome degli studenti di quella scuola',
    'NESSUNO', v is null, coalesce('*** LEGGE: ' || v || ' ***', 'nessuno'));

  select count(*) into n from public.student_profiles where school_code = 'ZZ00000009';
  insert into esiti values (4, 'scuola, classe e stato di verifica',
    '0 righe', n = 0, n || ' righe');

  select string_agg(area_slug, ', ') into v from public.student_area_interests
   where user_id <> auth.uid();
  insert into esiti values (5, 'LE AREE DI INTERESSE (dato di profilazione)',
    'NESSUNA', v is null, coalesce('*** LEGGE: ' || v || ' ***', 'nessuna'));

  select count(*) into n from public.student_activities where student_id <> auth.uid();
  insert into esiti values (6, 'le ore PCTO certificate',
    '0 righe', n = 0, n || ' righe');

  select count(*) into n from public.conventions;
  insert into esiti values (7, 'la convenzione della scuola',
    '0 righe', n = 0, n || ' righe');

  select count(*) into n from public.class_codes;
  insert into esiti values (8, 'i codici classe',
    '0 righe', n = 0, n || ' righe');
end $$;

-- ═══ 9) e non ne FABBRICA uno, nemmeno col ruolo di referente ═══
do $$
declare v_conv uuid;
begin
  update public.profiles set ruolo = 'referente_scuola' where id = auth.uid();
  select id into v_conv from public.conventions where school_code = 'ZZ00000009';
  insert into public.class_codes(convention_id, codice, classe, max_usi)
    values (v_conv, 'KIREO-FK01', '3ª A', 30);
  insert into esiti values (9, 'fabbricare un codice classe per quella scuola',
    'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (9, 'fabbricare un codice classe per quella scuola',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 10) LA METÀ CHE LA CURA POTEVA ROMPERE: il docente legge la PROPRIA riga
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';
do $$
declare v text;
begin
  select materia || ' / ' || school_code into v
    from public.teacher_profiles where user_id = auth.uid();
  insert into esiti values (10, 'il docente legge ancora la propria riga (lib/docente/context.ts)',
    'Matematica / ZZ00000009', v = 'Matematica / ZZ00000009', coalesce(v, '(nessuna riga)'));
exception when others then
  insert into esiti values (10, 'il docente legge ancora la propria riga (lib/docente/context.ts)',
    'Matematica / ZZ00000009', false, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 11) e lo studente riscatta ancora un codice vero (SECURITY DEFINER)
reset role;
do $$
declare v record;
begin
  select * into v from public.check_class_code('KIREO-VR01');
  insert into esiti values (11, 'un codice vero si verifica ancora (check_class_code)',
    'valido', coalesce(v.valido, false), 'valido=' || coalesce(v.valido::text, 'null'));
exception when others then
  insert into esiti values (11, 'un codice vero si verifica ancora (check_class_code)',
    'valido', false, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 12) e lo staff VERIFICATO di quella scuola legge i suoi studenti
-- La via nuova non si tocca: `school_staff` + `scuole_profili` attivata.
insert into auth.users(id, email) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'ref@prova.it');
insert into public.profiles(id, ruolo, nome, cognome)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', 'referente_scuola', 'R', 'Ef');
insert into public.scuole_profili(id, scuola_id, stato)
  values ('99999999-0000-0000-0000-000000000099', 'ZZ00000009', 'attiva');
insert into public.school_staff(scuola_profilo_id, user_id, ruolo_staff, attivo,
                                puo_verificare_studenti, creato_da)
  values ('99999999-0000-0000-0000-000000000099', 'bbbbbbbb-0000-0000-0000-00000000000b',
          'referente', true, true, 'bbbbbbbb-0000-0000-0000-00000000000b');

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000000b';
do $$
declare n int;
begin
  select count(*) into n from public.student_profiles where school_code = public.current_scuola_id();
  insert into esiti values (12, 'lo staff VERIFICATO legge ancora i propri studenti',
    '1 riga', n = 1, n || ' righe');
exception when others then
  insert into esiti values (12, 'lo staff VERIFICATO legge ancora i propri studenti',
    '1 riga', false, 'respinto: ' || sqlerrm);
end $$;

reset role;

select n, proprieta, atteso,
       case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
