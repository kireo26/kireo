-- ⏳ IN QUARANTENA — le proprietà 1, 2, 4 e 5 sono ROSSE, e lo sono di proposito.
--
-- Scritte come le proprietà del sistema CURATO. Il giorno della cura non si
-- scrive niente di nuovo: si toglie il nome da `scripts/quarantena/elenco.js` e
-- si verifica che diventino verdi.
--
-- LE DUE FALLE (5/10/2026, dalla passata sulle tabelle mute). In
-- `messaggi_scuola_destinatari` DUE policy verificano DI CHI è la riga e non
-- QUALE riga è — ottava e nona occorrenza della specie:
--
--   • `_insert_scuola` vincola il `messaggio_id` (un messaggio della propria
--     scuola) e il permesso (`comunicazioni`), e NON vincola lo
--     `student_id`. Il commento di luglio lo dichiara («la funzione filtra
--     comunque a studenti verificati … questa policy è la seconda linea di
--     difesa, non l'unica») — ma la funzione è una strada, non un cancello:
--     dal client si scrive direttamente.
--
--   • `_update_own_letto` si chiama «letto» e non vincola nessuna colonna
--     oltre allo `student_id`: lo studente RIPUNTA la propria riga di consegna
--     su un altro `messaggio_id` e ne legge il corpo (`e_destinatario_messaggio`
--     guarda esattamente quella riga). Misurato: «SEGRETO DI B» letto da uno
--     studente della scuola A.
--
-- ⚠️ IL CANCELLO CHE TIENE, e va letto prima di spaventarsi: per ripuntare
-- serve l'UUID di un altro messaggio, e uno studente non lo può ottenere.
-- [verificato su app/, components/, lib/: `lib/app/messaggi.ts` legge i
-- messaggi passando dalle PROPRIE righe di consegna, quindi vede solo gli id
-- dei messaggi che già riceve; la pagina della scuola serve il proprio staff e
-- quella admin un admin.] Quindi: ripuntare fra due messaggi che si ricevono
-- già non concede niente, e gli altri sono dietro un uuid casuale.
-- L'inindovinabilità non è un permesso — è la ragione per cui questa non è
-- urgente, non la ragione per cui non è un difetto.
--
-- E LA PROPRIETÀ 1 È L'UNICA RAGGIUNGIBILE: lo staff VEDE i propri studenti
-- DICHIARATI e non ancora verificati (`student_profiles_select_scuola` guarda
-- `school_code`, non lo stato), quindi può consegnare a loro dal client. La
-- funzione `invia_messaggio_scuola` li rifiuta — proprietà 3, verde — ma la
-- policy no. Severità bassa (lo studente ha dichiarato quella scuola), e
-- scavalca comunque il cancello della verifica, che `/privacy` dichiara come
-- rafforzamento della base di legittimazione per i minorenni.
--
-- ⚠️ E LA CURA NON È SIMMETRICA, che è la nota utile per chi la scriverà:
--
--   • l'insert si chiude con una riga nel `with check` (lo `student_id` deve
--     essere uno studente VERIFICATO della propria scuola) — ordinaria;
--   • l'update NON si chiude in una policy. In RLS `using` vede la riga
--     VECCHIA e `with check` la NUOVA, e non c'è modo di confrontarle: pinnare
--     il `messaggio_id` vuole un trigger, oppure un `revoke update
--     (messaggio_id) … from authenticated`. Seconda volta nella stessa giornata
--     che una cura è un POSTO e non una clausola (la prima è `__t3_frozen__`).
--
-- ⚠️ EFFETTO COLLATERALE DEL RIPUNTAMENTO, perché non si creda che sia
-- silenzioso: la riga si SPOSTA, quindi lo studente perde la propria consegna
-- del messaggio di prima e la scuola perde quel destinatario dalla lista. È una
-- traccia — che però oggi non guarda nessuno.
--
-- ⚠️ LE PROPRIETÀ 6-8 SONO LA METÀ CHE LA CURA PUÒ ROMPERE: segnare come letto
-- il proprio messaggio, la consegna legittima a uno studente verificato, e
-- l'isolamento di chi non ha nessuna riga.
--
-- Gira in una transazione con ROLLBACK.

\set ON_ERROR_STOP off
begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

-- ─────────────────────────────── fixture: due scuole
insert into public.schools(codice_meccanografico, denominazione, provincia, tipo_istituto) values
  ('ZZ00000001', 'Scuola A', 'Napoli', 'Liceo'),
  ('ZZ00000002', 'Scuola B', 'Milano', 'Liceo');
insert into public.scuole_profili(id, scuola_id, stato) values
  ('91111111-0000-0000-0000-000000000091', 'ZZ00000001', 'attiva'),
  ('92222222-0000-0000-0000-000000000092', 'ZZ00000002', 'attiva');

-- il referente della scuola A, con la delega alle comunicazioni
insert into auth.users(id, email) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'ref@prova.it');
insert into public.profiles(id, ruolo, nome, cognome)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', 'referente_scuola', 'R', 'Ef');
insert into public.school_staff(scuola_profilo_id, user_id, ruolo_staff, attivo, puo_inviare_comunicazioni, creato_da)
  values ('91111111-0000-0000-0000-000000000091', 'bbbbbbbb-0000-0000-0000-00000000000b',
          'referente', true, true, 'bbbbbbbb-0000-0000-0000-00000000000b');

-- quattro studenti minorenni: verificato in A, DICHIARATO in A, verificato in
-- B, e uno SENZA NESSUNA RIGA di consegna (per il controllo di merito 8 — la
-- prima stesura usava lo studente della scuola B, che la sonda 2 aveva appena
-- reso destinatario: un controllo di merito contaminato da una sonda
-- precedente, cioè un rosso che nomina il difetto sbagliato).
insert into auth.users(id, email) values
  ('11111111-0000-0000-0000-000000000001', 'ver@prova.it'),
  ('33333333-0000-0000-0000-000000000003', 'dich@prova.it'),
  ('44444444-0000-0000-0000-000000000004', 'altra@prova.it'),
  ('55555555-0000-0000-0000-000000000005', 'estraneo@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-000000000001', 'studente', 'V', 'Erificato', '2010-01-01'),
  ('33333333-0000-0000-0000-000000000003', 'studente', 'D', 'Ichiarato', '2010-01-01'),
  ('44444444-0000-0000-0000-000000000004', 'studente', 'A', 'Ltra', '2010-01-01'),
  ('55555555-0000-0000-0000-000000000005', 'studente', 'E', 'Straneo', '2010-01-01');
insert into public.student_profiles(user_id, school_code, classe, anno_diploma, stato_verifica) values
  ('11111111-0000-0000-0000-000000000001', 'ZZ00000001', '3A', 2029, 'verificato'),
  ('33333333-0000-0000-0000-000000000003', 'ZZ00000001', '3A', 2029, 'dichiarato'),
  ('44444444-0000-0000-0000-000000000004', 'ZZ00000002', '3A', 2029, 'verificato'),
  ('55555555-0000-0000-0000-000000000005', 'ZZ00000002', '3A', 2029, 'verificato');

-- due messaggi: uno della scuola A (al verificato), uno della scuola B
insert into public.messaggi_scuola(id, scuola_profilo_id, mittente_user, oggetto, corpo, destinatari)
  values ('aa000000-0000-0000-0000-0000000000aa', '91111111-0000-0000-0000-000000000091',
          'bbbbbbbb-0000-0000-0000-00000000000b', 'Da A', 'corpo di A', 'tutta_scuola');
insert into public.messaggi_scuola_destinatari(messaggio_id, student_id)
  values ('aa000000-0000-0000-0000-0000000000aa', '11111111-0000-0000-0000-000000000001');
insert into public.messaggi_scuola(id, scuola_profilo_id, mittente_user, oggetto, corpo, destinatari)
  values ('bb000000-0000-0000-0000-0000000000bb', '92222222-0000-0000-0000-000000000092',
          'bbbbbbbb-0000-0000-0000-00000000000b', 'Da B', 'SEGRETO DI B', 'tutta_scuola');

do $$
declare n_msg int; n_dest int;
begin
  select count(*) into n_msg from public.messaggi_scuola;
  select count(*) into n_dest from public.messaggi_scuola_destinatari;
  insert into esiti values (0, 'la fixture non è vuota', '2 messaggi, 1 consegna',
    n_msg = 2 and n_dest = 1, n_msg || ' messaggi, ' || n_dest || ' consegne');
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000000b';

-- ═══ 1) la scuola non consegna a uno studente DICHIARATO non verificato ═══
-- L'unica delle quattro rosse che sia RAGGIUNGIBILE: lo staff vede i propri
-- studenti dichiarati, quindi ne conosce l'id.
do $$ begin
  insert into public.messaggi_scuola_destinatari(messaggio_id, student_id)
    values ('aa000000-0000-0000-0000-0000000000aa', '33333333-0000-0000-0000-000000000003');
  insert into esiti values (1, 'consegnare a uno studente DICHIARATO non verificato',
    'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (1, 'consegnare a uno studente DICHIARATO non verificato',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 2) né a uno studente di un'ALTRA scuola ═══
-- Dietro un uuid che lo staff non può ottenere: qui gliel'ha dato la fixture.
do $$ begin
  insert into public.messaggi_scuola_destinatari(messaggio_id, student_id)
    values ('aa000000-0000-0000-0000-0000000000aa', '44444444-0000-0000-0000-000000000004');
  insert into esiti values (2, 'consegnare a uno studente di un''ALTRA scuola',
    'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (2, 'consegnare a uno studente di un''ALTRA scuola',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 3) ⚠️ merito: la FUNZIONE rifiuta il non verificato ═══
-- È la strada vera, e fa la cosa giusta: la policy è più larga della regola.
do $$
declare n int;
begin
  perform public.invia_messaggio_scuola('selezione', 'Oggetto', 'Corpo', null,
    array['33333333-0000-0000-0000-000000000003']::uuid[], 'interno');
  select count(*) into n from public.messaggi_scuola_destinatari d
    join public.messaggi_scuola m on m.id = d.messaggio_id
   where m.oggetto = 'Oggetto' and d.student_id = '33333333-0000-0000-0000-000000000003';
  insert into esiti values (3, '⚠️ la FUNZIONE consegna al non verificato', '0 righe', n = 0, n || ' righe');
exception when others then
  insert into esiti values (3, '⚠️ la FUNZIONE consegna al non verificato', '0 righe', true, 'respinta: ' || sqlerrm);
end $$;

-- ═══ 4) lo studente non RIPUNTA la propria riga su un altro messaggio ═══
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
do $$ begin
  update public.messaggi_scuola_destinatari
     set messaggio_id = 'bb000000-0000-0000-0000-0000000000bb'
   where student_id = auth.uid() and messaggio_id = 'aa000000-0000-0000-0000-0000000000aa';
  if not found then raise exception 'nessuna riga aggiornata (RLS)'; end if;
  insert into esiti values (4, 'lo studente RIPUNTA la propria riga su un altro messaggio',
    'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (4, 'lo studente RIPUNTA la propria riga su un altro messaggio',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 5) …e non ne legge il corpo ═══
do $$
declare v text;
begin
  select corpo into v from public.messaggi_scuola where id = 'bb000000-0000-0000-0000-0000000000bb';
  insert into esiti values (5, '…e legge il corpo del messaggio di un''ALTRA scuola',
    'NESSUNO', v is null, coalesce('*** LEGGE: ' || v || ' ***', 'non lo legge'));
end $$;

-- ═══ 6) ⚠️ merito: segnare come letto il PROPRIO messaggio ═══
do $$ begin
  update public.messaggi_scuola_destinatari set letto_il = now() where student_id = auth.uid();
  if not found then raise exception 'nessuna riga aggiornata'; end if;
  insert into esiti values (6, '⚠️ lo studente segna ancora come letto il proprio messaggio',
    'riesce', true, 'riuscito');
exception when others then
  insert into esiti values (6, '⚠️ lo studente segna ancora come letto il proprio messaggio',
    'riesce', false, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 7) ⚠️ merito: la consegna legittima a uno studente VERIFICATO ═══
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000000b';
do $$
declare n int;
begin
  perform public.invia_messaggio_scuola('selezione', 'Legittimo', 'Corpo', null,
    array['11111111-0000-0000-0000-000000000001']::uuid[], 'interno');
  select count(*) into n from public.messaggi_scuola_destinatari d
    join public.messaggi_scuola m on m.id = d.messaggio_id
   where m.oggetto = 'Legittimo';
  insert into esiti values (7, '⚠️ la consegna legittima a uno studente VERIFICATO riesce',
    '1 riga', n = 1, n || ' righe');
exception when others then
  insert into esiti values (7, '⚠️ la consegna legittima a uno studente VERIFICATO riesce',
    '1 riga', false, 'respinta: ' || sqlerrm);
end $$;

-- ═══ 8) ⚠️ merito: chi non ha nessuna riga non legge nessun messaggio ═══
set local request.jwt.claim.sub = '55555555-0000-0000-0000-000000000005';
do $$
declare n int;
begin
  select count(*) into n from public.messaggi_scuola;
  insert into esiti values (8, '⚠️ uno studente senza nessuna consegna non legge nessun messaggio',
    '0 righe', n = 0, n || ' righe');
end $$;

reset role;

select n, proprieta, atteso,
       case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
