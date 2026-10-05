-- ⏳ IN QUARANTENA — la proprietà 1 è ROSSA, e lo è di proposito.
--
-- Scritta come la proprietà del sistema CURATO: lo studente non riscrive la
-- riga che congela le candidate di T3. Oggi la riscrive. Il giorno della cura
-- non si scrive niente di nuovo — si toglie il nome da `scripts/quarantena.js`
-- e si verifica che diventi verde.
--
-- LA FALLA (5/10/2026, seconda faccia della sesta). `__t3_frozen__` è una riga
-- SINTETICA di `test_response`, scritta da `/api/test/t3/inizia`, che congela
-- le aree candidate del torneo. Lo studente la vede e la riscrive.
--
-- MISURATO, non dedotto — eseguito `calcolaEvidenzeT3` con candidate
-- fabbricate, cinque aree mai toccate:
--
--     sicurezza-difesa                  valore 1      peso 0.35
--     edilizia-architettura             valore 0.5
--     lingue-relazioni-internazionali   valore 0.25
--     musica-spettacolo                 valore 0.667
--
-- `sicurezza-difesa` è l'area che il censimento dà a UN tag in tutto il motore
-- (raggiungibile solo scrivendone). E le candidate vengono SOLO da quella riga
-- — «mai rilette da area_signal», sta scritto in lib/test/scoring.ts — quindi
-- nessun rigioco produrrebbe quelle aree: rigiocando T3 si riderivano dal
-- profilo.
--
-- ⚠️ QUESTA È PIÙ NETTA DELLA PRIMA FACCIA, perché non deve aggirare nessun
-- congelamento: deve solo riscrivere il congelamento. E il difetto non è una
-- policy, è un POSTO:
--
--   «Uno stato di sistema che abita una tabella dell'utente è scrivibile da
--    chiunque possa scrivere quella tabella.»
--
-- Nessuna policy lo salva, perché la riga la scrive la route NELLA SESSIONE
-- DELLO STUDENTE: lì il client e il server sono la stessa identità. È la
-- lezione del 5/10 (un controllo non può distinguere da dove arriva una
-- scrittura quando l'identità è la stessa).
--
-- LA CURA PREVISTA: il congelamento passa a una SECURITY DEFINER e quella
-- `item_id` è vietata al client — cioè un posto diverso, non una clausola. E
-- già che si sposta, resta la domanda aperta per Mario: se il congelamento è
-- uno stato di sistema, `test_response` è la sua casa? Una riga che non è una
-- risposta sta in mezzo alle risposte perché era comodo.
--
-- ⚠️ LA PROPRIETÀ 2 È LA METÀ CHE LA CURA PUÒ ROMPERE: una policy scritta
-- troppo larga chiuderebbe anche le risposte vere del torneo, cioè il gioco.
--
-- ⚠️ COSA NON ASSERISCE, e la ragione. Che lo studente non LEGGA la riga: è una
-- scelta di progetto non ancora presa (se il congelamento cambia casa, la
-- lettura cambia con lui), e un rosso su una scelta non presa è un rosso che
-- qualcuno spegne. La proprietà 0 la misura e la stampa senza giudicarla.
--
-- Gira in una transazione con ROLLBACK.

\set ON_ERROR_STOP off
begin;

create temp table esiti(n int, proprieta text, atteso text, ok boolean, osservato text);
grant all on esiti to anon, authenticated;

-- ─────────────────────────────── fixture
insert into auth.users(id, email) values ('11111111-0000-0000-0000-000000000001', 's1@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
  values ('11111111-0000-0000-0000-000000000001', 'studente', 'S', 'Uno', '2006-01-01');
insert into auth.users(id, email) values ('22222222-0000-0000-0000-000000000002', 's2@prova.it');
insert into public.profiles(id, ruolo, nome, cognome, data_nascita)
  values ('22222222-0000-0000-0000-000000000002', 'studente', 'S', 'Due', '2006-01-01');

-- il tentativo T3 in corso, con la riga sintetica scritta DALLA ROUTE
insert into public.test_attempt(id, student_id, test_slug, stato)
  values ('bbbb0000-0000-0000-0000-00000000bbbb', '11111111-0000-0000-0000-000000000001', 't3-confronti', 'in_corso');
insert into public.test_response(attempt_id, item_id, payload)
  values ('bbbb0000-0000-0000-0000-00000000bbbb', '__t3_frozen__',
          '{"candidate":["salute-professioni-sanitarie","scienze-educazione","economia-management"],"asseDominante":"metodo"}');

-- La fixture dichiara quante righe ha messo.
do $$
declare n int;
begin
  select count(*) into n from public.test_response where attempt_id = 'bbbb0000-0000-0000-0000-00000000bbbb';
  insert into esiti values (-1, 'la fixture non è vuota', '1 riga sintetica', n = 1, n || ' righe');
end $$;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';

-- ═══ 0) MISURATA E NON GIUDICATA: lo studente la vede ═══
do $$
declare v text;
begin
  select payload::text into v from public.test_response
   where attempt_id = 'bbbb0000-0000-0000-0000-00000000bbbb' and item_id = '__t3_frozen__';
  insert into esiti values (0, 'lo studente VEDE la riga che congela le candidate',
    '(scelta di progetto, non asserita)', true,
    coalesce('la legge: ' || left(v, 50) || '…', 'non la vede'));
end $$;

-- ═══ 1) e NON la riscrive ═══
do $$
declare v text;
begin
  update public.test_response
     set payload = '{"candidate":["sicurezza-difesa","musica-spettacolo","edilizia-architettura",
                     "lingue-relazioni-internazionali","studi-umanistici-beni-culturali"],"asseDominante":"metodo"}'
   where attempt_id = 'bbbb0000-0000-0000-0000-00000000bbbb' and item_id = '__t3_frozen__';
  if not found then raise exception 'nessuna riga aggiornata (RLS)'; end if;
  select payload->'candidate'->>0 into v from public.test_response
   where attempt_id = 'bbbb0000-0000-0000-0000-00000000bbbb' and item_id = '__t3_frozen__';
  insert into esiti values (1, 'RISCRIVERE le candidate congelate dal server',
    'RESPINTO', false, '*** PASSA: la prima candidata è ora ' || v || ' ***');
exception when others then
  insert into esiti values (1, 'RISCRIVERE le candidate congelate dal server',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 2) ⚠️ LA METÀ CHE LA CURA PUÒ ROMPERE: le risposte vere del torneo ═══
do $$ begin
  insert into public.test_response(attempt_id, item_id, payload)
    values ('bbbb0000-0000-0000-0000-00000000bbbb', 't3_c1', '{"opzioneId":"a"}');
  update public.test_response set payload = '{"opzioneId":"b"}'
   where attempt_id = 'bbbb0000-0000-0000-0000-00000000bbbb' and item_id = 't3_c1';
  insert into esiti values (2, '⚠️ lo studente risponde ancora agli item veri del torneo',
    'riesce', true, 'riuscito: scritta e riscritta una risposta del torneo');
exception when others then
  insert into esiti values (2, '⚠️ lo studente risponde ancora agli item veri del torneo',
    'riesce', false, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 3) e un estraneo non tocca il congelamento di S1 ═══
set local request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  update public.test_response set payload = '{"candidate":[]}'
   where attempt_id = 'bbbb0000-0000-0000-0000-00000000bbbb';
  get diagnostics n = row_count;
  insert into esiti values (3, 'un ALTRO studente riscrive le candidate di S1', '0 righe', n = 0, n || ' righe');
exception when others then
  insert into esiti values (3, 'un ALTRO studente riscrive le candidate di S1', '0 righe', true, 'respinto: ' || sqlerrm);
end $$;

reset role;

select n, proprieta, atteso,
       case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
