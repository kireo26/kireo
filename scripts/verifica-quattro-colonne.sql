-- Verifica di 20261105100000_quattro_colonne_che_decidono.sql (Mario, 27/10):
-- le quattro peggiori del censimento delle colonne, chiuse; e le strade
-- legittime che la cura poteva rompere, aperte.
--
-- Le proprietà 1-7 sono le sonde 2, 4, 5, 7, 8 e 9 di
-- `scripts/diagnostica-colonne-che-decidono.sql`, girate nel sistema curato:
-- là stampano cosa è successo, qui affermano un rifiuto.
-- Le 8-14 sono i CONTROLLI: le strade che il client percorre davvero. Prima di
-- questo file non le provava nessuno script (finalize_registration,
-- crea_invito_tutor, metti_in_evidenza_evento), e sono esattamente quelle che
-- un elenco di colonne sbagliato romperebbe.
--
-- CONTROPROVA: su una replica nata senza la migrazione sono rosse 1-7, e i
-- controlli 8-14 restano verdi (sono il comportamento di prima).
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to authenticated;

insert into auth.users (id, email) values
 ('66666666-0000-0000-0000-0000000000a1', 'ente-q@test.it'),
 ('66666666-0000-0000-0000-0000000000a2', 'stud-q@test.it'),
 ('66666666-0000-0000-0000-0000000000a3', 'ref-q@test.it'),
 ('66666666-0000-0000-0000-0000000000a4', 'nuovo-q@test.it'),
 ('66666666-0000-0000-0000-0000000000a5', 'senza-riga-q@test.it'),
 ('66666666-0000-0000-0000-0000000000a6', 'ruolo-q@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
 ('66666666-0000-0000-0000-0000000000a1', 'istituzione', 'E', 'Q', '1980-01-01'),
 ('66666666-0000-0000-0000-0000000000a2', 'studente', 'S', 'Q', '2008-01-01'),
 ('66666666-0000-0000-0000-0000000000a3', 'referente_scuola', 'R', 'Q', '1980-01-01'),
 -- un account con il ruolo studente e senza riga in student_profiles: è il caso
 -- della sonda 4 (un docente diventato studente, o un account che ha saltato
 -- finalize_registration)
 ('66666666-0000-0000-0000-0000000000a5', 'studente', 'X', 'Q', '2008-01-01'),
 -- un account solo per la prova 1: nel mondo rotto quella prova RIESCE e cambia
 -- il ruolo, e i controlli che vengono dopo non devono ereditarlo (il modo 9)
 ('66666666-0000-0000-0000-0000000000a6', 'studente', 'R', 'Q', '2008-01-01');
insert into public.student_profiles (user_id, school_code, classe, anno_diploma)
 select '66666666-0000-0000-0000-0000000000a2', codice_meccanografico, '4', 2028 from public.schools limit 1;
insert into public.istituzioni (id, nome, slug, tipo, stato, piano_id)
 select 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Ente Q', 'ente-q', 'universita', 'attiva', id from public.piani where nome = 'premium';
insert into public.institution_profiles (user_id, istituzione_id) values
 ('66666666-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1');
insert into public.scuole_profili (id, scuola_id, stato)
 select 'bbbbbbbb-0000-0000-0000-0000000000a1', codice_meccanografico, 'attiva' from public.schools limit 1;
insert into public.school_staff (id, user_id, scuola_profilo_id, ruolo_staff, attivo, creato_da) values
 ('cccccccc-0000-0000-0000-0000000000a3', '66666666-0000-0000-0000-0000000000a3', 'bbbbbbbb-0000-0000-0000-0000000000a1', 'referente', true, '66666666-0000-0000-0000-0000000000a3'),
 ('cccccccc-0000-0000-0000-0000000000a9', null, 'bbbbbbbb-0000-0000-0000-0000000000a1', 'tutor', true, '66666666-0000-0000-0000-0000000000a3');
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico) values
 ('e0000000-0000-0000-0000-0000000000a1', 'APPROVATO', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-0000000000a1',
  now() + interval '10 days', now() + interval '10 days 1 hour', 'approvato', 'studenti');

-- Esegue `sql` come `chi` e restituisce 'riuscito', il numero di righe toccate, o lo sqlstate.
create function pg_temp.come(chi uuid, sql text) returns text language plpgsql as $$
declare v text := 'riuscito'; n int;
begin
  perform set_config('request.jwt.claim.sub', chi::text, true);
  set local role authenticated;
  begin
    execute sql;
    get diagnostics n = row_count;
    v := 'riuscito, ' || n || ' righe';
  exception when others then v := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end $$;

-- ── LE QUATTRO PORTE ─────────────────────────────────────────────────────────
-- 1 · (sonda 2) il ruolo non si riscrive dal client.
do $$ declare r text; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a6',
    $q$update public.profiles set ruolo = 'docente' where id = '66666666-0000-0000-0000-0000000000a6'$q$);
  insert into esiti values (1, 'lo studente non si riscrive il ruolo', '42501', r, r = '42501');
end $$;

-- 2 · (sonda 4) chi non ha la riga non se la inserisce già verificata.
do $$ declare r text; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a5',
    format($q$insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica, verificato_il, verificato_da)
             values ('66666666-0000-0000-0000-0000000000a5', %L, '4', 2028, 'verificato', now(), '66666666-0000-0000-0000-0000000000a3')$q$,
           (select codice_meccanografico from public.schools limit 1)));
  insert into esiti values (2, 'student_profiles non nasce verificato dal client', '42501', r, r = '42501');
end $$;

-- 3 · …e non nasce verificato nemmeno se il privilegio di colonna tornasse: la
--     policy di insert ora dice la stessa cosa di quella di update.
insert into esiti
select 3, 'la policy di insert di student_profiles pretende lo stato dichiarato e nessun verificatore',
  'presente', case when n = 1 then 'presente' else 'assente' end, n = 1
from (select count(*) n from pg_policies
      where tablename = 'student_profiles' and policyname = 'student_profiles_insert_own'
        and with_check like '%dichiarato%' and with_check like '%verificato_da IS NULL%'
        and with_check like '%verificato_il IS NULL%') x;

-- 4 · (sonda 5) l'ente non propone un evento già in evidenza.
do $$ declare r text; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a1',
    $q$insert into public.eventi (titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, in_evidenza, in_evidenza_dal)
       values ('EV', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000a1', now() + interval '9 days', now() + interval '9 days 1 hour',
               'in_approvazione', 'studenti', true, '2020-01-01')$q$);
  insert into esiti values (4, 'un evento non nasce in evidenza dal client', '42501', r, r = '42501');
end $$;

-- 5 · (sonda 9) l'ente non propone un evento che nasce chiuso.
do $$ declare r text; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a1',
    $q$insert into public.eventi (titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
        diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_da_user, diretta_chiusa_presenti, diretta_chiusa_certificati, diretta_durata_minuti)
       values ('CHIUSO', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000a1', now() + interval '5 days', now() + interval '5 days 2 hours',
               'in_approvazione', 'studenti', now(), 'kireo', '66666666-0000-0000-0000-0000000000a3', 40, 40, 120)$q$);
  insert into esiti values (5, 'un evento non nasce con la ricevuta di chiusura dal client', '42501', r, r = '42501');
end $$;

-- 6 · (sonda 7) il referente non scrive un invito a nome di un altro.
do $$ declare r text; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a3',
    $q$insert into public.school_staff (scuola_profilo_id, ruolo_staff, codice_invito, nome_invitato, email_invitato, creato_da)
       values ('bbbbbbbb-0000-0000-0000-0000000000a1', 'tutor', 'SCELTO', 'N', 'n@x.it', '66666666-0000-0000-0000-0000000000a2')$q$);
  insert into esiti values (6, 'un invito non si scrive con creato_da altrui', '42501', r, r = '42501');
end $$;

-- 7 · (sonda 8) il referente non fa diventare tutor un utente qualunque.
do $$ declare r text; v uuid; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a3',
    $q$update public.school_staff set user_id = '66666666-0000-0000-0000-0000000000a2' where id = 'cccccccc-0000-0000-0000-0000000000a9'$q$);
  select user_id into v from public.school_staff where id = 'cccccccc-0000-0000-0000-0000000000a9';
  insert into esiti values (7, 'user_id di una riga di staff non si riscrive dal client', '42501, ancora nessuno',
    r || ', ' || coalesce(v::text, 'ancora nessuno'), r = '42501' and v is null);
end $$;

-- ── I CONTROLLI: le strade legittime ─────────────────────────────────────────
-- 8 · la registrazione di uno studente funziona ancora, e nasce dichiarato.
do $$ declare r text; v text; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a4',
    format($q$select public.finalize_registration('studente', 'Nuovo', 'Q', '2008-05-05', %L, '3', 2029)$q$,
           (select codice_meccanografico from public.schools limit 1)));
  select p.ruolo::text || '/' || coalesce(sp.stato_verifica::text, '(nessuna riga)') into v
  from public.profiles p left join public.student_profiles sp on sp.user_id = p.id
  where p.id = '66666666-0000-0000-0000-0000000000a4';
  insert into esiti values (8, 'finalize_registration funziona e lo studente nasce dichiarato', 'riuscito/studente/dichiarato',
    split_part(r, ',', 1) || '/' || coalesce(v, '(nessun profilo)'), r like 'riuscito%' and v = 'studente/dichiarato');
end $$;

-- 9 · lo studente aggiorna telefono e data di nascita, e la propria scuola.
do $$ declare r1 text; r2 text; r3 text; begin
  r1 := pg_temp.come('66666666-0000-0000-0000-0000000000a2',
    $q$update public.profiles set telefono = '333' where id = '66666666-0000-0000-0000-0000000000a2'$q$);
  r2 := pg_temp.come('66666666-0000-0000-0000-0000000000a2',
    $q$update public.profiles set data_nascita = '2008-02-02' where id = '66666666-0000-0000-0000-0000000000a2'$q$);
  r3 := pg_temp.come('66666666-0000-0000-0000-0000000000a2',
    $q$update public.student_profiles set classe = '5' where user_id = '66666666-0000-0000-0000-0000000000a2'$q$);
  insert into esiti values (9, 'telefono, data di nascita e classe si aggiornano ancora (una riga ciascuno)',
    '1/1/1 righe', r1 || ' · ' || r2 || ' · ' || r3,
    r1 = 'riuscito, 1 righe' and r2 = 'riuscito, 1 righe' and r3 = 'riuscito, 1 righe');
end $$;

-- 10 · l'ente propone ancora un evento normale.
do $$ declare r text; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a1',
    $q$insert into public.eventi (titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico)
       values ('NORMALE', 'x', 'altro', 'aaaaaaaa-0000-0000-0000-0000000000a1', now() + interval '8 days', now() + interval '8 days 1 hour',
               'in_approvazione', 'studenti')$q$);
  insert into esiti values (10, 'l''ente propone ancora un evento senza le colonne tolte', 'riuscito, 1 righe', r, r = 'riuscito, 1 righe');
end $$;

-- 11 · …e mette ancora in evidenza un evento approvato dalla strada prevista.
do $$ declare r text; v boolean; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a1',
    $q$select public.metti_in_evidenza_evento('e0000000-0000-0000-0000-0000000000a1')$q$);
  select in_evidenza into v from public.eventi where id = 'e0000000-0000-0000-0000-0000000000a1';
  insert into esiti values (11, 'metti_in_evidenza_evento funziona ancora', 'riuscito/in evidenza',
    split_part(r, ',', 1) || '/' || case when v then 'in evidenza' else 'non in evidenza' end, r like 'riuscito%' and v);
end $$;

-- 12 · il referente invita ancora un tutor, e l'invito porta il suo nome.
do $$ declare r text; v uuid; begin
  r := pg_temp.come('66666666-0000-0000-0000-0000000000a3',
    $q$select public.crea_invito_tutor('Tutor Nuovo', 'tutor@x.it')$q$);
  select creato_da into v from public.school_staff where email_invitato = 'tutor@x.it';
  insert into esiti values (12, 'crea_invito_tutor funziona, con creato_da = chi invita', 'riuscito/referente',
    split_part(r, ',', 1) || '/' || coalesce(v::text, '(nessuna riga)'),
    r like 'riuscito%' and v = '66666666-0000-0000-0000-0000000000a3');
end $$;

-- 13 · …e cambia ancora una delega e lo stato di un tutor (una riga ciascuno).
do $$ declare r1 text; r2 text; begin
  r1 := pg_temp.come('66666666-0000-0000-0000-0000000000a3',
    $q$update public.school_staff set puo_gestire_classi = not puo_gestire_classi where id = 'cccccccc-0000-0000-0000-0000000000a9'$q$);
  r2 := pg_temp.come('66666666-0000-0000-0000-0000000000a3',
    $q$update public.school_staff set attivo = false where id = 'cccccccc-0000-0000-0000-0000000000a9'$q$);
  insert into esiti values (13, 'delega e stato di un tutor si cambiano ancora', '1/1 righe', r1 || ' · ' || r2,
    r1 = 'riuscito, 1 righe' and r2 = 'riuscito, 1 righe');
end $$;

-- 14 · la delega cambiata porta ancora l'autore (il trigger scrive colonne che
--      il client non ha: deve continuare a poterlo fare).
insert into esiti
select 14, 'la delega cambiata dal referente porta il suo nome', 'referente',
  coalesce(delega_aggiornata_da::text, '(nessuno)'), delega_aggiornata_da = '66666666-0000-0000-0000-0000000000a3'
from public.school_staff where id = 'cccccccc-0000-0000-0000-0000000000a9';

select n, case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito, cosa, atteso, trovato from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riepilogo from esiti;

rollback;
