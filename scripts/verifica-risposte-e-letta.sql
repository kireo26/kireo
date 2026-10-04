-- Le proprietà del terzo numero (20260927140000) e di «letta senza credito»
-- (20260927150000).
--
-- Si incolla nel SQL Editor di Supabase o si dà in pasto a psql: gira in una
-- transazione e finisce con un ROLLBACK, quindi non lascia niente — e finisce con
-- un `select`, non con un silenzio.
--
-- LA PROPRIETÀ CHE VALE PIÙ DI TUTTE è la 1: aggiungere il conteggio delle
-- risposte non deve gonfiare i due numeri che esistevano già. Un secondo
-- `left join` lo avrebbe fatto — e i numeri sarebbero restati PLAUSIBILI, che è il
-- modo in cui un difetto così non si vede.

begin;

create temporary table esiti (n int, proprieta text, atteso text, ottenuto text, ok boolean) on commit drop;
grant all on esiti to public;

-- ── due enti (il secondo serve a provare che la WHERE tiene), due studenti
do $$
declare v_piano uuid;
begin
  select id into v_piano from public.piani limit 1;

  insert into auth.users (id, email) values
    ('a1111111-0000-0000-0000-000000000001', 'ente.risp@example.test'),
    ('a1111111-0000-0000-0000-000000000002', 'altroente.risp@example.test'),
    ('a1111111-0000-0000-0000-000000000003', 'stud.risp1@example.test'),
    ('a1111111-0000-0000-0000-000000000004', 'stud.risp2@example.test');

  insert into public.istituzioni (id, nome, slug, tipo, stato, piano_id) values
    ('a2222222-0000-0000-0000-000000000001', 'Ente Risposte', 'ente-risposte', 'its', 'attiva', v_piano),
    ('a2222222-0000-0000-0000-000000000002', 'Altro Ente', 'altro-ente-risp', 'its', 'attiva', v_piano);

  insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
    ('a1111111-0000-0000-0000-000000000001', 'istituzione', 'Ente', 'Risposte', '1980-01-01'),
    ('a1111111-0000-0000-0000-000000000002', 'istituzione', 'Altro', 'Ente', '1980-01-01'),
    ('a1111111-0000-0000-0000-000000000003', 'studente', 'Prima', 'Studentessa', '2006-05-05'),
    ('a1111111-0000-0000-0000-000000000004', 'studente', 'Secondo', 'Studente', '2006-05-05');

  insert into public.institution_profiles (user_id, istituzione_id) values
    ('a1111111-0000-0000-0000-000000000001', 'a2222222-0000-0000-0000-000000000001'),
    ('a1111111-0000-0000-0000-000000000002', 'a2222222-0000-0000-0000-000000000002');
end $$;

-- ── tre eventi finiti: con domanda e due risposte, con domanda e zero risposte,
--    senza domanda. Più uno dell'altro ente.
do $$
begin
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto, domanda_consegna) values
    ('a3333333-0000-0000-0000-00000000000a', 'Con domanda e risposte', 'Scaletta.', 'webinar',
     'a2222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2,
     'Abbiamo 40.000 € e due cose da fare: cosa scegliereste, e chi ci rimette?'),
    ('a3333333-0000-0000-0000-00000000000b', 'Con domanda, nessuna risposta', 'Scaletta.', 'webinar',
     'a2222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2,
     'Una domanda che nessuno ha ancora letto, lunga abbastanza per il vincolo.'),
    ('a3333333-0000-0000-0000-00000000000c', 'Senza domanda', 'Scaletta.', 'webinar',
     'a2222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2, null),
    ('a3333333-0000-0000-0000-00000000000d', 'Evento di un altro ente', 'Scaletta.', 'webinar',
     'a2222222-0000-0000-0000-000000000002', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2, null);

  insert into public.eventi_aree (evento_id, area_slug) values
    ('a3333333-0000-0000-0000-00000000000a', 'salute-professioni-sanitarie'),
    ('a3333333-0000-0000-0000-00000000000b', 'salute-professioni-sanitarie');

  -- DUE iscritti e UNO partecipato sull'evento A: sono i numeri che non devono
  -- muoversi quando arrivano le risposte.
  insert into public.iscrizioni_eventi (evento_id, student_id, stato) values
    ('a3333333-0000-0000-0000-00000000000a', 'a1111111-0000-0000-0000-000000000003', 'iscritto'),
    ('a3333333-0000-0000-0000-00000000000a', 'a1111111-0000-0000-0000-000000000004', 'partecipato'),
    ('a3333333-0000-0000-0000-00000000000b', 'a1111111-0000-0000-0000-000000000003', 'iscritto');

  insert into public.presenze_live (evento_id, user_id, ping_totali) values
    ('a3333333-0000-0000-0000-00000000000a', 'a1111111-0000-0000-0000-000000000003', 60),
    ('a3333333-0000-0000-0000-00000000000a', 'a1111111-0000-0000-0000-000000000004', 60);
end $$;

-- ── i numeri PRIMA che arrivino le risposte
do $$
declare v_i integer; v_p integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000001', true);
  select iscritti, partecipati into v_i, v_p from public.stats_eventi_istituzione
   where evento_id = 'a3333333-0000-0000-0000-00000000000a';
  reset role;
  insert into esiti values (0, 'prima delle risposte: 1 iscritto e 1 partecipato (la linea di base)', '1/1',
    format('%s/%s', v_i, v_p), v_i = 1 and v_p = 1);
end $$;

-- ── due risposte reali, scritte dagli studenti attraverso la policy
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000003', true);
  insert into public.consegne_evento (evento_id, student_id, testo) values
    ('a3333333-0000-0000-0000-00000000000a', 'a1111111-0000-0000-0000-000000000003',
     repeat('Nel mio quartiere il tetto perde da due anni e la palestra è chiusa: sceglierei il tetto, e ci rimette chi aspettava il corso. ', 3));
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000004', true);
  insert into public.consegne_evento (evento_id, student_id, testo) values
    ('a3333333-0000-0000-0000-00000000000a', 'a1111111-0000-0000-0000-000000000004',
     repeat('Assumerei la persona in più, perché il tetto regge un altro inverno e senza nessuno il centro resta chiuso il pomeriggio. ', 3));
  reset role;
end $$;

-- ════════ 1 · LA PROPRIETÀ CHE CONTA: i due numeri non si muovono ════════
do $$
declare v_i integer; v_p integer; v_r integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000001', true);
  select iscritti, partecipati, risposte into v_i, v_p, v_r from public.stats_eventi_istituzione
   where evento_id = 'a3333333-0000-0000-0000-00000000000a';
  reset role;
  insert into esiti values (1, 'con due risposte: iscritti e partecipati INVARIATI (un secondo left join li gonfierebbe)',
    '1 iscritto, 1 partecipato', format('%s iscritto, %s partecipato', v_i, v_p), v_i = 1 and v_p = 1);
  insert into esiti values (2, '…e le risposte sono due', '2', v_r::text, v_r = 2);
end $$;

-- ════════ 3-4 · domanda posta senza risposte, e nessuna domanda ════════
do $$
declare v_dp boolean; v_r integer; v_dp2 boolean; v_r2 integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000001', true);
  select domanda_posta, risposte into v_dp, v_r from public.stats_eventi_istituzione
   where evento_id = 'a3333333-0000-0000-0000-00000000000b';
  select domanda_posta, risposte into v_dp2, v_r2 from public.stats_eventi_istituzione
   where evento_id = 'a3333333-0000-0000-0000-00000000000c';
  reset role;
  insert into esiti values (3, 'domanda posta e nessuno ha risposto: ZERO si scrive (non si nasconde la riga)',
    'domanda_posta=true, risposte=0', format('domanda_posta=%s, risposte=%s', v_dp, v_r), v_dp is true and v_r = 0);
  insert into esiti values (4, 'nessuna domanda posta: il numero non ha senso e la pagina non lo mostra',
    'domanda_posta=false, risposte=0', format('domanda_posta=%s, risposte=%s', v_dp2, v_r2), v_dp2 is false and v_r2 = 0);
end $$;

-- ════════ 5 · la WHERE tiene: l'ente vede solo i propri eventi ════════
do $$
declare v_miei integer; v_altrui integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000001', true);
  select count(*) into v_miei from public.stats_eventi_istituzione
   where evento_id in ('a3333333-0000-0000-0000-00000000000a','a3333333-0000-0000-0000-00000000000b','a3333333-0000-0000-0000-00000000000c');
  select count(*) into v_altrui from public.stats_eventi_istituzione
   where evento_id = 'a3333333-0000-0000-0000-00000000000d';
  reset role;
  insert into esiti values (5, 'un ente vede i propri tre eventi e non quello di un altro', '3 miei, 0 altrui',
    format('%s miei, %s altrui', v_miei, v_altrui), v_miei = 3 and v_altrui = 0);
end $$;

-- ════════ 6 · uno studente non ricava niente dalla vista ════════
do $$
declare v_righe integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000003', true);
  select count(*) into v_righe from public.stats_eventi_istituzione;
  reset role;
  insert into esiti values (6, 'uno studente interroga la vista e non ottiene niente (non ha un''istituzione)', '0 righe',
    format('%s righe', v_righe), v_righe = 0);
end $$;

-- ════════ 7 · nessun testo e nessun id di studente fra le colonne ════════
do $$
declare v_colonne text;
begin
  select string_agg(column_name, ', ' order by ordinal_position) into v_colonne
  from information_schema.columns
  where table_schema = 'public' and table_name = 'stats_eventi_istituzione';
  insert into esiti values (7, 'la vista conta e non elenca: nessuna colonna con un testo o un id di studente',
    'niente testo/student_id', v_colonne, v_colonne not like '%testo%' and v_colonne not like '%student%');
end $$;

-- ════════ 8-10 · segna_consegna_letta: marca la propria, e una volta sola ════════
-- ATTENZIONE alla taratura della 9. Dentro UNA transazione `now()` è costante
-- (è il timestamp della transazione, non dell'istruzione), quindi confrontare la
-- data prima e dopo NON prova niente: due chiamate danno lo stesso valore anche
-- senza la guardia `and valutata_il is null`. Provato: con la guardia tolta, la
-- prima stesura di questa proprietà restava VERDE. Quindi la data si mette
-- indietro a mano e si verifica che la seconda chiamata NON la sposti.
do $$
declare v_prima timestamptz; v_dopo timestamptz; v_prove integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000003', true);
  perform public.segna_consegna_letta('a3333333-0000-0000-0000-00000000000a');
  select valutata_il into v_prima from public.consegne_evento
   where evento_id = 'a3333333-0000-0000-0000-00000000000a' and student_id = 'a1111111-0000-0000-0000-000000000003';
  reset role;

  -- una data vecchia e riconoscibile, scritta dal proprietario (nessuna policy di
  -- update esiste su consegne_evento, ed è giusto che non esista)
  update public.consegne_evento set valutata_il = timestamptz '2020-01-01 00:00:00+00'
   where evento_id = 'a3333333-0000-0000-0000-00000000000a' and student_id = 'a1111111-0000-0000-0000-000000000003';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000003', true);
  perform public.segna_consegna_letta('a3333333-0000-0000-0000-00000000000a');
  select valutata_il into v_dopo from public.consegne_evento
   where evento_id = 'a3333333-0000-0000-0000-00000000000a' and student_id = 'a1111111-0000-0000-0000-000000000003';
  reset role;

  select count(*) into v_prove from public.evidence where evento_id = 'a3333333-0000-0000-0000-00000000000a';

  insert into esiti values (8, 'la consegna risulta letta', 'valutata_il non nulla',
    coalesce(v_prima::text, 'nulla'), v_prima is not null);
  insert into esiti values (9, 'una consegna GIÀ letta non viene ri-segnata (la guardia, non l''orologio)',
    '2020-01-01 intatta', coalesce(v_dopo::text, 'nulla'), v_dopo = timestamptz '2020-01-01 00:00:00+00');
  insert into esiti values (10, '…e non ha scritto nessuna prova: «letta» non vuol dire «ha prodotto qualcosa»', '0 prove',
    format('%s prove', v_prove), v_prove = 0);
end $$;

-- ════════ 11 · un altro studente non può segnare la consegna di un terzo ════════
do $$
declare v_errore text := 'nessuno';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000004', true);
  begin
    -- L'evento B: la consegna lì è di nessuno, quindi non c'è niente da segnare.
    perform public.segna_consegna_letta('a3333333-0000-0000-0000-00000000000b');
  exception when others then
    v_errore := sqlerrm;
  end;
  reset role;
  insert into esiti values (11, 'senza una propria consegna la funzione rifiuta invece di riportare successo',
    'non_autorizzato', v_errore, v_errore = 'non_autorizzato');
end $$;

-- ════════ 12 · anon non la può eseguire ════════
do $$
declare v_errore text := 'nessuno';
begin
  set local role anon;
  begin
    perform public.segna_consegna_letta('a3333333-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then
    v_errore := 'permesso negato';
  when others then
    v_errore := 'sono arrivato alla guardia: ' || sqlerrm;
  end;
  reset role;
  insert into esiti values (12, 'anon non ha il permesso di eseguirla (il permesso è la prima porta, la guardia la seconda)',
    'permesso negato', v_errore, v_errore = 'permesso negato');
end $$;

select n, case when ok then '✓' else '✗ ROTTA' end as esito, proprieta, atteso, ottenuto
from esiti order by n;

-- `coalesce(ok, false)`: una proprietà il cui confronto cade su un valore
-- assente vale NULL, e non deve risultare verificata.
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' proprietà verificate' as riepilogo from esiti;

rollback;
