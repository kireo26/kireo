-- Le proprietà dell'allarme sull'evento senza aree (20260927130000).
--
-- Si incolla nel SQL Editor di Supabase o si dà in pasto a psql: gira in una
-- transazione e finisce con un ROLLBACK, quindi non lascia niente — e finisce
-- con un `select`, non con un silenzio.
--
-- Cosa prova, e cosa NON prova: prova che l'allarme suoni SOLO quando una
-- partecipazione certificata non ha nessuna area a cui accreditarsi, e che non
-- cambi niente di quello che la chiusura faceva prima (presenti, certificati,
-- credito quando l'area c'è). Non prova niente su come il guasto viene letto:
-- quello è `npm run banco guasti`.
--
-- OGNI PROPRIETÀ MISURA IL DELTA CHE HA CAUSATO, non il totale degli allarmi:
-- una che guardasse il totale andrebbe rossa quando è un'ALTRA a non aver
-- suonato, cioè per una ragione che non è la sua — un rosso che nomina il
-- difetto sbagliato. (Prima stesura di oggi: le proprietà 5-8 guardavano il
-- totale, e nella controprova sono diventate rosse tutte e quattro senza che
-- nessuna delle quattro fosse rotta.)

begin;

create temporary table esiti (n int, proprieta text, atteso text, ottenuto text, ok boolean) on commit drop;
-- Le sessioni impersonate (authenticated) devono poter scrivere qui: il test
-- gira anche da dentro `set role`.
grant all on esiti to public;

-- ── un ente attivo, un admin, due studenti
do $$
declare
  v_piano_id uuid;
begin
  select id into v_piano_id from public.piani limit 1;

  insert into auth.users (id, email) values
    ('11111111-0000-0000-0000-000000000001', 'ente.allarme@example.test'),
    ('11111111-0000-0000-0000-000000000002', 'admin.allarme@example.test'),
    ('11111111-0000-0000-0000-000000000003', 'studente.allarme1@example.test'),
    ('11111111-0000-0000-0000-000000000004', 'studente.allarme2@example.test');

  insert into public.istituzioni (id, nome, slug, tipo, stato, piano_id)
  values ('22222222-0000-0000-0000-000000000001', 'Ente Allarme', 'ente-allarme', 'its', 'attiva', v_piano_id);

  insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
    ('11111111-0000-0000-0000-000000000001', 'istituzione', 'Ente', 'Allarme', '1980-01-01'),
    ('11111111-0000-0000-0000-000000000002', 'admin', 'Admin', 'Allarme', '1980-01-01'),
    ('11111111-0000-0000-0000-000000000003', 'studente', 'Prima', 'Studentessa', '2008-05-05'),
    ('11111111-0000-0000-0000-000000000004', 'studente', 'Secondo', 'Studente', '2008-05-05');

  insert into public.institution_profiles (user_id, istituzione_id)
  values ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001');
end $$;

-- ── cinque eventi già finiti (data_fine nel passato, così la chiusura è ammessa)
do $$
begin
  -- A: per studenti, CON un'area
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto)
  values ('33333333-0000-0000-0000-00000000000a', 'Con area', 'Scaletta.', 'webinar',
          '22222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2);
  insert into public.eventi_aree (evento_id, area_slug)
  values ('33333333-0000-0000-0000-00000000000a', 'informatica-digitale');

  -- B: per studenti, SENZA aree (il caso dell'allarme), due studenti presenti
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto)
  values ('33333333-0000-0000-0000-00000000000b', 'Senza aree', 'Scaletta.', 'webinar',
          '22222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2);

  -- C: per docenti, senza aree (non DEVE averne: nessun allarme)
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, filone, ore_pcto)
  values ('33333333-0000-0000-0000-00000000000c', 'Docenti', 'Scaletta.', 'webinar',
          '22222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'docenti', 'ai_didattica', 0);

  -- D: per studenti, senza aree, ma nessuno raggiunge la soglia
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto)
  values ('33333333-0000-0000-0000-00000000000d', 'Nessuno presente', 'Scaletta.', 'webinar',
          '22222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2);

  -- E: per studenti, CON un'area, ma quel credito lo studente lo ha già oggi da
  --    un altro evento → l'insert conflitta e scrive ZERO righe
  insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico, ore_pcto)
  values ('33333333-0000-0000-0000-00000000000e', 'Credito già preso', 'Scaletta.', 'webinar',
          '22222222-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '2 hours', 'approvato', 'studenti', 2);
  insert into public.eventi_aree (evento_id, area_slug)
  values ('33333333-0000-0000-0000-00000000000e', 'salute-professioni-sanitarie');
end $$;

-- ── iscrizioni e presenze. ping_attesi_evento su un'ora = 60: 60 ping = 100%,
--    10 ping = 17%, sotto la soglia del 75%.
do $$
begin
  insert into public.iscrizioni_eventi (evento_id, student_id, stato) values
    ('33333333-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000003', 'iscritto'),
    ('33333333-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000003', 'iscritto'),
    ('33333333-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000004', 'iscritto'),
    ('33333333-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-000000000003', 'iscritto'),
    ('33333333-0000-0000-0000-00000000000d', '11111111-0000-0000-0000-000000000003', 'iscritto'),
    ('33333333-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-000000000003', 'iscritto');

  insert into public.presenze_live (evento_id, user_id, ping_totali) values
    ('33333333-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000003', 60),
    ('33333333-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000003', 60),
    ('33333333-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000004', 60),
    ('33333333-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-000000000003', 60),
    ('33333333-0000-0000-0000-00000000000d', '11111111-0000-0000-0000-000000000003', 10),
    ('33333333-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-000000000003', 60);

  -- il credito che farà conflittare l'evento E
  insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
  values ('11111111-0000-0000-0000-000000000003', 'salute-professioni-sanitarie', 'partecipazione_webinar', 15);
end $$;

-- ════════ 1 · evento CON area: il credito arriva, nessun allarme ════════
do $$
declare
  v_cert integer;
  v_righe integer;
  v_prima integer;
  v_dopo integer;
begin
  select count(*) into v_prima from public.guasti where specie = 'credito_area_evento';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);

  select certificati into v_cert from public.chiudi_diretta_evento('33333333-0000-0000-0000-00000000000a');

  reset role;
  select count(*) into v_righe from public.activity_log
   where student_id = '11111111-0000-0000-0000-000000000003' and area_slug = 'informatica-digitale';
  select count(*) into v_dopo from public.guasti where specie = 'credito_area_evento';

  insert into esiti values (1, 'evento con area: 1 certificato, 1 riga di credito, nessun allarme', '1 cert, 1 riga, +0 allarmi',
    format('%s cert, %s righe, +%s allarmi', v_cert, v_righe, v_dopo - v_prima),
    v_cert = 1 and v_righe = 1 and v_dopo = v_prima);
end $$;

-- ════════ 2-4 · evento SENZA aree: l'allarme suona, UNA volta ════════
do $$
declare
  v_cert integer;
  v_prima integer;
  v_dopo integer;
  v_g record;
  v_credito integer;
begin
  select count(*) into v_prima from public.guasti where specie = 'credito_area_evento';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);

  select certificati into v_cert from public.chiudi_diretta_evento('33333333-0000-0000-0000-00000000000b');

  reset role;
  select count(*) into v_dopo from public.guasti where specie = 'credito_area_evento';
  select * into v_g from public.guasti where specie = 'credito_area_evento' order by avvenuto_il desc limit 1;
  select count(*) into v_credito from public.activity_log
   where student_id = '11111111-0000-0000-0000-000000000004';

  insert into esiti values (2, 'due studenti certificati senza aree: UN allarme (non due)', '2 cert, +1 allarme',
    format('%s cert, +%s allarmi', v_cert, v_dopo - v_prima), v_cert = 2 and v_dopo - v_prima = 1);
  insert into esiti values (3, 'l''allarme dice processo/motivo, e quanti hanno perso il credito',
    'diretta/chiusura · evento_senza_aree · dettaglio con «2 studenti»',
    format('%s · %s · %s', coalesce(v_g.processo, '—'), coalesce(v_g.motivo, '—'),
           case when v_g.dettaglio like '%2 studenti%' then 'ok' else coalesce(v_g.dettaglio, '—') end),
    v_g.processo = 'diretta/chiusura' and v_g.motivo = 'evento_senza_aree' and v_g.dettaglio like '%2 studenti%');
  insert into esiti values (4, 'il difetto resta com''era: nessun credito d''area per chi ha partecipato',
    '0 righe', format('%s righe', v_credito), v_credito = 0);
end $$;

-- ════════ 5 · richiusura: nessun allarme NUOVO ════════
-- Idempotenza: nessuno viene ri-certificato, quindi non c'è nessun credito
-- perso da segnalare una seconda volta.
do $$
declare
  v_cert integer;
  v_prima integer;
  v_dopo integer;
begin
  select count(*) into v_prima from public.guasti where specie = 'credito_area_evento';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);

  select certificati into v_cert from public.chiudi_diretta_evento('33333333-0000-0000-0000-00000000000b');

  reset role;
  select count(*) into v_dopo from public.guasti where specie = 'credito_area_evento';
  insert into esiti values (5, 'richiusura dello stesso evento: 0 certificati, nessun allarme nuovo', '0 cert, +0 allarmi',
    format('%s cert, +%s allarmi', v_cert, v_dopo - v_prima), v_cert = 0 and v_dopo = v_prima);
end $$;

-- ════════ 6 · evento per DOCENTI senza aree: nessun allarme ════════
do $$
declare
  v_cert integer;
  v_prima integer;
  v_dopo integer;
begin
  select count(*) into v_prima from public.guasti where specie = 'credito_area_evento';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);

  select certificati into v_cert from public.chiudi_diretta_evento('33333333-0000-0000-0000-00000000000c');

  reset role;
  select count(*) into v_dopo from public.guasti where specie = 'credito_area_evento';
  insert into esiti values (6, 'evento docenti: certifica e NON suona (le aree non deve averle)', '1 cert, +0 allarmi',
    format('%s cert, +%s allarmi', v_cert, v_dopo - v_prima), v_cert = 1 and v_dopo = v_prima);
end $$;

-- ════════ 7 · nessuno sopra soglia: niente certificati, niente allarme ════════
do $$
declare
  v_cert integer;
  v_prima integer;
  v_dopo integer;
begin
  select count(*) into v_prima from public.guasti where specie = 'credito_area_evento';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);

  select certificati into v_cert from public.chiudi_diretta_evento('33333333-0000-0000-0000-00000000000d');

  reset role;
  select count(*) into v_dopo from public.guasti where specie = 'credito_area_evento';
  insert into esiti values (7, 'evento senza aree ma senza certificati: nessun allarme (niente è andato perso)',
    '0 cert, +0 allarmi', format('%s cert, +%s allarmi', v_cert, v_dopo - v_prima), v_cert = 0 and v_dopo = v_prima);
end $$;

-- ════════ 8 · LA PROPRIETÀ CHE GIUSTIFICA IL CONTEGGIO DELLE AREE ════════
-- L'evento ha un'area, ma quel credito lo studente l'ha già preso oggi: l'insert
-- conflitta e scrive ZERO righe. Un allarme tarato su `row_count` suonerebbe
-- qui, e sarebbe un falso allarme — l'area c'è, il credito c'è, è solo il cap
-- giornaliero di activity_log che ha fatto il suo mestiere.
do $$
declare
  v_cert integer;
  v_prima integer;
  v_dopo integer;
begin
  select count(*) into v_prima from public.guasti where specie = 'credito_area_evento';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);

  select certificati into v_cert from public.chiudi_diretta_evento('33333333-0000-0000-0000-00000000000e');

  reset role;
  select count(*) into v_dopo from public.guasti where specie = 'credito_area_evento';
  insert into esiti values (8, 'area presente ma credito già preso oggi (0 righe scritte): NESSUN falso allarme',
    '1 cert, +0 allarmi', format('%s cert, +%s allarmi', v_cert, v_dopo - v_prima), v_cert = 1 and v_dopo = v_prima);
end $$;

-- ════════ 9 · l'allarme si scrive da dentro, non da fuori ════════
-- `registra_guasto` è revocata da `authenticated`: un ente non può chiamarla in
-- diretta. La proprietà 2 l'ha scritta comunque, perché chiudi_diretta_evento è
-- SECURITY DEFINER e gira col proprietario, che l'EXECUTE ce l'ha. Le due metà
-- insieme: senza questa, «l'allarme si scrive» non direbbe da dove.
do $$
declare
  v_errore text := 'nessuno';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  begin
    perform public.registra_guasto('prova', 'credito_area_evento');
  exception when insufficient_privilege then
    v_errore := 'permesso negato';
  when others then
    v_errore := 'altro: ' || sqlerrm;
  end;
  reset role;
  insert into esiti values (9, 'un ente NON può scrivere un guasto in diretta (l''allarme passa dal definer)',
    'permesso negato', v_errore, v_errore = 'permesso negato');
end $$;

select n, case when ok then '✓' else '✗ ROTTA' end as esito, proprieta, atteso, ottenuto
from esiti order by n;

-- `coalesce(ok, false)`: una proprietà il cui confronto cade su un valore
-- assente vale NULL, e non deve risultare verificata.
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' proprietà verificate' as riepilogo from esiti;

rollback;
