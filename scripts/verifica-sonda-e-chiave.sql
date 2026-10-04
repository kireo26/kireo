-- Verifica delle due migrazioni del 4/10: il vincolo sull'incorporamento
-- (20261004100000_sonda_incorporamento.sql) e la chiave di trasmissione
-- (20261004110000 + 20261004120000).
--
-- Gira anche nel SQL Editor di Supabase: tutto dentro una transazione che
-- finisce con ROLLBACK, e in coda un `select` invece di un silenzio — un file
-- che non stampa niente non si distingue da un file che non è stato eseguito.
--
-- LA CONTROPROVA, e va fatta su una replica NATA SENZA il fix: un
-- `create or replace` conserva privilegi e stato, e `add constraint` su una
-- replica che il vincolo nuovo ce l'ha già non prova niente. Ricostruire da
-- zero costa un minuto.
--   - togliendo la clausola `or incorporamento_sonda = 'attivo'` dal vincolo
--     diventa rossa la proprietà 2 (la misura non basta più da sola);
--   - togliendo `if public.current_ruolo() is distinct from 'admin'` dalla
--     funzione diventa rossa la 8 (un ente qualunque imposta la chiave di
--     chiunque);
--   - togliendo `revoke all ... from public, anon` diventa rossa la 9. Quel
--     caso fallisce con `non_autorizzato` invece di `insufficient_privilege`:
--     vuol dire che il permesso ha ceduto e si è arrivati alla guardia, che è
--     la seconda porta, non la prima;
--   - sostituendo i due tipi di notifica con uno solo diventa rossa la 18
--     (una rotazione muta: l'ente riprova con la chiave vecchia).

begin;

set local role postgres;

create temporary table esiti (n int, nome text, esito text) on commit drop;

-- ---------------------------------------------------------------- dati
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'ente@test.it'),
  ('33333333-3333-3333-3333-333333333333', 'altroente@test.it'),
  ('44444444-4444-4444-4444-444444444444', 'studente@test.it');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-1111-1111-1111-111111111111', 'admin', 'A', 'Dmin', '1980-01-01'),
  ('22222222-2222-2222-2222-222222222222', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('33333333-3333-3333-3333-333333333333', 'istituzione', 'Al', 'Tro', '1980-01-01'),
  ('44444444-4444-4444-4444-444444444444', 'studente', 'St', 'Udente', '2008-01-01');

insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ente Uno', 'ente-uno', 'universita', 'attiva'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ente Due', 'ente-due', 'universita', 'attiva');

insert into public.institution_profiles (user_id, istituzione_id) values
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000002');

-- =================================================================
-- §1 — IL VINCOLO SULL'INCORPORAMENTO
-- =================================================================

-- 1) La sola DICHIARAZIONE basta: è il ramo in cui la sonda non ha potuto
--    misurare, e lì la spunta è l'unica cosa che c'è.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                             hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il, incorporamento_sonda)
  values ('e0000000-0000-0000-0000-000000000001', 'Solo dichiarazione', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti',
          'proprio', 'abcdefghijk',
          '{"non_in_elenco":"2026-10-04T10:00:00Z","chat_disattivata":"2026-10-04T10:00:00Z","no_contenuti_terzi":"2026-10-04T10:00:00Z","incorporamento_attivo":"2026-10-04T10:00:00Z"}'::jsonb,
          now(), 'non_controllato');
  insert into esiti values (1, 'dichiarazione senza misura: accettata', 'OK');
exception when others then
  insert into esiti values (1, 'dichiarazione senza misura: accettata', 'ROTTO — ' || sqlerrm);
end $$;

-- 2) La sola MISURA basta, e senza nessuna dichiarazione: dove la sonda ha
--    risposto non c'è nessuna spunta da registrare, e registrarla sarebbe
--    scrivere una dichiarazione che nessuno ha fatto.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                             hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il, incorporamento_sonda)
  values ('e0000000-0000-0000-0000-000000000002', 'Solo misura', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti',
          'proprio', 'abcdefghijk',
          '{"non_in_elenco":"2026-10-04T10:00:00Z","chat_disattivata":"2026-10-04T10:00:00Z","no_contenuti_terzi":"2026-10-04T10:00:00Z"}'::jsonb,
          now(), 'attivo');
  insert into esiti values (2, 'misura senza dichiarazione: accettata', 'OK');
exception when others then
  insert into esiti values (2, 'misura senza dichiarazione: accettata', 'ROTTO — ' || sqlerrm);
end $$;

-- 3) Sonda BLOCCANTE e nessuna dichiarazione: rifiutato dal database, non
--    solo dal form. È il vincolo più forte di quello di prima.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                             hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il, incorporamento_sonda)
  values ('e0000000-0000-0000-0000-000000000003', 'Bloccata', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti',
          'proprio', 'abcdefghijk',
          '{"non_in_elenco":"2026-10-04T10:00:00Z","chat_disattivata":"2026-10-04T10:00:00Z","no_contenuti_terzi":"2026-10-04T10:00:00Z"}'::jsonb,
          now(), 'incorporamento_disattivato');
  insert into esiti values (3, 'sonda bloccante senza dichiarazione: rifiutata', 'ROTTO — accettata');
exception when check_violation then
  insert into esiti values (3, 'sonda bloccante senza dichiarazione: rifiutata', 'OK');
end $$;

-- 4) Né l'una né l'altra: rifiutato.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                             hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il)
  values ('e0000000-0000-0000-0000-000000000004', 'Niente', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti',
          'proprio', 'abcdefghijk',
          '{"non_in_elenco":"2026-10-04T10:00:00Z","chat_disattivata":"2026-10-04T10:00:00Z","no_contenuti_terzi":"2026-10-04T10:00:00Z"}'::jsonb,
          now());
  insert into esiti values (4, 'nessuna risposta sull''incorporamento: rifiutata', 'ROTTO — accettata');
exception when check_violation then
  insert into esiti values (4, 'nessuna risposta sull''incorporamento: rifiutata', 'OK');
end $$;

-- 4b) IL BUCO DI LUGLIO: `checklist_diretta` a NULL. `NULL ? 'chiave'` vale
--     NULL, e un CHECK che vale NULL ACCETTA la riga — quindi fino al 4/10
--     un evento su canale proprio passava senza che nessuna voce della
--     checklist fosse mai stata confermata. È il `coalesce(..., false)` che
--     lo chiude, non la clausola nuova.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                             hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il, incorporamento_sonda)
  values ('e0000000-0000-0000-0000-00000000004b', 'Checklist NULL', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti',
          'proprio', 'abcdefghijk', null, now(), 'attivo');
  insert into esiti values (41, 'checklist_diretta NULL: rifiutata (buco di luglio)', 'ROTTO — accettata');
exception when check_violation then
  insert into esiti values (41, 'checklist_diretta NULL: rifiutata (buco di luglio)', 'OK');
end $$;

-- 5) `non_controllato` NON è una risposta affermativa: senza la
--    dichiarazione, un «non ho guardato» non apre niente.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                             hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il, incorporamento_sonda)
  values ('e0000000-0000-0000-0000-000000000005', 'Non controllato', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti',
          'proprio', 'abcdefghijk',
          '{"non_in_elenco":"2026-10-04T10:00:00Z","chat_disattivata":"2026-10-04T10:00:00Z","no_contenuti_terzi":"2026-10-04T10:00:00Z"}'::jsonb,
          now(), 'non_controllato');
  insert into esiti values (5, '«non controllato» da solo: rifiutata', 'ROTTO — accettata');
exception when check_violation then
  insert into esiti values (5, '«non controllato» da solo: rifiutata', 'OK');
end $$;

-- 6) Le altre tre voci restano obbligatorie: la misura ha sostituito UNA
--    dichiarazione, non la checklist.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                             hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il, incorporamento_sonda)
  values ('e0000000-0000-0000-0000-000000000006', 'Checklist incompleta', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti',
          'proprio', 'abcdefghijk',
          '{"non_in_elenco":"2026-10-04T10:00:00Z","chat_disattivata":"2026-10-04T10:00:00Z"}'::jsonb,
          now(), 'attivo');
  insert into esiti values (6, 'manca «no_contenuti_terzi»: rifiutata', 'ROTTO — accettata');
exception when check_violation then
  insert into esiti values (6, 'manca «no_contenuti_terzi»: rifiutata', 'OK');
end $$;

-- 7) Un evento ospitato da KIREO non è toccato dal vincolo: nessun video,
--    nessuna checklist, e va bene — il video lo mette l'admin dopo.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, hosting_diretta)
  values ('e0000000-0000-0000-0000-000000000007', 'Ospitata da KIREO', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti', 'kireo');
  insert into esiti values (7, 'hosting kireo senza video: accettata', 'OK');
exception when others then
  insert into esiti values (7, 'hosting kireo senza video: accettata', 'ROTTO — ' || sqlerrm);
end $$;

-- Un evento dell'altro ente, e uno con hosting proprio, per le prove sotto.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, hosting_diretta)
values ('e0000000-0000-0000-0000-000000000008', 'Passato senza chiave', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
        now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'approvato', 'studenti', 'kireo');

-- =================================================================
-- §3 — LA CHIAVE DI TRASMISSIONE
-- =================================================================

-- 8) Un ente qualunque NON imposta la chiave di nessuno.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  perform public.imposta_chiave_trasmissione('e0000000-0000-0000-0000-000000000007', 'segreto-finto');
  reset role;
  insert into esiti values (8, 'non-admin respinto', 'ROTTO — riuscito');
exception
  when sqlstate 'P0001' then insert into esiti values (8, 'non-admin respinto', case when sqlerrm = 'non_autorizzato' then 'OK' else 'ROTTO — ' || sqlerrm end);
  when others then insert into esiti values (8, 'non-admin respinto', 'ROTTO — ' || sqlerrm);
end $$;
reset role;

-- 9) Un anonimo non ha nemmeno il PERMESSO di eseguirla. L'identità si
--    azzera prima di cambiare ruolo: `set_config(..., true)` vale per tutta
--    la transazione, e lasciando in piedi quella di sopra la funzione
--    troverebbe un admin... o un ente, cioè la guardia al posto del
--    permesso. Se qui esce `non_autorizzato` vuol dire che il permesso ha
--    ceduto e siamo arrivati alla seconda porta.
do $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  perform public.imposta_chiave_trasmissione('e0000000-0000-0000-0000-000000000007', 'segreto-finto');
  reset role;
  insert into esiti values (9, 'anon senza permesso di eseguire', 'ROTTO — riuscito');
exception
  when insufficient_privilege then insert into esiti values (9, 'anon senza permesso di eseguire', 'OK');
  when others then insert into esiti values (9, 'anon senza permesso di eseguire', 'ROTTO — sono arrivato alla guardia invece di fermarmi al permesso: ' || sqlerrm);
end $$;
reset role;

-- 10) Chiave vuota: rifiutata per nome.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.imposta_chiave_trasmissione('e0000000-0000-0000-0000-000000000007', '   ');
  reset role;
  insert into esiti values (10, 'chiave vuota rifiutata', 'ROTTO — accettata');
exception
  when sqlstate 'P0001' then insert into esiti values (10, 'chiave vuota rifiutata', case when sqlerrm = 'chiave_vuota' then 'OK' else 'ROTTO — ' || sqlerrm end);
  when others then insert into esiti values (10, 'chiave vuota rifiutata', 'ROTTO — ' || sqlerrm);
end $$;
reset role;

-- 11) Evento inesistente: lo dice, invece di scrivere una riga orfana.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.imposta_chiave_trasmissione('e0000000-0000-0000-0000-00000000ffff', 'segreto-finto');
  reset role;
  insert into esiti values (11, 'evento inesistente rifiutato', 'ROTTO — riuscito');
exception
  when sqlstate 'P0001' then insert into esiti values (11, 'evento inesistente rifiutato', case when sqlerrm = 'evento_non_trovato' then 'OK' else 'ROTTO — ' || sqlerrm end);
  when others then insert into esiti values (11, 'evento inesistente rifiutato', 'ROTTO — ' || sqlerrm);
end $$;
reset role;

-- 12) Una chiave del canale KIREO su un evento che l'ente trasmette dal
--     PROPRIO canale non vuol dire niente.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.imposta_chiave_trasmissione('e0000000-0000-0000-0000-000000000001', 'segreto-finto');
  reset role;
  insert into esiti values (12, 'hosting proprio rifiutato', 'ROTTO — riuscito');
exception
  when sqlstate 'P0001' then insert into esiti values (12, 'hosting proprio rifiutato', case when sqlerrm = 'hosting_non_kireo' then 'OK' else 'ROTTO — ' || sqlerrm end);
  when others then insert into esiti values (12, 'hosting proprio rifiutato', 'ROTTO — ' || sqlerrm);
end $$;
reset role;

-- 13) L'admin la imposta: la riga c'è, e porta chi l'ha scritta.
do $$
declare v_da uuid; v_chiave text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.imposta_chiave_trasmissione('e0000000-0000-0000-0000-000000000007', '  chiave-prima  ');
  reset role;
  select chiave, aggiornata_da into v_chiave, v_da from public.chiavi_trasmissione where evento_id = 'e0000000-0000-0000-0000-000000000007';
  insert into esiti values (13, 'admin imposta, con chi l''ha scritta',
    case when v_chiave = 'chiave-prima' and v_da = '11111111-1111-1111-1111-111111111111' then 'OK'
         else 'ROTTO — chiave=' || coalesce(v_chiave, 'NULL') || ' da=' || coalesce(v_da::text, 'NULL') end);
end $$;
reset role;

-- 14) La prima volta la notifica dice «pronta».
do $$
declare v_tipo text; v_n int;
begin
  select count(*), max(tipo::text) into v_n, v_tipo
  from public.notifiche_studenti
  where riferimento_id = 'e0000000-0000-0000-0000-000000000007';
  insert into esiti values (14, 'prima volta: notifica «pronta» al solo ente proprietario',
    case when v_n = 1 and v_tipo = 'chiave_trasmissione_pronta' then 'OK' else 'ROTTO — ' || v_n || ' righe, tipo ' || coalesce(v_tipo, 'NULL') end);
end $$;

-- 15) LA NOTIFICA PORTA IL FATTO, NON IL SEGRETO: la chiave non compare in
--     nessuna colonna della notifica.
do $$
declare v_trovata int;
begin
  select count(*) into v_trovata
  from public.notifiche_studenti n
  where n.riferimento_id = 'e0000000-0000-0000-0000-000000000007'
    and (n.tipo::text like '%chiave-prima%' or n.riferimento_id::text like '%chiave-prima%');
  insert into esiti values (15, 'la notifica non contiene la chiave', case when v_trovata = 0 then 'OK' else 'ROTTO — la chiave compare nella notifica' end);
end $$;

-- 16) L'ente proprietario LEGGE la sua chiave.
do $$
declare v_n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  select count(*) into v_n from public.chiavi_trasmissione where evento_id = 'e0000000-0000-0000-0000-000000000007';
  reset role;
  insert into esiti values (16, 'l''ente proprietario legge la sua chiave', case when v_n = 1 then 'OK' else 'ROTTO — ' || v_n || ' righe' end);
end $$;
reset role;

-- 17) Un ALTRO ente non vede niente, e nemmeno uno studente.
do $$
declare v_altro int; v_stud int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  select count(*) into v_altro from public.chiavi_trasmissione;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  select count(*) into v_stud from public.chiavi_trasmissione;
  reset role;
  insert into esiti values (17, 'un altro ente e uno studente non vedono nessuna chiave',
    case when v_altro = 0 and v_stud = 0 then 'OK' else 'ROTTO — altro ente ' || v_altro || ', studente ' || v_stud end);
end $$;
reset role;

-- 18) LA ROTAZIONE: la chiave cambia, e la notifica dice che è CAMBIATA. Un
--     solo tipo per entrambi i casi lascerebbe l'ente a provare con la
--     vecchia, e una chiave vecchia a schermo è peggio di nessuna chiave.
do $$
declare v_chiave text; v_cambiata int; v_righe int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.imposta_chiave_trasmissione('e0000000-0000-0000-0000-000000000007', 'chiave-dopo');
  reset role;
  select chiave into v_chiave from public.chiavi_trasmissione where evento_id = 'e0000000-0000-0000-0000-000000000007';
  select count(*) into v_righe from public.chiavi_trasmissione where evento_id = 'e0000000-0000-0000-0000-000000000007';
  select count(*) into v_cambiata from public.notifiche_studenti
    where riferimento_id = 'e0000000-0000-0000-0000-000000000007' and tipo = 'chiave_trasmissione_cambiata';
  insert into esiti values (18, 'rotazione: una riga sola, chiave nuova, notifica «cambiata»',
    case when v_chiave = 'chiave-dopo' and v_righe = 1 and v_cambiata = 1 then 'OK'
         else 'ROTTO — chiave=' || coalesce(v_chiave, 'NULL') || ' righe=' || v_righe || ' cambiata=' || v_cambiata end);
end $$;
reset role;

-- 19) Nessuna policy di scrittura per l'ente: la chiave non si scrive da sé.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  insert into public.chiavi_trasmissione (evento_id, chiave) values ('e0000000-0000-0000-0000-000000000008', 'me-la-metto-io');
  reset role;
  insert into esiti values (19, 'l''ente non scrive la chiave in diretto', 'ROTTO — riuscito');
exception when others then
  insert into esiti values (19, 'l''ente non scrive la chiave in diretto', 'OK');
end $$;
reset role;

-- 20) Un'istituzione senza utenti collegati non fa fallire la scrittura: la
--     chiave resta, e la vede l'admin. Un `raise` lì butterebbe via anche
--     quello che era stato scritto.
do $$
declare v_n int;
begin
  insert into public.istituzioni (id, nome, slug, tipo, stato)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'Ente Senza Utenti', 'ente-senza-utenti', 'universita', 'attiva');
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, hosting_diretta)
  values ('e0000000-0000-0000-0000-000000000009', 'Senza utenti', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000003',
          now() + interval '2 days', now() + interval '2 days 1 hour', 'approvato', 'studenti', 'kireo');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.imposta_chiave_trasmissione('e0000000-0000-0000-0000-000000000009', 'chiave-orfana');
  reset role;
  select count(*) into v_n from public.chiavi_trasmissione where evento_id = 'e0000000-0000-0000-0000-000000000009';
  insert into esiti values (20, 'nessun destinatario: la chiave resta scritta', case when v_n = 1 then 'OK' else 'ROTTO — ' || v_n || ' righe' end);
exception when others then
  insert into esiti values (20, 'nessun destinatario: la chiave resta scritta', 'ROTTO — ' || sqlerrm);
end $$;
reset role;

select n, nome, esito from esiti order by n, nome;

rollback;
