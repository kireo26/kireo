-- Verifica di 20261011120000_export_domande_consegne.sql: domande e consegne
-- nell'export, senza nomi, e l'ente fuori dalle consegne.
--
-- Gira anche nel SQL Editor di Supabase: tutto dentro una transazione che
-- finisce con ROLLBACK, e in coda un `select` invece di un silenzio.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA la migrazione (un
-- `create or replace` conserva i privilegi, e un `revoke` non si disfà
-- riapplicando il file):
--   - senza la migrazione intera: cadono le funzioni, quindi tutto;
--   - sostituendo la guardia di `esporta_consegne_evento` con quella doppia
--     della sorella: diventa VERDE la 6 e rossa la 7 — cioè l'ente legge i
--     testi degli studenti, che è la cosa che il 27/09 è stata decisa di no;
--   - togliendo i `revoke`: diventano rosse la 9 e la 10.
--
-- ⚠️ LA PROPRIETÀ PIÙ IMPORTANTE È LA 4, e non si legge dal risultato di una
-- query: è che nessuna delle due funzioni NOMINI `profiles`. Un risultato senza
-- nomi lo si può ottenere anche selezionando i nomi e non stampandoli, e allora
-- la proprietà sarebbe «chi stampa si ricorda» invece di «non si può». Quella
-- metà la prova `npm run test:exportdc` leggendo il sorgente; qui si prova
-- quello che una query può dire — che nel risultato non ci sono.

begin;

set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to anon, authenticated;

-- ---------------------------------------------------------------- dati
insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'ente@test.it'),
  ('11111111-0000-0000-0000-000000000002', 'altro-ente@test.it'),
  ('11111111-0000-0000-0000-000000000003', 'admin@test.it'),
  ('22222222-0000-0000-0000-000000000001', 'studente1@test.it'),
  ('33333333-0000-0000-0000-000000000001', 'docente1@test.it');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-000000000001', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('11111111-0000-0000-0000-000000000002', 'istituzione', 'Al', 'Tro', '1980-01-01'),
  ('11111111-0000-0000-0000-000000000003', 'admin', 'Ad', 'Min', '1980-01-01'),
  ('22222222-0000-0000-0000-000000000001', 'studente', 'Pri', 'Mo', '2008-01-01'),
  ('33333333-0000-0000-0000-000000000001', 'docente', 'Do', 'Cente', '1985-01-01');

insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ente Uno', 'ente-uno', 'universita', 'attiva'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ente Due', 'ente-due', 'universita', 'attiva');

insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');

-- EV_S — finita, pubblico studenti, con una domanda finale e una consegna.
-- EV_D — finita, pubblico DOCENTI: serve alla proprietà 3, perché è il solo
--        pubblico per cui `domande_live_organizzatore` mostra il nome — e
--        l'export non deve mostrarlo nemmeno lì.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                           filone, hosting_diretta, youtube_video_id, incorporamento_sonda, domanda_consegna) values
  ('e0000000-0000-0000-0000-000000000055', 'Studenti', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '2 hours', now() - interval '1 hour', 'approvato', 'studenti', null, 'kireo', 'abcdefghijk', 'attivo',
   'Nel tuo quartiere, cosa cambieresti per primo e cosa ci rinunceresti?'),
  ('e0000000-0000-0000-0000-000000000066', 'Docenti', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '2 hours', now() - interval '1 hour', 'approvato', 'docenti', 'ai_didattica', 'kireo', 'abcdefghijk', 'attivo', null);

insert into public.iscrizioni_eventi (evento_id, student_id, iscritto_da) values
  ('e0000000-0000-0000-0000-000000000055', '22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000066', '33333333-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001');

insert into public.domande_live (id, evento_id, user_id, testo, creata_il, stato, stato_da_tipo, stato_il) values
  ('dddddddd-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000055', '22222222-0000-0000-0000-000000000001',
   'Quanto costa tenerlo aperto il sabato?', now() - interval '90 minutes', 'risposta_live', 'ente', now() - interval '85 minutes'),
  ('dddddddd-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000066', '33333333-0000-0000-0000-000000000001',
   'Si può usare in una pluriclasse?', now() - interval '90 minutes', 'letta', 'kireo', now() - interval '80 minutes');

-- Una consegna vera (il vincolo chiede almeno 200 caratteri).
insert into public.consegne_evento (evento_id, student_id, testo, created_at) values
  ('e0000000-0000-0000-0000-000000000055', '22222222-0000-0000-0000-000000000001',
   repeat('Cambierei per primo il marciapiede davanti alla scuola, perche la mattina ci passano duecento ragazzi su mezzo metro di spazio, e ci rinuncerei al parcheggio dei motorini. ', 2),
   now() - interval '30 minutes');

-- =================================================================
-- §1 — LE DOMANDE, SENZA CHI LE HA SCRITTE
-- =================================================================

-- 1) L'admin esporta le domande di un evento studenti.
do $$
declare v_n integer; v_testo text; v_tocco text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000003', true);
  select count(*), max(d.testo), max(d.toccata_da) into v_n, v_testo, v_tocco
  from public.esporta_domande_evento('e0000000-0000-0000-0000-000000000055') d;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (1, 'l''admin esporta le domande (studenti)', '1 riga + testo + tocco',
    v_n || ' righe + ' || coalesce(left(v_testo, 12), 'NULL') || ' + ' || coalesce(v_tocco, 'NULL'),
    v_n = 1 and v_testo like 'Quanto costa%' and v_tocco = 'ente');
end $$;

-- 2) L'ENTE organizzatore pure: è lo stesso dato che già vede nel pannello, un
--    CSV non gli aggiunge niente.
do $$
declare v_n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select count(*) into v_n from public.esporta_domande_evento('e0000000-0000-0000-0000-000000000055');
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (2, 'l''ente organizzatore esporta le domande', '1', v_n::text, v_n = 1);
end $$;

-- 3) ⚠️ NESSUN NOME NEMMENO SU UN EVENTO DOCENTI, che è il solo pubblico per
--    cui `domande_live_organizzatore` il nome lo mostra. Si confronta la forma
--    della riga: se una colonna col nome esistesse, il `select *` la
--    restituirebbe e il conteggio delle colonne non sarebbe 5.
-- ⚠️ LE COLONNE DI UNA FUNZIONE NON STANNO IN `information_schema.columns`:
--    quella vista contiene tabelle e viste. La prima stesura le cercava lì, la
--    3 è diventata rossa (il conto atteso era dichiarato) e ha scoperto che la
--    4 era VACUA — verde su un insieme vuoto, cioè il modo 2. La sorgente
--    giusta sono i parametri OUT in `pg_proc`.
do $$
declare v_colonne integer; v_n integer;
begin
  select count(*) into v_colonne
  from pg_proc p, unnest(p.proargmodes) with ordinality as m(modo, i)
  where p.oid = 'public.esporta_domande_evento(uuid)'::regprocedure and m.modo = 't';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select count(*) into v_n from public.esporta_domande_evento('e0000000-0000-0000-0000-000000000066');
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  insert into esiti values (3, 'evento docenti: la domanda c''è e le colonne sono 5 (nessun nome)', '1 riga + 5 colonne',
    v_n || ' righe + ' || v_colonne || ' colonne', v_n = 1 and v_colonne = 5);
end $$;

-- 4) La forma della riga NON contiene nessuna colonna che somigli a un nome.
--    (La metà strutturale — che la funzione non NOMINI `profiles` — la prova
--    `npm run test:exportdc` sul sorgente: una query non può dirlo.)
do $$
declare v_sospette text; v_totale integer;
begin
  with colonne as (
    select unnest(p.proargnames) as nome
    from pg_proc p
    where p.oid in ('public.esporta_domande_evento(uuid)'::regprocedure,
                    'public.esporta_consegne_evento(uuid)'::regprocedure)
  )
  select count(*), string_agg(nome, ', ') filter (
    where nome ilike '%nome%' or nome ilike '%cognome%' or nome ilike '%email%'
       or nome ilike '%user%' or nome ilike '%student%')
    into v_totale, v_sospette
  from colonne;
  -- ⚠️ LA SOGLIA È LA META CHE MANCAVA: senza, questa proprietà è verde su un
  -- insieme vuoto — ed è precisamente come era la prima stesura, che cercava le
  -- colonne nel posto sbagliato e non se ne accorgeva. 11 = i nomi delle due
  -- firme (1 argomento + 5 colonne, e 1 + 5): se scendono, l'estrattore ha
  -- smesso di leggere e il «nessuna» non vuol dire niente.
  insert into esiti values (4, 'nessun nome di colonna che somigli a una persona (su 12 nomi letti)', 'nessuna, su 12 nomi',
    coalesce(v_sospette, 'nessuna') || ', su ' || v_totale || ' nomi',
    v_sospette is null and v_totale = 12);
end $$;

-- 5) Un ente che non è l'organizzatore non esporta le domande.
do $$
declare v_msg text := 'nessuna eccezione';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000002', true);
  begin
    perform * from public.esporta_domande_evento('e0000000-0000-0000-0000-000000000055');
  exception when others then v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (5, 'un altro ente non esporta le domande', 'non_autorizzato', v_msg, v_msg = 'non_autorizzato');
end $$;

-- =================================================================
-- §2 — LE CONSEGNE: SOLO ADMIN
-- =================================================================

-- 6) ⚠️ L'ENTE ORGANIZZATORE NON LEGGE I TESTI, ed è la proprietà che il 27/09
--    ha deciso: «quello che scrivono resta loro, tu vedi solo che è arrivato».
--    L'ente ha già i due numeri (numero_domande, risposte).
do $$
declare v_msg text := 'nessuna eccezione';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  begin
    perform * from public.esporta_consegne_evento('e0000000-0000-0000-0000-000000000055');
  exception when others then v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (6, 'l''ente ORGANIZZATORE non legge i testi delle consegne', 'non_autorizzato', v_msg, v_msg = 'non_autorizzato');
end $$;

-- 7) L'admin sì: è la prima strada per cui un testo di consegna esce dalla
--    sessione di chi l'ha scritta, e serve a Mario per leggere le prime vere.
do $$
declare v_n integer; v_testo text; v_val boolean; v_car integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000003', true);
  select count(*), max(c.testo), bool_or(c.valutata), max(c.caratteri) into v_n, v_testo, v_val, v_car
  from public.esporta_consegne_evento('e0000000-0000-0000-0000-000000000055') c;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (7, 'l''admin legge le consegne, con i caratteri e il giudizio', '1 riga + testo + non valutata',
    v_n || ' righe + ' || coalesce(left(v_testo, 12), 'NULL') || ' + ' || coalesce(v_val::text, 'NULL') || ' + ' || coalesce(v_car::text, 'NULL'),
    v_n = 1 and v_testo like 'Cambierei%' and v_val = false and v_car > 200);
end $$;

-- 8) Uno studente non esporta le consegne (nemmeno la propria: la sua la legge
--    con la policy `select_own`, non con una funzione di export).
do $$
declare v_msg text := 'nessuna eccezione';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-000000000001', true);
  begin
    perform * from public.esporta_consegne_evento('e0000000-0000-0000-0000-000000000055');
  exception when others then v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (8, 'uno studente non esporta le consegne', 'non_autorizzato', v_msg, v_msg = 'non_autorizzato');
end $$;

-- =================================================================
-- §3 — I PERMESSI SONO LA PRIMA PORTA
-- =================================================================

-- 9) Un anonimo non arriva nemmeno alla guardia delle domande.
do $$
declare v_msg text := 'nessuna eccezione';
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.esporta_domande_evento('e0000000-0000-0000-0000-000000000055');
  exception when insufficient_privilege then v_msg := 'permission denied';
            when others then v_msg := 'sono arrivato alla guardia (' || sqlerrm || '): il permesso ha ceduto';
  end;
  reset role;
  insert into esiti values (9, 'anon: permesso negato sulle domande', 'permission denied', v_msg, v_msg = 'permission denied');
end $$;

-- 10) E nemmeno a quella delle consegne.
do $$
declare v_msg text := 'nessuna eccezione';
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.esporta_consegne_evento('e0000000-0000-0000-0000-000000000055');
  exception when insufficient_privilege then v_msg := 'permission denied';
            when others then v_msg := 'sono arrivato alla guardia (' || sqlerrm || '): il permesso ha ceduto';
  end;
  reset role;
  insert into esiti values (10, 'anon: permesso negato sulle consegne', 'permission denied', v_msg, v_msg = 'permission denied');
end $$;

-- =================================================================
-- §4 — NESSUNA REGRESSIONE
-- =================================================================

-- 11) `consegne_evento` continua a essere leggibile dal suo autore e da
--     nessun altro: la funzione di export non ha aggiunto una policy.
do $$
declare v_mie integer; v_altrui integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-000000000001', true);
  select count(*) into v_mie from public.consegne_evento;
  reset role;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select count(*) into v_altrui from public.consegne_evento;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (11, 'in diretto: l''autore vede la propria consegna, l''ente nessuna', '1 e 0',
    v_mie || ' e ' || v_altrui, v_mie = 1 and v_altrui = 0);
end $$;

-- 12) `domande_live_organizzatore` non è stata toccata: sull'evento docenti
--     mostra ancora il nome. (Le due funzioni rispondono a due domande
--     diverse, e questa è la metà che la nuova poteva far sembrare superflua.)
do $$
declare v_nome text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select d.nome_completo into v_nome
  from public.domande_live_organizzatore('e0000000-0000-0000-0000-000000000066') d
  limit 1;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (12, 'la funzione live mostra ancora il nome sui docenti (non è stata toccata)', 'Do Cente',
    coalesce(v_nome, 'NULL'), v_nome = 'Do Cente');
end $$;

-- ---------------------------------------------------------------- esito
select * from esiti order by n;
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) as verificate,
       count(*) filter (where not coalesce(ok, false)) as rotte
from esiti;

rollback;
