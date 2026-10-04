-- QUALI COLONNE PUÒ VALORIZZARE CHI PASSA IL `with check`.
--
-- La domanda è di Mario, dopo il buco di `iscrizioni_eventi` del 4/10: «la
-- policy non ha sbagliato, ha fatto esattamente quello che diceva —
-- `student_id = auth.uid()` verifica DI CHI è la riga e non COSA DICE la riga.
-- Questa distinzione non è di `iscrizioni_eventi`: è di qualunque policy che
-- autorizzi una scrittura guardando la proprietà della riga invece delle
-- colonne che la riga contiene.»
--
-- SI ESEGUE, NON SI LEGGE. Leggere la policy non è bastato nemmeno a chi l'ha
-- scritta: il buco di `iscrizioni_eventi` è stato trovato provando a scrivere
-- la riga che non doveva passare, non rileggendo il `with check`.
--
-- Gira in una transazione con ROLLBACK: si incolla nel SQL Editor di Supabase
-- senza lasciare niente. Ogni proprietà dice cosa ha provato a scrivere e cosa
-- è successo.
--
-- LE DUE MIGRAZIONI CHE CHIUDE: 20261004170000 (institution_profiles) e
-- 20261004180000 (student_activities). Su una replica NATA SENZA di loro le
-- proprietà 1-4 e 9-11 sono ROTTE — e la controprova va fatta su una replica
-- ricostruita da zero, perché `drop policy` non si disfà riapplicando un file.

\set ON_ERROR_STOP off
begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

-- ─────────────────────────────── fixture
insert into auth.users(id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'intruso@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', 'studente', 'I', 'Ntruso', '2006-01-01');
insert into public.schools(codice_meccanografico, denominazione, provincia, tipo_istituto)
  values ('ZZ00000001', 'Liceo di prova', 'Milano', 'Liceo');
insert into public.student_profiles(user_id, school_code, anno_diploma)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', 'ZZ00000001', 2026);

-- un ente vero, con un suo utente, una studentessa interessata e una chiave
insert into auth.users(id, email) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'ente@prova.it');
insert into public.profiles(id, ruolo, nome, cognome)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', 'istituzione', 'E', 'Nte');
insert into public.istituzioni(id, nome, slug, stato, piano_id)
  values ('cccccccc-0000-0000-0000-00000000000c', 'Ente Altrui', 'ente-altrui', 'attiva',
          (select id from public.piani where nome = 'premium'));
insert into public.institution_profiles(user_id, istituzione_id)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000c');

insert into auth.users(id, email) values ('dddddddd-0000-0000-0000-00000000000d', 'giulia@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
  values ('dddddddd-0000-0000-0000-00000000000d', 'studente', 'Giulia', 'Rossi', '2006-01-01');
insert into public.student_profiles(user_id, school_code, anno_diploma)
  values ('dddddddd-0000-0000-0000-00000000000d', 'ZZ00000001', 2026);
insert into public.manifestazioni_interesse(student_id, istituzione_id)
  values ('dddddddd-0000-0000-0000-00000000000d', 'cccccccc-0000-0000-0000-00000000000c');

insert into public.eventi(id, titolo, descrizione, tipo, pubblico, stato, data_inizio, data_fine, organizzatore_id)
  values ('eeeeeeee-0000-0000-0000-00000000000e', 'Diretta', 'D', 'webinar', 'studenti', 'approvato',
          now(), now() + interval '1 hour', 'cccccccc-0000-0000-0000-00000000000c');
insert into public.chiavi_trasmissione(evento_id, chiave, aggiornata_da)
  values ('eeeeeeee-0000-0000-0000-00000000000e', 'CHIAVE-SEGRETA-DI-PROVA', 'bbbbbbbb-0000-0000-0000-00000000000b');

insert into public.activities(id, titolo, tipo, ore_pcto)
  values ('ffffffff-0000-0000-0000-00000000000f', 'Attività', 'workshop', 4);

-- ═══════════════════════════════════════════════════════════════════════
-- institution_profiles: la catena che faceva diventare ente uno studente
-- ═══════════════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';

-- Il passo 1 della catena è e resta LEGITTIMO: il ruolo `istituzione` è
-- self-service di proposito (20260713110000). Si esegue per provare che dopo la
-- cura non apre più niente, non perché sia il difetto.
do $$ begin
  update public.profiles set ruolo = 'istituzione' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
  insert into esiti values (1, 'il ruolo istituzione resta self-service (deliberato)',
    'riesce', true, 'riuscito: il ruolo da solo non deve aprire niente');
exception when others then
  insert into esiti values (1, 'il ruolo istituzione resta self-service (deliberato)',
    'riesce', false, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.institution_profiles(user_id, istituzione_id)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000c');
  insert into esiti values (2, 'uno studente NON si collega a un ente qualunque',
    'respinto', false, '*** RIUSCITO: è il buco ***');
exception when others then
  insert into esiti values (2, 'uno studente NON si collega a un ente qualunque',
    'respinto', true, 'respinto: ' || sqlerrm);
end $$;

do $$ declare i uuid; begin
  select public.current_istituzione_id() into i;
  insert into esiti values (3, 'current_istituzione_id() resta NULL per chi non è un ente',
    'NULL', i is null, coalesce(i::text, 'NULL'));
end $$;

do $$ declare t text := ''; r record; begin
  for r in select * from public.manifestazioni_dettaglio_ente('cccccccc-0000-0000-0000-00000000000c') loop
    t := t || r.nome || ' ' || r.cognome || '; ';
  end loop;
  insert into esiti values (4, 'e non legge gli studenti interessati a quell''ente',
    'niente', t = '', case when t = '' then 'niente' else '*** ' || t || ' ***' end);
exception when others then
  insert into esiti values (4, 'e non legge gli studenti interessati a quell''ente',
    'niente', true, 'respinto: ' || sqlerrm);
end $$;

do $$ declare k text; begin
  select chiave into k from public.chiavi_trasmissione where evento_id = 'eeeeeeee-0000-0000-0000-00000000000e';
  insert into esiti values (5, 'e non legge la chiave di trasmissione della sua diretta',
    'invisibile', k is null, coalesce('*** ' || k || ' ***', 'invisibile'));
end $$;

do $$ begin
  insert into public.post_enti(istituzione_id, tipo, corpo, stato)
    values ('cccccccc-0000-0000-0000-00000000000c', 'testo', 'Post a nome suo', 'in_approvazione');
  insert into esiti values (6, 'e non pubblica un post a nome suo',
    'respinto', false, '*** RIUSCITO ***');
exception when others then
  insert into esiti values (6, 'e non pubblica un post a nome suo',
    'respinto', true, 'respinto: ' || sqlerrm);
end $$;
-- Stessa ragione: nel mondo ROTTO la 2 riesce e lascia il collegamento
-- abusivo. Qui non collide con niente (la PK è su user_id e l'ente nuovo ha un
-- utente diverso), ma si cancella comunque per non lasciare lo studente
-- travestito da ente nelle proprietà che seguono.
delete from public.institution_profiles where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update public.profiles set ruolo = 'studente' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
reset role;

-- ─── e la registrazione di un ente vero deve continuare a funzionare ───
-- È la metà che la cura può rompere: la funzione è passata a SECURITY DEFINER
-- proprio perché senza la policy la sua `insert` non passerebbe più.
insert into auth.users(id, email) values ('a1a1a1a1-0000-0000-0000-00000000a1a1', 'nuovo-ente@prova.it');
set local role authenticated;
set local request.jwt.claim.sub = 'a1a1a1a1-0000-0000-0000-00000000a1a1';
do $$ declare i uuid; begin
  perform public.finalize_registration_istituzione('Ente Nuovo', 'ente-nuovo', 'altro', 'Mario', 'Rossi', null);
  select istituzione_id into i from public.institution_profiles where user_id = 'a1a1a1a1-0000-0000-0000-00000000a1a1';
  insert into esiti values (7, 'un ente NUOVO si registra ancora (la cura non rompe il signup)',
    'riesce', i is not null, case when i is null then '*** nessun collegamento creato ***' else 'collegato a ' || i::text end);
exception when others then
  insert into esiti values (7, 'un ente NUOVO si registra ancora (la cura non rompe il signup)',
    'riesce', false, '*** respinto: ' || sqlerrm || ' ***');
end $$;
do $$ declare s text; begin
  select stato::text into s from public.istituzioni where slug = 'ente-nuovo';
  insert into esiti values (8, '…e nasce in attesa, non attiva',
    'in_attesa', s = 'in_attesa', coalesce(s, 'nessuna istituzione'));
end $$;
reset role;

-- ═══════════════════════════════════════════════════════════════════════
-- student_activities: le ore PCTO per l'altra porta
-- ═══════════════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-00000000000d';

do $$ begin
  insert into public.student_activities(student_id, activity_id, stato, ore_certificate)
    values ('dddddddd-0000-0000-0000-00000000000d', 'ffffffff-0000-0000-0000-00000000000f', 'completata', 90);
  insert into esiti values (9, 'uno studente NON si scrive 90 ore certificate',
    'respinto', false, '*** RIUSCITO: è il buco ***');
exception when others then
  insert into esiti values (9, 'uno studente NON si scrive 90 ore certificate',
    'respinto', true, 'respinto: ' || sqlerrm);
end $$;

do $$ declare o numeric; begin
  select coalesce(sum(ore_certificate), 0) into o from public.student_activities
   where student_id = 'dddddddd-0000-0000-0000-00000000000d';
  insert into esiti values (10, '…e il contatore della home resta a zero',
    '0', o = 0, o || ' ore su 90');
end $$;
reset role;

-- LA RIGA DI SONDA SE NE VA. Nel mondo ROTTO la 9 riesce — è il buco — e senza
-- questa cancellazione la riga vera qui sotto collide con
-- `student_activities_unique`, la transazione muore e la controprova non
-- produce nessuna tabella: cioè non si distingue «rotto» da «lo script non
-- gira». Stessa cura già scritta per 20261004140000.
delete from public.student_activities where student_id = 'dddddddd-0000-0000-0000-00000000000d';

-- una riga vera, scritta da una connessione privilegiata, poi il tentativo di
-- gonfiarla dal client
insert into public.student_activities(student_id, activity_id, stato, ore_certificate)
  values ('dddddddd-0000-0000-0000-00000000000d', 'ffffffff-0000-0000-0000-00000000000f', 'completata', 4);
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-00000000000d';
do $$ declare o numeric; begin
  update public.student_activities set ore_certificate = 9999
   where student_id = 'dddddddd-0000-0000-0000-00000000000d';
  select coalesce(sum(ore_certificate), 0) into o from public.student_activities
   where student_id = 'dddddddd-0000-0000-0000-00000000000d';
  insert into esiti values (11, 'e non gonfia una riga vera già scritta',
    '4 ore', o = 4, o || ' ore');
exception when others then
  insert into esiti values (11, 'e non gonfia una riga vera già scritta',
    '4 ore', true, 'respinto: ' || sqlerrm);
end $$;

do $$ declare o numeric; begin
  select coalesce(sum(ore_certificate), 0) into o from public.student_activities
   where student_id = 'dddddddd-0000-0000-0000-00000000000d';
  insert into esiti values (12, 'ma la LETTURA resta: il contatore legge le ore vere',
    '4 ore', o = 4, o || ' ore');
end $$;
reset role;

-- ═══════════════════════════════════════════════════════════════════════
-- LE TRE TABELLE DEL PROFILO: nessuna colonna scrivibile dal client.
-- Qui non si chiude niente di nuovo — si tiene fermo quello che è già giusto,
-- perché è il livello su cui poggia tutto il resto.
-- ═══════════════════════════════════════════════════════════════════════
insert into public.presenze_live(evento_id, user_id, ping_totali)
  values ('eeeeeeee-0000-0000-0000-00000000000e', 'dddddddd-0000-0000-0000-00000000000d', 1);
insert into public.evidence(student_id, area_slug, categoria, dimensione, valore, peso, fonte, motivazione)
  values ('dddddddd-0000-0000-0000-00000000000d', 'informatica-digitale', 'area', 'curiosity', 0.8, 0.5, 'presenza', 'vera');

set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-00000000000d';

do $$ declare n int; begin
  update public.presenze_live set ping_totali = 999 where evento_id = 'eeeeeeee-0000-0000-0000-00000000000e';
  select ping_totali into n from public.presenze_live where evento_id = 'eeeeeeee-0000-0000-0000-00000000000e';
  insert into esiti values (13, 'presenze_live: i ping non si scrivono da sé',
    '1 ping', n = 1, coalesce(n::text || ' ping', 'invisibile'));
exception when others then
  insert into esiti values (13, 'presenze_live: i ping non si scrivono da sé', '1 ping', true, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.evidence(student_id, area_slug, categoria, dimensione, valore, peso, fonte, motivazione)
    values ('dddddddd-0000-0000-0000-00000000000d', 'informatica-digitale', 'area', 'interest', 1.0, 99, 'mission', 'me la scrivo io');
  insert into esiti values (14, 'evidence: le prove non si fabbricano', 'respinto', false, '*** RIUSCITO ***');
exception when others then
  insert into esiti values (14, 'evidence: le prove non si fabbricano', 'respinto', true, 'respinto: ' || sqlerrm);
end $$;

do $$ declare p numeric; begin
  update public.evidence set peso = 99 where student_id = 'dddddddd-0000-0000-0000-00000000000d';
  select peso into p from public.evidence where student_id = 'dddddddd-0000-0000-0000-00000000000d';
  insert into esiti values (15, '…né si ripesano', '0.5', p = 0.5, coalesce(p::text, 'invisibile'));
exception when others then
  insert into esiti values (15, '…né si ripesano', '0.5', true, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  delete from public.evidence where student_id = 'dddddddd-0000-0000-0000-00000000000d';
  insert into esiti values (16, '…né si cancella una prova scomoda',
    'nessuna cancellata',
    exists (select 1 from public.evidence where student_id = 'dddddddd-0000-0000-0000-00000000000d'),
    case when exists (select 1 from public.evidence where student_id = 'dddddddd-0000-0000-0000-00000000000d')
         then 'la prova è ancora lì' else '*** cancellata ***' end);
exception when others then
  insert into esiti values (16, '…né si cancella una prova scomoda', 'nessuna cancellata', true, 'respinto: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.area_signal(student_id, area_slug, interest_score, confidence, status, attivita_distinte)
    values ('dddddddd-0000-0000-0000-00000000000d', 'informatica-digitale', 100, 1.0, 'confermata', 9);
  insert into esiti values (17, 'area_signal: il profilo non si scrive da sé', 'respinto', false, '*** RIUSCITO ***');
exception when others then
  insert into esiti values (17, 'area_signal: il profilo non si scrive da sé', 'respinto', true, 'respinto: ' || sqlerrm);
end $$;
reset role;

-- ─────────────────────────────── riassunto
select n, proprieta, atteso,
       case when coalesce(ok, false) then 'ok' else '*** ROTTO ***' end as esito,
       osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' proprietà verificate' as riassunto,
       case when count(*) filter (where not coalesce(ok, false)) = 0
            then 'TUTTO VERDE'
            else '*** ' || count(*) filter (where not coalesce(ok, false)) || ' ROTTE ***' end as verdetto
from esiti;

rollback;
