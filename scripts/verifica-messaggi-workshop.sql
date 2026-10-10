-- Le cinque tabelle mute del censimento del silenzio, provate per esecuzione,
-- e la cura di `workshop_messaggi` (migrazione 20261010100000).
--
-- Gira contro una replica locale e si incolla anche nel SQL Editor di
-- Supabase: tutto sta in una transazione che finisce con ROLLBACK, e l'ultima
-- istruzione è un `select` invece di un silenzio.
--
-- ⚠️ LA LEZIONE CHE HA RESO ONESTO QUESTO FILE, e vale per ogni sondino
-- futuro sulle policy: UN'ECCEZIONE NON È L'UNICO MODO IN CUI UNA SCRITTURA
-- NON SUCCEDE. Su INSERT una policy mancante solleva `insufficient_privilege`;
-- su UPDATE e DELETE la RLS FILTRA LE RIGHE invece di sollevare, quindi senza
-- policy l'istruzione RIESCE e tocca zero righe. La prima stesura leggeva
-- «nessuna eccezione» come «ha scritto» e dava NOVE rossi su quattro tabelle
-- sane — un rosso che nomina il difetto sbagliato, cioè la cosa peggiore di
-- nessun rosso, perché manda a riparare la tabella giusta per il motivo
-- sbagliato. Quindi si conta: `get diagnostics … row_count`, e zero righe
-- toccate è «respinta», non «passata».

\set ON_ERROR_STOP on
\pset pager off

begin;

-- ── la scena: due studenti compagni dello stesso workshop, e un ente
insert into auth.users (id, email) values
  ('11110000-0000-0000-0000-000000000001', 's1@prova.it'),
  ('22220000-0000-0000-0000-000000000002', 's2@prova.it'),
  ('33330000-0000-0000-0000-000000000003', 'e1@prova.it'),
  ('44440000-0000-0000-0000-000000000004', 's3@prova.it');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11110000-0000-0000-0000-000000000001', 'studente', 'Anna', 'Rossi', '2006-03-01'),
  ('22220000-0000-0000-0000-000000000002', 'studente', 'Luca', 'Bianchi', '2006-04-01'),
  ('33330000-0000-0000-0000-000000000003', 'istituzione', 'Ente', 'Uno', '1980-01-01'),
  ('44440000-0000-0000-0000-000000000004', 'studente', 'Sara', 'Verdi', '2006-05-01');

insert into public.istituzioni (id, nome, slug, stato, piano_id)
  values ('b0110000-0000-0000-0000-0000000000b1', 'Ente Uno', 'ente-uno', 'attiva',
          (select id from public.piani where nome = 'plus'));
insert into public.institution_profiles (user_id, istituzione_id)
  values ('33330000-0000-0000-0000-000000000003', 'b0110000-0000-0000-0000-0000000000b1');

insert into public.workshop (id, slug, titolo, descrizione, attivo)
  values ('c0110000-0000-0000-0000-0000000000c1', 'prova-censimento', 'Prova', 'd', true);
insert into public.workshop_ruoli (id, workshop_id, slug, titolo, area_slug) values
  ('d0110000-0000-0000-0000-0000000000d1', 'c0110000-0000-0000-0000-0000000000c1', 'uno', 'Uno', 'informatica-digitale'),
  ('d0220000-0000-0000-0000-0000000000d2', 'c0110000-0000-0000-0000-0000000000c1', 'due', 'Due', 'scienze-ricerca');
insert into public.workshop_iscrizioni (id, student_id, workshop_id, ruolo_id, stato) values
  ('f0110000-0000-0000-0000-0000000000f1', '11110000-0000-0000-0000-000000000001', 'c0110000-0000-0000-0000-0000000000c1', 'd0110000-0000-0000-0000-0000000000d1', 'attivo'),
  ('f0220000-0000-0000-0000-0000000000f2', '22220000-0000-0000-0000-000000000002', 'c0110000-0000-0000-0000-0000000000c1', 'd0220000-0000-0000-0000-0000000000d2', 'attivo');

create temp table esiti (n int, tab text, proprieta text, trovato text, ok boolean);
-- il registro deve essere scrivibile anche dai blocchi che cambiano ruolo
grant all on esiti to anon, authenticated;

-- Esegue una scrittura e la classifica contando le righe, non le eccezioni.
create or replace function pg_temp.prova(n int, tab text, prop text, sql text, atteso text)
returns void language plpgsql as $f$
declare righe bigint;
begin
  execute sql;
  get diagnostics righe = row_count;
  if righe = 0 then
    insert into esiti values (n, tab, prop, 'nessuna riga toccata', atteso = 'respinta');
  else
    insert into esiti values (n, tab, prop, 'PASSATA (' || righe || ')', atteso = 'passa');
  end if;
exception
  when insufficient_privilege then
    insert into esiti values (n, tab, prop, 'respinta (permesso)', atteso = 'respinta');
  when others then
    insert into esiti values (n, tab, prop, 'respinta (' || sqlerrm || ')', atteso = 'respinta');
end $f$;
grant execute on function pg_temp.prova(int, text, text, text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════ workshop_messaggi
-- 1. LA VIA LEGITTIMA, che è la metà che la cura poteva rompere.
set local role authenticated;
set local request.jwt.claim.sub = '11110000-0000-0000-0000-000000000001';
select public.invia_messaggio_rete_workshop(
  'c0110000-0000-0000-0000-0000000000c1',
  '22220000-0000-0000-0000-000000000002',
  'messaggio vero di Anna');
reset role;
insert into esiti select 1, 'workshop_messaggi', 'la via legittima scrive (invia_messaggio_rete_workshop)',
  c::text, c = 1 from (select count(*) c from public.workshop_messaggi) t;

-- 2. il client non scrive in diretto
set local role authenticated;
set local request.jwt.claim.sub = '11110000-0000-0000-0000-000000000001';
do $b$ begin perform pg_temp.prova(2, 'workshop_messaggi', 'il client scrive un messaggio in diretto',
  $$insert into public.workshop_messaggi (workshop_id, mittente_id, destinatario_id, contenuto)
    values ('c0110000-0000-0000-0000-0000000000c1','11110000-0000-0000-0000-000000000001',
            '22220000-0000-0000-0000-000000000002','in diretto')$$, 'respinta'); end $b$;
reset role;

-- 3. IL DESTINATARIO SEGNA COME LETTO — l'altra metà che la cura poteva
--    rompere: è il gesto che `NetworkPeers` fa a ogni apertura della chat.
set local role authenticated;
set local request.jwt.claim.sub = '22220000-0000-0000-0000-000000000002';
do $b$ begin perform pg_temp.prova(3, 'workshop_messaggi', 'il destinatario segna come letto',
  $$update public.workshop_messaggi set letto = true
    where workshop_id = 'c0110000-0000-0000-0000-0000000000c1'$$, 'passa'); end $b$;

-- 4. …e NON riscrive le parole del mittente (la falla del 10/10)
do $b$ begin perform pg_temp.prova(4, 'workshop_messaggi', 'il destinatario riscrive le parole del mittente',
  $$update public.workshop_messaggi set contenuto = 'MAI DETTO DA ANNA' where true$$, 'respinta'); end $b$;

-- 5. né le riscrive insieme a `letto`, che gli è concesso
do $b$ begin perform pg_temp.prova(5, 'workshop_messaggi', 'il destinatario riscrive il contenuto insieme a letto',
  $$update public.workshop_messaggi set letto = true, contenuto = 'MAI DETTO' where true$$, 'respinta'); end $b$;

-- 6. né si fa passare per mittente
do $b$ begin perform pg_temp.prova(6, 'workshop_messaggi', 'il destinatario si fa passare per mittente',
  $$update public.workshop_messaggi set mittente_id = '22220000-0000-0000-0000-000000000002' where true$$, 'respinta'); end $b$;

-- 7. né cancella un messaggio ricevuto
do $b$ begin perform pg_temp.prova(7, 'workshop_messaggi', 'il destinatario cancella un messaggio ricevuto',
  $$delete from public.workshop_messaggi where true$$, 'respinta'); end $b$;
reset role;

-- 8. il contenuto, dopo tutti i tentativi, è ancora quello di Anna
insert into esiti select 8, 'workshop_messaggi', 'il contenuto è ancora quello del mittente',
  contenuto, contenuto = 'messaggio vero di Anna' from public.workshop_messaggi limit 1;

-- 9. il mittente non segna come letto al posto del destinatario
set local role authenticated;
set local request.jwt.claim.sub = '11110000-0000-0000-0000-000000000001';
do $b$ begin perform pg_temp.prova(9, 'workshop_messaggi', 'il mittente segna come letto al posto del destinatario',
  $$update public.workshop_messaggi set letto = false where true$$, 'respinta'); end $b$;
reset role;

-- 10. uno studente estraneo alla conversazione non vede niente
set local role authenticated;
set local request.jwt.claim.sub = '44440000-0000-0000-0000-000000000004';
insert into esiti select 10, 'workshop_messaggi', 'un estraneo alla conversazione non legge niente',
  c::text, c = 0 from (select count(*) c from public.workshop_messaggi) t;
reset role;

-- 11. un anonimo non muove niente
set local role anon;
do $b$ begin perform pg_temp.prova(11, 'workshop_messaggi', 'un anonimo segna come letto',
  $$update public.workshop_messaggi set letto = true where true$$, 'respinta'); end $b$;
reset role;

-- ════════════════════════════════════════════════════ messaggi_enti
set local role authenticated;
set local request.jwt.claim.sub = '11110000-0000-0000-0000-000000000001';
select public.apri_conversazione_ente('b0110000-0000-0000-0000-0000000000b1', 'ciao');
do $b$ begin perform pg_temp.prova(12, 'messaggi_enti', 'il client scrive un messaggio in diretto',
  $$insert into public.messaggi_enti (conversazione_id, mittente, corpo)
    select id, 'studente', 'in diretto' from public.conversazioni_enti limit 1$$, 'respinta'); end $b$;
do $b$ begin perform pg_temp.prova(13, 'messaggi_enti', 'il client riscrive il corpo di un messaggio',
  $$update public.messaggi_enti set corpo = 'riscritto' where true$$, 'respinta'); end $b$;
do $b$ begin perform pg_temp.prova(14, 'messaggi_enti', 'il client cancella un messaggio',
  $$delete from public.messaggi_enti where true$$, 'respinta'); end $b$;
reset role;

-- ════════════════════════════════════════════════════ workshop / workshop_ruoli
set local role authenticated;
set local request.jwt.claim.sub = '11110000-0000-0000-0000-000000000001';
do $b$ begin perform pg_temp.prova(15, 'workshop', 'il client crea un workshop',
  $$insert into public.workshop (slug, titolo, descrizione, attivo)
    values ('finto','F','d',true)$$, 'respinta'); end $b$;
do $b$ begin perform pg_temp.prova(16, 'workshop', 'il client riaccende un workshop',
  $$update public.workshop set attivo = true where true$$, 'respinta'); end $b$;
do $b$ begin perform pg_temp.prova(17, 'workshop_ruoli', 'il client crea un ruolo',
  $$insert into public.workshop_ruoli (workshop_id, slug, titolo, area_slug)
    values ('c0110000-0000-0000-0000-0000000000c1','finto','F','sicurezza-difesa')$$, 'respinta'); end $b$;
-- la riga che conta: `area_slug` decide su quale area finisce il credito
do $b$ begin perform pg_temp.prova(18, 'workshop_ruoli', 'il client sposta l''area di un ruolo (il credito di fine progetto)',
  $$update public.workshop_ruoli set area_slug = 'sicurezza-difesa' where true$$, 'respinta'); end $b$;
reset role;

-- ════════════════════════════════════════════════════ workshop_consegne
-- Ancorata alla propria iscrizione (19-20), append-only (21-22) — e con il
-- 🟡 che resta aperto di proposito (23): il giudizio se lo scrive il client.
-- Non è un rosso perché è lo stato di oggi, verificato: va nella passata
-- unica del censimento.
set local role authenticated;
set local request.jwt.claim.sub = '11110000-0000-0000-0000-000000000001';
do $b$ begin perform pg_temp.prova(19, 'workshop_consegne', 'la consegna sulla propria iscrizione',
  $$insert into public.workshop_consegne (iscrizione_id, file_nome, file_percorso, file_tipo, file_dimensione)
    values ('f0110000-0000-0000-0000-0000000000f1','x.pdf','p/x.pdf','application/pdf',1)$$, 'passa'); end $b$;
do $b$ begin perform pg_temp.prova(20, 'workshop_consegne', 'la consegna sull''iscrizione di un altro',
  $$insert into public.workshop_consegne (iscrizione_id, file_nome, file_percorso, file_tipo, file_dimensione)
    values ('f0220000-0000-0000-0000-0000000000f2','y.pdf','p/y.pdf','application/pdf',1)$$, 'respinta'); end $b$;
do $b$ begin perform pg_temp.prova(21, 'workshop_consegne', 'il client riscrive una consegna già fatta',
  $$update public.workshop_consegne set file_nome = 'z.pdf' where true$$, 'respinta'); end $b$;
do $b$ begin perform pg_temp.prova(22, 'workshop_consegne', 'il client cancella una consegna',
  $$delete from public.workshop_consegne where true$$, 'respinta'); end $b$;
do $b$ begin perform pg_temp.prova(23, 'workshop_consegne', '🟡 NOTO: il client si scrive da sé il giudizio AI',
  $$insert into public.workshop_consegne (iscrizione_id, file_nome, file_percorso, file_tipo, file_dimensione, feedback_ai, stato)
    values ('f0110000-0000-0000-0000-0000000000f1','w.pdf','p/w.pdf','application/pdf',1,
            '{"punti_forza":["me lo scrivo io"]}'::jsonb,'analizzato')$$, 'passa'); end $b$;
reset role;

-- ════════════════════════════════════════════════════
select n, tab, proprieta, trovato,
       case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) as verificate,
       count(*) filter (where not coalesce(ok, false)) as rotte
from esiti;

rollback;
