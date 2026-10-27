-- LE SONDE DEL CENSIMENTO DELLE COLONNE CHE IL CLIENT SCRIVE (27/10). SOLO
-- SULLA REPLICA (`scripts/replica-locale.sh`): scrive righe di prova, in una
-- transazione con ROLLBACK, e ha bisogno di una riga in `schools`.
--
-- Non è una verifica: ogni sonda dimostra una falla APERTA e stampa cosa è
-- successo. Il 27/10 hanno morso tutte e dieci. Il giorno della cura, la sonda
-- di quella falla diventa una proprietà del sistema curato (una `verifica-*.sql`,
-- o una voce della quarantena) e dovrà stampare un rifiuto.
--
-- Le sonde, nell'ordine:
--   1  consegne_evento.letture_tentate negativo → il tetto delle 5 letture non conta
--   2  profiles.ruolo riscritto da sé (studente → docente)
--   3  profiles.data_nascita riscritta → maggiorenne
--   4  student_profiles inserito già verificato, firmato da un referente
--   5  eventi proposto già in evidenza, con una data fuori dalla quota
--   6  eventi_aree aggiunta a un evento già approvato
--   7  school_staff: invito con creato_da e delega a nome di un altro
--   8  school_staff: un utente qualunque diventa tutor con un update
--   9  eventi proposto con la ricevuta di chiusura già scritta
--  10  domande_live nata «risposta_live da kireo», con la data di ieri

begin;
set local role postgres;
create temp table esiti (n int, cosa text, trovato text) on commit drop;
grant all on esiti to authenticated;
insert into auth.users (id, email) values
 ('77777777-0000-0000-0000-0000000000e1','ente-cs@test.it'),('77777777-0000-0000-0000-0000000000e2','stud-cs@test.it'),
 ('77777777-0000-0000-0000-0000000000e3','ref-cs@test.it'),('77777777-0000-0000-0000-0000000000e4','altro-cs@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
 ('77777777-0000-0000-0000-0000000000e1','istituzione','E','C','1980-01-01'),
 ('77777777-0000-0000-0000-0000000000e2','studente','S','C','2010-01-01'),
 ('77777777-0000-0000-0000-0000000000e3','referente_scuola','R','C','1980-01-01'),
 ('77777777-0000-0000-0000-0000000000e4','studente','A','C','2010-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values ('aaaaaaaa-0000-0000-0000-0000000000e1','Ente C','ente-cs','universita','attiva');
insert into public.institution_profiles (user_id, istituzione_id) values ('77777777-0000-0000-0000-0000000000e1','aaaaaaaa-0000-0000-0000-0000000000e1');
-- evento finito un'ora fa, con domanda
insert into public.eventi (id,titolo,descrizione,tipo,organizzatore_id,data_inizio,data_fine,stato,pubblico,domanda_consegna) values
 ('e0000000-0000-0000-0000-0000000000e1','CS','x','webinar','aaaaaaaa-0000-0000-0000-0000000000e1', now()-interval '2 hours', now()-interval '1 hour','approvato','studenti','Una domanda di prova lunga abbastanza');
insert into public.eventi_aree values ('e0000000-0000-0000-0000-0000000000e1','informatica-digitale');
insert into public.iscrizioni_eventi (student_id, evento_id) values ('77777777-0000-0000-0000-0000000000e2','e0000000-0000-0000-0000-0000000000e1');
insert into public.presenze_live (evento_id, user_id) values ('e0000000-0000-0000-0000-0000000000e1','77777777-0000-0000-0000-0000000000e2');

set local role authenticated;
-- A: studente, consegna con letture_tentate negativo, poi letture
select set_config('request.jwt.claim.sub','77777777-0000-0000-0000-0000000000e2',true);
do $$ declare r text := 'ok'; n int := 0; begin
  begin
    insert into public.consegne_evento (evento_id, student_id, testo, letture_tentate)
    values ('e0000000-0000-0000-0000-0000000000e1','77777777-0000-0000-0000-0000000000e2', repeat('parola ', 40), -1000);
  exception when others then r := sqlerrm; end;
  if r = 'ok' then
    for i in 1..20 loop begin perform public.apri_lettura_consegna('e0000000-0000-0000-0000-0000000000e1'); n := n+1; exception when others then exit; end; end loop;
  end if;
  insert into esiti values (1,'consegna con letture_tentate=-1000, letture concesse su 20 chieste', r||', '||n);
end $$;
-- B: studente si cambia ruolo
do $$ declare r text := 'ok'; v text; begin
  begin update public.profiles set ruolo='docente' where id='77777777-0000-0000-0000-0000000000e2'; exception when others then r := sqlerrm; end;
  select ruolo into v from public.profiles where id='77777777-0000-0000-0000-0000000000e2';
  insert into esiti values (2,'studente → docente da sé', r||', ora '||v);
  begin update public.profiles set ruolo='studente', data_nascita='1990-01-01' where id='77777777-0000-0000-0000-0000000000e2'; exception when others then r := sqlerrm; end;
  insert into esiti values (3,'data di nascita riscritta, maggiorenne?', public.current_e_maggiorenne()::text);
end $$;
-- C: altro studente, student_profiles inserito già verificato
select set_config('request.jwt.claim.sub','77777777-0000-0000-0000-0000000000e4',true);
do $$ declare r text := 'ok'; v text; begin
  begin insert into public.student_profiles (user_id, school_code, anno_diploma, classe, stato_verifica, verificato_il, verificato_da)
        values ('77777777-0000-0000-0000-0000000000e4','COTD01000G', 2028, '4', 'verificato', now(), '77777777-0000-0000-0000-0000000000e3');
  exception when others then r := sqlerrm; end;
  select stato_verifica::text into v from public.student_profiles where user_id='77777777-0000-0000-0000-0000000000e4';
  insert into esiti values (4,'student_profiles inserito già verificato, firmato da un referente', r||', '||coalesce(v,'-'));
end $$;
-- D: ente, evento in bozza con in_evidenza e data d'evidenza vecchia
select set_config('request.jwt.claim.sub','77777777-0000-0000-0000-0000000000e1',true);
do $$ declare r text := 'ok'; v text; begin
  begin insert into public.eventi (id,titolo,descrizione,tipo,organizzatore_id,data_inizio,data_fine,stato,pubblico,in_evidenza,in_evidenza_dal)
        values ('e0000000-0000-0000-0000-0000000000e2','EV','x','webinar','aaaaaaaa-0000-0000-0000-0000000000e1', now()+interval '10 days', now()+interval '10 days 1 hour','in_approvazione','studenti', true, '2020-01-01');
  exception when others then r := sqlerrm; end;
  select in_evidenza::text||' dal '||in_evidenza_dal::date into v from public.eventi where id='e0000000-0000-0000-0000-0000000000e2';
  insert into esiti values (5,'ente: evento proposto già in evidenza, data fuori dall''anno', r||', '||coalesce(v,'-'));
  -- E: aree aggiunte a un evento già approvato
  r := 'ok';
  begin insert into public.eventi_aree values ('e0000000-0000-0000-0000-0000000000e1','sicurezza-difesa'); exception when others then r := sqlerrm; end;
  insert into esiti values (6,'ente: area aggiunta a un evento già approvato', r);
end $$;
set local role postgres;
-- ── seconda parte ──
insert into auth.users (id, email) values
 ('77777777-0000-0000-0000-0000000000f1','ente-c2@test.it'),('77777777-0000-0000-0000-0000000000f2','stud-c2@test.it'),
 ('77777777-0000-0000-0000-0000000000f3','ref-c2@test.it'),('77777777-0000-0000-0000-0000000000f4','estraneo-c2@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
 ('77777777-0000-0000-0000-0000000000f1','istituzione','E','C','1980-01-01'),
 ('77777777-0000-0000-0000-0000000000f2','studente','S','C','2010-01-01'),
 ('77777777-0000-0000-0000-0000000000f3','referente_scuola','R','C','1980-01-01'),
 ('77777777-0000-0000-0000-0000000000f4','studente','X','C','2010-01-01');
insert into public.istituzioni (id, nome, slug, tipo, stato) values ('aaaaaaaa-0000-0000-0000-0000000000f1','Ente C2','ente-c2','universita','attiva');
insert into public.institution_profiles (user_id, istituzione_id) values ('77777777-0000-0000-0000-0000000000f1','aaaaaaaa-0000-0000-0000-0000000000f1');
insert into public.scuole_profili (id, scuola_id, stato) select 'bbbbbbbb-0000-0000-0000-0000000000f1', codice_meccanografico, 'attiva' from public.schools limit 1;
insert into public.school_staff (user_id, scuola_profilo_id, ruolo_staff, attivo, creato_da) values
 ('77777777-0000-0000-0000-0000000000f3','bbbbbbbb-0000-0000-0000-0000000000f1','referente', true, '77777777-0000-0000-0000-0000000000f3');
insert into public.eventi (id,titolo,descrizione,tipo,organizzatore_id,data_inizio,data_fine,stato,pubblico) values
 ('e0000000-0000-0000-0000-0000000000f1','IN ONDA','x','webinar','aaaaaaaa-0000-0000-0000-0000000000f1', now()-interval '10 minutes', now()+interval '50 minutes','approvato','studenti');
insert into public.eventi_aree values ('e0000000-0000-0000-0000-0000000000f1','informatica-digitale');
insert into public.iscrizioni_eventi (student_id, evento_id) values ('77777777-0000-0000-0000-0000000000f2','e0000000-0000-0000-0000-0000000000f1');
set local role authenticated;
-- 7-8: referente
select set_config('request.jwt.claim.sub','77777777-0000-0000-0000-0000000000f3',true);
do $$ declare r text := 'ok'; v text; begin
  begin insert into public.school_staff (id, scuola_profilo_id, ruolo_staff, attivo, codice_invito, creato_da, delega_aggiornata_da, delega_aggiornata_il)
        values ('cccccccc-0000-0000-0000-0000000000f1','bbbbbbbb-0000-0000-0000-0000000000f1','tutor', true, 'SCELTO', '77777777-0000-0000-0000-0000000000f4', '77777777-0000-0000-0000-0000000000f4', '2020-01-01');
  exception when others then r := sqlerrm; end;
  select coalesce(creato_da::text,'-') into v from public.school_staff where id='cccccccc-0000-0000-0000-0000000000f1';
  insert into esiti values (7,'referente: invito con creato_da e delega a nome di un altro', r||', creato_da='||coalesce(v,'-'));
  r := 'ok';
  begin update public.school_staff set user_id='77777777-0000-0000-0000-0000000000f4', puo_certificare_presenze=true where id='cccccccc-0000-0000-0000-0000000000f1';
  exception when others then r := sqlerrm; end;
  select coalesce(user_id::text,'-') into v from public.school_staff where id='cccccccc-0000-0000-0000-0000000000f1';
  insert into esiti values (8,'referente: un utente qualunque diventa tutor con un update, senza riscattare l''invito', r||', user_id='||v);
end $$;
-- 9: ente, evento che nasce chiuso
select set_config('request.jwt.claim.sub','77777777-0000-0000-0000-0000000000f1',true);
do $$ declare r text := 'ok'; begin
  begin insert into public.eventi (id,titolo,descrizione,tipo,organizzatore_id,data_inizio,data_fine,stato,pubblico,
        diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_da_user, diretta_chiusa_presenti, diretta_chiusa_certificati, diretta_durata_minuti)
        values ('e0000000-0000-0000-0000-0000000000f2','CHIUSO','x','altro','aaaaaaaa-0000-0000-0000-0000000000f1', now()+interval '5 days', now()+interval '5 days 2 hours','in_approvazione','studenti',
        now(), 'kireo', '77777777-0000-0000-0000-0000000000f3', 40, 40, 120);
  exception when others then r := sqlerrm; end;
  insert into esiti values (9,'ente: evento proposto con la ricevuta di chiusura già scritta (da «kireo», firmata da un altro)', r);
end $$;
-- 10: studente, domanda nata già risposta
select set_config('request.jwt.claim.sub','77777777-0000-0000-0000-0000000000f2',true);
do $$ declare r text := 'ok'; v text; begin
  begin insert into public.domande_live (evento_id, user_id, testo, stato, stato_da_tipo, stato_il, creata_il)
        values ('e0000000-0000-0000-0000-0000000000f1','77777777-0000-0000-0000-0000000000f2','Domanda di prova','risposta_live','kireo', now(), now()-interval '1 day');
  exception when others then r := sqlerrm; end;
  select stato||' da '||stato_da_tipo into v from public.domande_live where user_id='77777777-0000-0000-0000-0000000000f2';
  insert into esiti values (10,'studente: domanda nata «risposta da kireo», un giorno fa', r||', '||coalesce(v,'-'));
end $$;
set local role postgres;
select n, cosa, trovato from esiti order by n;
rollback;
