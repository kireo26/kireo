-- ⏳ IN QUARANTENA — queste proprietà sono ROSSE, e lo sono di proposito.
--
-- Sono scritte come le proprietà del sistema CURATO: asseriscono che il
-- tentativo venga respinto. Oggi passa. Il giorno della cura non si scrive
-- niente di nuovo — si toglie il nome da `scripts/quarantena.js` e si verifica
-- che diventino verdi; se non diventano verdi, la cura non è finita.
--
-- LA FALLA (5/10/2026, sesta della rassegna). Un tentativo di missione
-- `stato = 'completata'` NON È CONGELATO: i suoi ingressi si riscrivono, e la
-- funzione privilegiata che ne deriva le prove si richiama. Misurato:
-- `performance` da 30 a 95 sulla stessa area.
--
-- QUELLO CHE RENDE LA FALLA, e non è «si può rigiocare» — rigiocare è
-- previsto, c'è il bottone: `20260826120000_primo_tentativo_valido.sql` elegge
-- IL PRIMO tentativo apposta, con la ragione scritta («Non è una scappatoia
-- per rigiocare»). Riscrivere il primo *in posto* rende quella riga una
-- decorazione.
--
-- LA FORMA GENERALE, che è la ragione per cui vale la pena tenerla scritta:
-- «lo scrive solo il server» non vuol dire «lo determina solo il server». Una
-- funzione privilegiata che legge ingressi dell'utente trasferisce all'utente
-- esattamente il privilegio che credevamo di aver trattenuto.
--
-- PERCHÉ È ROSSA E NON CURATA: nessuna delle sue facce è cliccabile, nessuna
-- tocca dati di altri, nessuna produce un valore formale come le ore PCTO —
-- falsifica il PROPRIO ritratto. Si cura in un passaggio solo con le altre,
-- dopo aver finito di guardare le tabelle mute (decisione del 5/10).
--
-- LA CURA PREVISTA: una condizione sullo stato del contenitore nel `with
-- check` / `using` delle policy di `step_response`, come su `iscrizioni_eventi`
-- — più la stessa guardia dentro `registra_evidence`, che è il livello a cui
-- l'invariante è scritto.
--
-- ⚠️ LE PROPRIETÀ 4-5 SONO LA METÀ CHE LA CURA PUÒ ROMPERE: il player salva le
-- risposte di un tentativo IN CORSO, e la finalizzazione legittima gira su un
-- tentativo in corso. Se diventano rosse, la cura ha chiuso il gioco.
--
-- ⚠️ COSA NON ASSERISCE, e la ragione: sul lato TEST la stessa riscrittura è
-- possibile e NON è una falla — lì conta l'ULTIMO tentativo completato
-- (20260826120000), quindi rigiocare cambia già il ritratto per disegno e
-- riscrivere non aggiunge nessun potere. Se i test completati debbano
-- congelarsi è una decisione che nessuno ha preso, e un rosso su una scelta
-- non ancora presa è un rosso che qualcuno spegne.
--
-- Gira in una transazione con ROLLBACK: si incolla nel SQL Editor senza
-- lasciare niente.

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

-- il tentativo di S1, GIÀ COMPLETATO e con il revisore riuscito: è quello che
-- la regola del 23/08 elegge a tentativo che conta.
insert into public.mission_attempt(id, student_id, mission_slug, stato, stanza_corrente, revisore_esito)
  values ('aaaa0000-0000-0000-0000-00000000aaaa', '11111111-0000-0000-0000-000000000001',
          'progetto-quartiere', 'completata', 5, 'letto');
insert into public.step_response(attempt_id, stanza, step_id, tipo, payload)
  values ('aaaa0000-0000-0000-0000-00000000aaaa', 1, 's1_mandato', 'scelta_singola', '{"opzioneId":"educativo"}');
-- la prova del primo giro: un punteggio modesto, da cui si vedrà il salto
insert into public.evidence(student_id, attempt_id, dimensione, valore, peso, fonte, area_slug, motivazione, step_id, categoria)
  values ('11111111-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-00000000aaaa',
          'performance', 0.30, 1.0, 'mission', 'scienze-educazione', 'Dal primo giro.', 's1_mandato', 'area');
select public.ricalcola_area_signal('11111111-0000-0000-0000-000000000001', 'scienze-educazione');

-- e un secondo tentativo IN CORSO, per le due proprietà di merito
insert into public.mission_attempt(id, student_id, mission_slug, stato, stanza_corrente)
  values ('cccc0000-0000-0000-0000-00000000cccc', '11111111-0000-0000-0000-000000000001',
          'cantiere-scuola', 'in_corso', 1);
insert into public.step_response(attempt_id, stanza, step_id, tipo, payload)
  values ('cccc0000-0000-0000-0000-00000000cccc', 1, 's1_mandato', 'scelta_singola', '{"opzioneId":"elettrico"}');

-- LA FIXTURE DICHIARA QUANTE RIGHE HA MESSO: una prova che passa su un insieme
-- vuoto non ha provato niente, e lo dice con lo stesso verde di una che ha
-- provato tutto.
do $$
declare n_att int; n_resp int; n_prove int;
begin
  select count(*) into n_att from public.mission_attempt;
  select count(*) into n_resp from public.step_response;
  select count(*) into n_prove from public.evidence;
  insert into esiti values (0, 'la fixture non è vuota', '2 tentativi, 2 risposte, 1 prova',
    n_att = 2 and n_resp = 2 and n_prove = 1,
    n_att || ' tentativi, ' || n_resp || ' risposte, ' || n_prove || ' prove');
end $$;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';

-- ═══ 1) una risposta di un tentativo COMPLETATO non si riscrive ═══
do $$ begin
  update public.step_response set payload = '{"opzioneId":"economico"}'
   where attempt_id = 'aaaa0000-0000-0000-0000-00000000aaaa' and step_id = 's1_mandato';
  if not found then raise exception 'nessuna riga aggiornata (RLS)'; end if;
  insert into esiti values (1, 'riscrivere una risposta di un tentativo COMPLETATO',
    'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (1, 'riscrivere una risposta di un tentativo COMPLETATO',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 2) …e non se ne aggiunge una che in quel giro non c'era ═══
do $$ begin
  insert into public.step_response(attempt_id, stanza, step_id, tipo, payload)
    values ('aaaa0000-0000-0000-0000-00000000aaaa', 4, 's4_proposta', 'testo', '{"testo":"aggiunta dopo"}');
  insert into esiti values (2, 'AGGIUNGERE una risposta a un tentativo COMPLETATO',
    'RESPINTO', false, '*** PASSA ***');
exception when others then
  insert into esiti values (2, 'AGGIUNGERE una risposta a un tentativo COMPLETATO',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 3) e la funzione privilegiata non rigira sullo stesso tentativo ═══
-- È questa che fa il danno: ricalcolo totale (delete + insert), quindi le prove
-- del primo giro vengono SOSTITUITE.
do $$
declare v numeric;
begin
  perform public.registra_evidence('aaaa0000-0000-0000-0000-00000000aaaa',
    '[{"dimensione":"performance","valore":0.95,"peso":1.0,"fonte":"mission",
       "area_slug":"scienze-educazione","motivazione":"Dal secondo giro.","step_id":"s1_mandato"}]'::jsonb);
  select performance_score into v from public.area_signal
   where student_id = '11111111-0000-0000-0000-000000000001' and area_slug = 'scienze-educazione';
  insert into esiti values (3, 'rifinalizzare lo STESSO tentativo già completato',
    'RESPINTO', false, '*** PASSA: performance ' || coalesce(v::text, 'null') || ' (era 30) ***');
exception when others then
  insert into esiti values (3, 'rifinalizzare lo STESSO tentativo già completato',
    'RESPINTO', true, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 4) ⚠️ LA METÀ CHE LA CURA PUÒ ROMPERE: il player salva su un tentativo IN CORSO
do $$ begin
  update public.step_response set payload = '{"opzioneId":"accessibilita"}'
   where attempt_id = 'cccc0000-0000-0000-0000-00000000cccc' and step_id = 's1_mandato';
  if not found then raise exception 'nessuna riga aggiornata (RLS)'; end if;
  insert into public.step_response(attempt_id, stanza, step_id, tipo, payload)
    values ('cccc0000-0000-0000-0000-00000000cccc', 2, 's2_informazioni', 'seleziona_informazioni', '{"selezionati":["m4"]}');
  insert into esiti values (4, '⚠️ il player salva ancora su un tentativo IN CORSO',
    'riesce', true, 'riuscito: riscritta una risposta e aggiunta una nuova');
exception when others then
  insert into esiti values (4, '⚠️ il player salva ancora su un tentativo IN CORSO',
    'riesce', false, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 5) ⚠️ …e la finalizzazione legittima gira su un tentativo IN CORSO
do $$
declare v_stato text;
begin
  perform public.registra_evidence('cccc0000-0000-0000-0000-00000000cccc',
    '[{"dimensione":"performance","valore":0.70,"peso":1.0,"fonte":"mission",
       "area_slug":"edilizia-architettura","motivazione":"Dal giro vero.","step_id":"s1_mandato"}]'::jsonb);
  select stato into v_stato from public.mission_attempt where id = 'cccc0000-0000-0000-0000-00000000cccc';
  insert into esiti values (5, '⚠️ la finalizzazione legittima chiude ancora un tentativo IN CORSO',
    'completata', v_stato = 'completata', 'stato=' || coalesce(v_stato, 'null'));
exception when others then
  insert into esiti values (5, '⚠️ la finalizzazione legittima chiude ancora un tentativo IN CORSO',
    'completata', false, 'respinto: ' || sqlerrm);
end $$;

-- ═══ 6-7) e un estraneo non tocca né legge le risposte di S1 ═══
set local request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  update public.step_response set payload = '{"opzioneId":"x"}'
   where attempt_id = 'aaaa0000-0000-0000-0000-00000000aaaa';
  get diagnostics n = row_count;
  insert into esiti values (6, 'un ALTRO studente riscrive le risposte di S1', '0 righe', n = 0, n || ' righe');
exception when others then
  insert into esiti values (6, 'un ALTRO studente riscrive le risposte di S1', '0 righe', true, 'respinto: ' || sqlerrm);
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.step_response where attempt_id = 'aaaa0000-0000-0000-0000-00000000aaaa';
  insert into esiti values (7, 'un ALTRO studente legge le risposte di S1', '0 righe', n = 0, n || ' righe');
end $$;

reset role;

select n, proprieta, atteso,
       case when coalesce(ok, false) then 'ok' else 'ROTTO' end as esito, osservato
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' verificate' as riassunto,
       count(*) filter (where not coalesce(ok, false)) || ' ROTTE' as rotte
from esiti;

rollback;
