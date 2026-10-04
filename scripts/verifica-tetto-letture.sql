-- Le proprietà del tetto delle letture di una consegna (20260928100000).
--
-- Si incolla nel SQL Editor di Supabase o si dà in pasto a psql: gira in una
-- transazione e finisce con un ROLLBACK, quindi non lascia niente — e finisce con
-- un `select`, non con un silenzio.
--
-- LA PROPRIETÀ CHE VALE PIÙ DI TUTTE è la 4: al tetto la funzione DEVE sollevare,
-- perché ogni lettura è una chiamata a pagamento e l'unica cosa che le limita è
-- questa. Le altre dicono che il tetto non limita cose che non deve limitare — un
-- altro studente, un altro evento, la marcatura «letta».
--
-- NOTA SULLA 8 E LA 9 (i permessi). Se una revoca mancasse, il ruolo ENTRA nella
-- funzione e la guardia interna solleva `non_autorizzato`: è un errore diverso da
-- «permission denied», e queste proprietà lo distinguono per nome invece di
-- riportare un rosso che non dice cosa è rotto. Il permesso è la prima porta, la
-- guardia è la seconda.

begin;

create temporary table esiti (n int, proprieta text, atteso text, ottenuto text, ok boolean) on commit drop;
grant all on esiti to public;

-- ── un ente, due studenti, due eventi finiti con una domanda ciascuno
do $$
declare v_piano uuid;
begin
  select id into v_piano from public.piani limit 1;

  insert into auth.users (id, email) values
    ('b1111111-0000-0000-0000-000000000001', 'ente.tetto@example.test'),
    ('b1111111-0000-0000-0000-000000000002', 'stud.tetto1@example.test'),
    ('b1111111-0000-0000-0000-000000000003', 'stud.tetto2@example.test');

  insert into public.istituzioni (id, nome, slug, tipo, stato, piano_id) values
    ('b2222222-0000-0000-0000-000000000001', 'Ente Tetto', 'ente-tetto', 'its', 'attiva', v_piano);

  insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
    ('b1111111-0000-0000-0000-000000000001', 'istituzione', 'Ente', 'Tetto', '1980-01-01'),
    ('b1111111-0000-0000-0000-000000000002', 'studente', 'Prima', 'Studentessa', '2006-05-05'),
    ('b1111111-0000-0000-0000-000000000003', 'studente', 'Secondo', 'Studente', '2006-05-05');

  insert into public.institution_profiles (user_id, istituzione_id) values
    ('b1111111-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000001');

  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto, domanda_consegna) values
    ('b3333333-0000-0000-0000-00000000000a', 'Primo incontro', 'Scaletta.', 'webinar',
     'b2222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2,
     'Abbiamo 40.000 € e due cose da fare: cosa scegliereste, e chi ci rimette?'),
    ('b3333333-0000-0000-0000-00000000000b', 'Secondo incontro', 'Scaletta.', 'webinar',
     'b2222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2,
     'Una seconda domanda, lunga abbastanza per il vincolo della colonna.');

  insert into public.eventi_aree (evento_id, area_slug) values
    ('b3333333-0000-0000-0000-00000000000a', 'salute-professioni-sanitarie'),
    ('b3333333-0000-0000-0000-00000000000b', 'salute-professioni-sanitarie');

  insert into public.iscrizioni_eventi (evento_id, student_id, stato) values
    ('b3333333-0000-0000-0000-00000000000a', 'b1111111-0000-0000-0000-000000000002', 'iscritto'),
    ('b3333333-0000-0000-0000-00000000000a', 'b1111111-0000-0000-0000-000000000003', 'iscritto'),
    ('b3333333-0000-0000-0000-00000000000b', 'b1111111-0000-0000-0000-000000000002', 'iscritto');

  insert into public.presenze_live (evento_id, user_id, ping_totali) values
    ('b3333333-0000-0000-0000-00000000000a', 'b1111111-0000-0000-0000-000000000002', 60),
    ('b3333333-0000-0000-0000-00000000000a', 'b1111111-0000-0000-0000-000000000003', 60),
    ('b3333333-0000-0000-0000-00000000000b', 'b1111111-0000-0000-0000-000000000002', 60);
end $$;

-- ── tre consegne reali, scritte dagli studenti attraverso la policy
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'b1111111-0000-0000-0000-000000000002', true);
  insert into public.consegne_evento (evento_id, student_id, testo) values
    ('b3333333-0000-0000-0000-00000000000a', 'b1111111-0000-0000-0000-000000000002',
     repeat('Sceglierei il tetto, perché senza tetto la palestra resta chiusa comunque e il corso si rifà l''anno prossimo. ', 3)),
    ('b3333333-0000-0000-0000-00000000000b', 'b1111111-0000-0000-0000-000000000002',
     repeat('Sul secondo incontro la mia risposta è diversa, e la scrivo qui per avere due consegne dello stesso studente. ', 3));
  perform set_config('request.jwt.claim.sub', 'b1111111-0000-0000-0000-000000000003', true);
  insert into public.consegne_evento (evento_id, student_id, testo) values
    ('b3333333-0000-0000-0000-00000000000a', 'b1111111-0000-0000-0000-000000000003',
     repeat('Assumerei la persona in più, perché il tetto regge un altro inverno e senza nessuno il centro chiude il pomeriggio. ', 3));
  reset role;
end $$;

-- ════════ 0 · il numero su cui sono tarate tutte le proprietà sotto ════════
-- Se cambia, questa riga lo dice invece di far fallire le altre in un modo che
-- non si legge.
do $$
declare v_tetto integer;
begin
  select public.tetto_letture_consegna() into v_tetto;
  insert into esiti values (0, 'il tetto è 5 (le proprietà sotto sono tarate su questo numero)', '5',
    v_tetto::text, v_tetto = 5);
end $$;

-- ════════ 1 · una consegna nasce con zero letture ════════
do $$
declare v_n integer;
begin
  select letture_tentate into v_n from public.consegne_evento
   where evento_id = 'b3333333-0000-0000-0000-00000000000a' and student_id = 'b1111111-0000-0000-0000-000000000002';
  insert into esiti values (1, 'una consegna nasce con zero letture tentate', '0', v_n::text, v_n = 0);
end $$;

-- ════════ 2-3 · si accumulano, e la funzione restituisce il nuovo valore ════════
do $$
declare v_prima integer; v_ultima integer; v_i integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'b1111111-0000-0000-0000-000000000002', true);
  select public.apri_lettura_consegna('b3333333-0000-0000-0000-00000000000a') into v_prima;
  -- fino al tetto: la quinta è l'ultima consentita
  for v_i in 2..5 loop
    select public.apri_lettura_consegna('b3333333-0000-0000-0000-00000000000a') into v_ultima;
  end loop;
  reset role;
  insert into esiti values (2, 'la prima lettura vale 1, e la funzione lo dice', '1', v_prima::text, v_prima = 1);
  insert into esiti values (3, '…e la quinta, l''ultima consentita, riesce e vale 5', '5', v_ultima::text, v_ultima = 5);
end $$;

-- ════════ 4 · LA PROPRIETÀ CHE CONTA: la sesta viene rifiutata ════════
do $$
declare v_errore text := 'nessuno'; v_n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'b1111111-0000-0000-0000-000000000002', true);
  begin
    perform public.apri_lettura_consegna('b3333333-0000-0000-0000-00000000000a');
  exception when others then v_errore := SQLERRM;
  end;
  reset role;
  select letture_tentate into v_n from public.consegne_evento
   where evento_id = 'b3333333-0000-0000-0000-00000000000a' and student_id = 'b1111111-0000-0000-0000-000000000002';
  insert into esiti values (4, 'a tetto pieno la sesta lettura viene rifiutata per nome', 'troppe_letture',
    v_errore, v_errore = 'troppe_letture');
  insert into esiti values (5, '…e il contatore non va oltre il tetto', '5', v_n::text, v_n = 5);
end $$;

-- ════════ 6 · il tetto è per (evento, studente): l'altra consegna è intatta ════════
do $$
declare v_altro_evento integer; v_altro_studente integer;
begin
  select letture_tentate into v_altro_evento from public.consegne_evento
   where evento_id = 'b3333333-0000-0000-0000-00000000000b' and student_id = 'b1111111-0000-0000-0000-000000000002';
  select letture_tentate into v_altro_studente from public.consegne_evento
   where evento_id = 'b3333333-0000-0000-0000-00000000000a' and student_id = 'b1111111-0000-0000-0000-000000000003';
  insert into esiti values (6, 'un altro evento dello stesso studente non è stato toccato', '0',
    v_altro_evento::text, v_altro_evento = 0);
  insert into esiti values (7, '…e nemmeno la consegna di un altro studente sullo stesso evento', '0',
    v_altro_studente::text, v_altro_studente = 0);
end $$;

-- ════════ 8 · nessuno alza il contatore di un altro ════════
-- Il secondo studente chiama sull'evento B, dove NON ha una consegna: la funzione
-- non deve alzare quella del primo, e non deve nemmeno confondere i due no.
do $$
declare v_errore text := 'nessuno'; v_n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'b1111111-0000-0000-0000-000000000003', true);
  begin
    perform public.apri_lettura_consegna('b3333333-0000-0000-0000-00000000000b');
  exception when others then v_errore := SQLERRM;
  end;
  reset role;
  select letture_tentate into v_n from public.consegne_evento
   where evento_id = 'b3333333-0000-0000-0000-00000000000b' and student_id = 'b1111111-0000-0000-0000-000000000002';
  insert into esiti values (8, 'chi non ha una consegna su quell''evento riceve non_autorizzato, non troppe_letture',
    'non_autorizzato', v_errore, v_errore = 'non_autorizzato');
  insert into esiti values (9, '…e la consegna di un altro resta a zero letture', '0', v_n::text, v_n = 0);
end $$;

-- ════════ 10 · il contatore non si alza in diretto ════════
-- Nessuna policy di update esiste su consegne_evento, ed è per questo che il
-- contatore ha bisogno di una funzione definer: senza, uno studente potrebbe
-- riportarlo a zero e il tetto non sarebbe un tetto.
do $$
declare v_righe integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'b1111111-0000-0000-0000-000000000002', true);
  update public.consegne_evento set letture_tentate = 0
   where evento_id = 'b3333333-0000-0000-0000-00000000000a' and student_id = 'b1111111-0000-0000-0000-000000000002';
  get diagnostics v_righe = row_count;
  reset role;
  insert into esiti values (10, 'lo studente non può azzerare il contatore in diretto (nessuna policy update)',
    '0 righe scritte', format('%s righe', v_righe), v_righe = 0);
end $$;

-- ════════ 11 · «letta» e «quante volte» restano due cose ════════
do $$
declare v_n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'b1111111-0000-0000-0000-000000000003', true);
  perform public.segna_consegna_letta('b3333333-0000-0000-0000-00000000000a');
  select public.apri_lettura_consegna('b3333333-0000-0000-0000-00000000000a') into v_n;
  reset role;
  insert into esiti values (11, 'segnare una consegna come letta non tocca il contatore delle letture', '1',
    v_n::text, v_n = 1);
end $$;

-- ════════ 12-13 · i permessi ════════
-- Vedi la nota in testa: se una revoca manca, il ruolo ENTRA e l'errore è
-- `non_autorizzato` invece di «permission denied». Sono due stati diversi e qui
-- si leggono per nome.
do $$
declare v_errore text := 'nessuno';
begin
  -- Si AZZERA l'identità prima di cambiare ruolo, e non è una formalità:
  -- `set_config(..., true)` vale per tutta la transazione, quindi il `sub` dei
  -- blocchi precedenti resterebbe in piedi. Senza azzerarlo, con la revoca tolta
  -- questa proprietà finiva «nessuno» — la funzione entrava, trovava ancora
  -- l'identità di uno studente vero e gli alzava il contatore. Azzerandolo, il
  -- fallimento dice quale delle due porte ha ceduto: `non_autorizzato` vuol dire
  -- «sono arrivato alla guardia», cioè che il permesso non ha fermato nessuno.
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    perform public.apri_lettura_consegna('b3333333-0000-0000-0000-00000000000a');
  exception when others then v_errore := SQLERRM;
  end;
  reset role;
  insert into esiti values (12, 'anon non ha il permesso di alzare nessun contatore (la prima porta, non la guardia)',
    'permission denied', v_errore, v_errore like '%permission denied%');
end $$;

do $$
declare v_errore text := 'nessuno';
begin
  set local role authenticated;
  begin
    perform public.tetto_letture_consegna();
  exception when others then v_errore := SQLERRM;
  end;
  reset role;
  insert into esiti values (13, 'il numero del tetto non è chiamabile da fuori: il grant si dà a chi chiama',
    'permission denied', v_errore, v_errore like '%permission denied%');
end $$;

select n, case when ok then '✓' else '✗' end as esito, proprieta, atteso, ottenuto
from esiti order by n;

-- `coalesce(ok, false)`: un `ok` NULL si legge ROTTO nella tabella qui sopra e
-- NON si conterebbe fra le rosse — il riassunto direbbe meno rotte di quante se
-- ne vedono, cioè la direzione comoda.
select count(*) filter (where not coalesce(ok, false)) as rosse, count(*) as totali from esiti;

rollback;
