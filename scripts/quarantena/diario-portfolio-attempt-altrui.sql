-- ⏳ IN QUARANTENA — le proprietà 1-2 sono ROSSE, e lo sono di proposito.
--
-- Scritte come le proprietà del sistema CURATO: una riga di diario o di
-- portfolio non si appende al tentativo di un altro studente. Oggi si appende.
--
-- LA FALLA (5/10/2026, le due minori della sesta passata). In `journal_entry` e
-- `portfolio_item` l'`attempt_id` NON è vincolato: le policy di insert
-- verificano `student_id = auth.uid()` — DI CHI è la riga — e non a quale
-- tentativo punta. Sesta e settima occorrenza della specie.
--
-- ⚠️ LA SPECIE È NUOVA, E IL NOME È QUELLO CHE CONTA: una riga che oggi non ha
-- lettori, e domani ne avrà. L'assenza di conseguenza è TEMPORANEA; il dato è
-- PERMANENTE. Si pianta adesso e germoglia il giorno in cui qualcuno costruisce
-- la funzione che lo legge — cioè nel momento in cui nessuno starà cercando un
-- difetto, perché starà guardando una cosa nuova che finalmente funziona.
--
-- CONSEGUENZA OGGI: nessuna. Quelle due tabelle le scrive solo
-- `app/api/escape/finalizza` e NON LE LEGGE NESSUNO [verificato su app/,
-- components/, lib/ — il portfolio e il diario «ricchi» sono dichiarati fuori
-- scope]. Il giorno in cui si costruisce il portfolio leggendo per
-- `attempt_id`, quella riga comparirà nel portfolio di un altro.
--
-- L'AGGRAVANTE, misurata (proprietà 3-4): il proprietario del tentativo NON la
-- vede (la lettura è `student_id = auth.uid()`) e il suo `delete` NON la tocca
-- (anche quello è per `student_id`). Quindi non è rimovibile da chi ne
-- subirebbe l'effetto.
--
-- LA CURA PREVISTA: una riga nel `with check` — l'`attempt_id`, quando c'è,
-- deve essere di un tentativo del chiamante. Va nel passaggio unico con le
-- altre (decisione del 5/10: si finisce di guardare, poi si cura tutto).
--
-- ⚠️ LA PROPRIETÀ 5 È LA METÀ CHE LA CURA PUÒ ROMPERE: `finalizza` scrive
-- esattamente una riga col PROPRIO `attempt_id`, e deve continuare a riuscire.
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

-- un tentativo di S1 e uno di S2
insert into public.mission_attempt(id, student_id, mission_slug, stato, stanza_corrente)
  values ('aaaa0000-0000-0000-0000-00000000aaaa', '11111111-0000-0000-0000-000000000001',
          'progetto-quartiere', 'completata', 5);
insert into public.mission_attempt(id, student_id, mission_slug, stato, stanza_corrente)
  values ('dddd0000-0000-0000-0000-00000000dddd', '22222222-0000-0000-0000-000000000002',
          'progetto-quartiere', 'in_corso', 3);

do $$
declare n int;
begin
  select count(*) into n from public.mission_attempt;
  insert into esiti values (0, 'la fixture non è vuota', '2 tentativi, uno per studente', n = 2, n || ' tentativi');
end $$;

set local role authenticated;
set local request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';

-- ═══ 1) un diario non si appende al tentativo di un altro ═══
do $$ begin
  insert into public.journal_entry(student_id, attempt_id, testo)
    values (auth.uid(), 'aaaa0000-0000-0000-0000-00000000aaaa', 'appeso al tentativo di un altro');
  insert into esiti values (1, 'appendere un DIARIO al tentativo di un ALTRO studente',
    'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (1, 'appendere un DIARIO al tentativo di un ALTRO studente',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 2) né un portfolio ═══
do $$ begin
  insert into public.portfolio_item(student_id, attempt_id, titolo, contenuto)
    values (auth.uid(), 'aaaa0000-0000-0000-0000-00000000aaaa', 'Appeso', '{}'::jsonb);
  insert into esiti values (2, 'appendere un PORTFOLIO al tentativo di un ALTRO studente',
    'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (2, 'appendere un PORTFOLIO al tentativo di un ALTRO studente',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 3-4) L'AGGRAVANTE: il proprietario non la vede e non la cancella ═══
-- Misurate, non asserite come difetto: descrivono perché la riga è permanente.
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
do $$
declare n int;
begin
  select count(*) into n from public.journal_entry where attempt_id = 'aaaa0000-0000-0000-0000-00000000aaaa';
  insert into esiti values (3, 'il proprietario del tentativo VEDE la riga appesa da un altro',
    '(aggravante: no)', true, n || ' righe visibili su 1 esistente');
end $$;

do $$
declare n int;
begin
  -- è quello che fa `finalizza` prima di reinserire: `.delete().eq("attempt_id", …)`
  delete from public.journal_entry where attempt_id = 'aaaa0000-0000-0000-0000-00000000aaaa';
  get diagnostics n = row_count;
  insert into esiti values (4, 'il suo `delete` (quello di finalizza) la RIMUOVE',
    '(aggravante: no)', true, n || ' righe cancellate su 1 esistente');
end $$;

-- ═══ 5) ⚠️ LA METÀ CHE LA CURA PUÒ ROMPERE: finalizza scrive sul PROPRIO ═══
do $$ begin
  insert into public.journal_entry(student_id, attempt_id, testo)
    values (auth.uid(), 'aaaa0000-0000-0000-0000-00000000aaaa', 'la riflessione vera');
  insert into public.portfolio_item(student_id, attempt_id, titolo, contenuto)
    values (auth.uid(), 'aaaa0000-0000-0000-0000-00000000aaaa', 'La mia proposta', '{"testo":"…"}'::jsonb);
  insert into esiti values (5, '⚠️ finalizza scrive ancora diario e portfolio sul PROPRIO tentativo',
    'riesce', true, 'riuscito: entrambe le righe scritte');
exception when others then
  insert into esiti values (5, '⚠️ finalizza scrive ancora diario e portfolio sul PROPRIO tentativo',
    'riesce', false, 'respinto: ' || sqlerrm);
end $$;

reset role;

select n, proprieta, atteso,
       case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
