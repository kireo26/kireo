-- Le proprietà di 20261004140000 (lo stato non è self-service),
-- 20261004150000 + 20261004160000 (la presenza certificata scrive una prova, e
-- il cap dice quello che scarta).
--
-- Si incolla nel SQL Editor di Supabase o si lancia con psql: è tutto in una
-- transazione con ROLLBACK, non lascia niente, e finisce con un `select`
-- invece che con un silenzio.
--
-- LE CONTROPROVE, e due vogliono una replica NATA SENZA il fix (una policy e
-- una funzione sopravvivono a un `create or replace`/`drop policy` solo se
-- quel file non c'è mai stato — riapplicare su una replica già sistemata dà
-- una risposta che sembra una risposta):
--
--   1-7   togliere 20261004140000  → le proprietà 1..4 e 7 diventano ROTTE
--   8-13  togliere 20261004160000  → nessuna prova scritta: 8..11 ROTTE
--   14-17 togliere il blocco §C    → nessun guasto: 14 e 16 ROTTE
--
-- ⚠️ LA RILETTURA NON SI FA CON L'IDENTITÀ DI CHI HA SCRITTO: la RLS di
-- `iscrizioni_eventi`/`evidence` mostra all'ente e alla scuola molto meno di
-- quello che la funzione ha scritto, e una rilettura vuota si legge come «non è
-- successo niente». Dopo ogni blocco che cambia ruolo si fa `reset role`.

\set ON_ERROR_STOP on
begin;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
-- Senza questo grant la riga non entra dai blocchi che cambiano ruolo, e il
-- rosso che si legge è del banco invece che del prodotto.
grant all on esiti to anon, authenticated;

-- ════════════════════════════ fixture ════════════════════════════
insert into auth.users (id, email) values
  ('aa000000-0000-0000-0000-00000000000a', 'stu-a@test.local'),
  ('aa000000-0000-0000-0000-00000000000b', 'stu-b@test.local'),
  ('aa000000-0000-0000-0000-0000000000e1', 'ente@test.local'),
  ('aa000000-0000-0000-0000-0000000000d1', 'doc@test.local');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('aa000000-0000-0000-0000-00000000000a', 'studente', 'Stu', 'A', '2008-01-01'),
  ('aa000000-0000-0000-0000-00000000000b', 'studente', 'Stu', 'B', '2008-01-01'),
  ('aa000000-0000-0000-0000-0000000000e1', 'istituzione', 'Ref', 'Ente', '1980-01-01'),
  ('aa000000-0000-0000-0000-0000000000d1', 'docente', 'Doc', 'Ente', '1980-01-01');

insert into public.istituzioni (id, nome, slug, stato)
  values ('bb000000-0000-0000-0000-000000000001', 'Ente Test', 'ente-test', 'attiva');
insert into public.institution_profiles (user_id, istituzione_id)
  values ('aa000000-0000-0000-0000-0000000000e1', 'bb000000-0000-0000-0000-000000000001');

-- Evento A, per studenti, un'area, già finito (si può chiudere).
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, stato, pubblico,
                           data_inizio, data_fine, ore_pcto)
  values ('cc000000-0000-0000-0000-00000000000a', 'Webinar A', 'x', 'webinar',
          'bb000000-0000-0000-0000-000000000001', 'approvato', 'studenti',
          now() - interval '2 hours', now() - interval '90 minutes', 3);
insert into public.eventi_aree (evento_id, area_slug)
  values ('cc000000-0000-0000-0000-00000000000a', 'informatica-digitale');

-- Evento B, stessa area, stesso giorno: serve al §C.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, stato, pubblico,
                           data_inizio, data_fine, ore_pcto)
  values ('cc000000-0000-0000-0000-00000000000b', 'Webinar B', 'x', 'webinar',
          'bb000000-0000-0000-0000-000000000001', 'approvato', 'studenti',
          now() - interval '80 minutes', now() - interval '70 minutes', 2);
insert into public.eventi_aree (evento_id, area_slug)
  values ('cc000000-0000-0000-0000-00000000000b', 'informatica-digitale');

-- Evento D, per docenti.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, stato, pubblico,
                           filone, data_inizio, data_fine, ore_pcto)
  values ('cc000000-0000-0000-0000-00000000000d', 'Webinar Docenti', 'x', 'webinar',
          'bb000000-0000-0000-0000-000000000001', 'approvato', 'docenti',
          'ai_didattica', now() - interval '2 hours', now() - interval '90 minutes', 0);

-- Evento E, futuro: serve alle proprietà sulla policy di insert.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, stato, pubblico,
                           data_inizio, data_fine, ore_pcto)
  values ('cc000000-0000-0000-0000-00000000000e', 'Webinar E', 'x', 'webinar',
          'bb000000-0000-0000-0000-000000000001', 'approvato', 'studenti',
          now() + interval '1 day', now() + interval '1 day 1 hour', 1);
insert into public.eventi_aree (evento_id, area_slug)
  values ('cc000000-0000-0000-0000-00000000000e', 'agrifood-ambiente');

-- ═══════════════ §A — lo stato non è self-service ═══════════════
do $$
declare v_ok boolean;
begin
  perform set_config('request.jwt.claim.sub', 'aa000000-0000-0000-0000-00000000000a', true);
  set local role authenticated;

  -- 1 · stato = 'partecipato'
  begin
    insert into public.iscrizioni_eventi (student_id, evento_id, stato)
    values ('aa000000-0000-0000-0000-00000000000a', 'cc000000-0000-0000-0000-00000000000e', 'partecipato');
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  delete from public.iscrizioni_eventi where evento_id = 'cc000000-0000-0000-0000-00000000000e';
  insert into esiti values (1, 'lo studente NON si scrive stato=partecipato (le ore PCTO)',
    'respinto', case when v_ok then 'respinto' else 'PASSATO' end, v_ok);

  -- 2 · certificata_da_tipo = 'sistema' (il discriminante del §2)
  set local role authenticated;
  begin
    insert into public.iscrizioni_eventi (student_id, evento_id, certificata_da_tipo, certificata_il)
    values ('aa000000-0000-0000-0000-00000000000a', 'cc000000-0000-0000-0000-00000000000e', 'sistema', now());
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  delete from public.iscrizioni_eventi where evento_id = 'cc000000-0000-0000-0000-00000000000e';
  insert into esiti values (2, 'NON si firma una certificazione «sistema»',
    'respinto', case when v_ok then 'respinto' else 'PASSATO' end, v_ok);

  -- 3 · origine = 'scuola'
  set local role authenticated;
  begin
    insert into public.iscrizioni_eventi (student_id, evento_id, origine)
    values ('aa000000-0000-0000-0000-00000000000a', 'cc000000-0000-0000-0000-00000000000e', 'scuola');
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  delete from public.iscrizioni_eventi where evento_id = 'cc000000-0000-0000-0000-00000000000e';
  insert into esiti values (3, 'NON si dichiara un''iscrizione d''ufficio della scuola',
    'respinto', case when v_ok then 'respinto' else 'PASSATO' end, v_ok);

  -- 4 · iscritto_da valorizzato
  set local role authenticated;
  begin
    insert into public.iscrizioni_eventi (student_id, evento_id, iscritto_da)
    values ('aa000000-0000-0000-0000-00000000000a', 'cc000000-0000-0000-0000-00000000000e',
            'aa000000-0000-0000-0000-0000000000e1');
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  delete from public.iscrizioni_eventi where evento_id = 'cc000000-0000-0000-0000-00000000000e';
  insert into esiti values (4, 'NON si nomina una terza persona in iscritto_da',
    'respinto', case when v_ok then 'respinto' else 'PASSATO' end, v_ok);

  -- 5 · l'iscrizione NORMALE passa (non abbiamo rotto niente)
  set local role authenticated;
  begin
    insert into public.iscrizioni_eventi (student_id, evento_id)
    values ('aa000000-0000-0000-0000-00000000000a', 'cc000000-0000-0000-0000-00000000000e');
    v_ok := true;
  exception when others then v_ok := false;
  end;
  reset role;
  insert into esiti values (5, 'l''iscrizione normale (solo studente+evento) passa',
    'riuscita', case when v_ok then 'riuscita' else 'RESPINTA' end, v_ok);

  -- 6 · si disdice un'iscrizione non certificata
  set local role authenticated;
  delete from public.iscrizioni_eventi
  where student_id = 'aa000000-0000-0000-0000-00000000000a'
    and evento_id = 'cc000000-0000-0000-0000-00000000000e';
  reset role;
  select not exists (
    select 1 from public.iscrizioni_eventi
    where student_id = 'aa000000-0000-0000-0000-00000000000a'
      and evento_id = 'cc000000-0000-0000-0000-00000000000e') into v_ok;
  insert into esiti values (6, 'si disdice un''iscrizione non certificata',
    'cancellata', case when v_ok then 'cancellata' else 'ANCORA LÌ' end, v_ok);
end $$;

-- 7 · NON si cancella un'iscrizione CERTIFICATA (una certificazione non si
--     cancella: senza questo, cancellare e reinserire rimette lo studente
--     nell'insieme che chiudi_diretta_evento certifica, e la seconda chiusura
--     scrive una seconda prova).
insert into public.iscrizioni_eventi (student_id, evento_id, stato, certificata_da_tipo, certificata_il)
  values ('aa000000-0000-0000-0000-00000000000b', 'cc000000-0000-0000-0000-00000000000e',
          'partecipato', 'sistema', now());
do $$
declare v_restata boolean;
begin
  perform set_config('request.jwt.claim.sub', 'aa000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  delete from public.iscrizioni_eventi
  where student_id = 'aa000000-0000-0000-0000-00000000000b'
    and evento_id = 'cc000000-0000-0000-0000-00000000000e';
  reset role;
  select exists (
    select 1 from public.iscrizioni_eventi
    where student_id = 'aa000000-0000-0000-0000-00000000000b'
      and evento_id = 'cc000000-0000-0000-0000-00000000000e') into v_restata;
  insert into esiti values (7, 'NON si cancella un''iscrizione certificata',
    'resta', case when v_restata then 'resta' else 'CANCELLATA' end, v_restata);
end $$;
delete from public.iscrizioni_eventi where evento_id = 'cc000000-0000-0000-0000-00000000000e';

-- ═══════════════ §2 — la prova della presenza ═══════════════
-- Due studenti iscritti all'evento A, uno con copertura piena e uno sotto
-- soglia. L'evento dura 30 minuti → 30 ping attesi, soglia 22,5.
insert into public.iscrizioni_eventi (student_id, evento_id) values
  ('aa000000-0000-0000-0000-00000000000a', 'cc000000-0000-0000-0000-00000000000a'),
  ('aa000000-0000-0000-0000-00000000000b', 'cc000000-0000-0000-0000-00000000000a');
insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('cc000000-0000-0000-0000-00000000000a', 'aa000000-0000-0000-0000-00000000000a', 24),
  ('cc000000-0000-0000-0000-00000000000a', 'aa000000-0000-0000-0000-00000000000b', 5);

do $$
declare v_p integer; v_c integer;
begin
  perform set_config('request.jwt.claim.sub', 'aa000000-0000-0000-0000-0000000000e1', true);
  set local role authenticated;
  select presenti, certificati into v_p, v_c
  from public.chiudi_diretta_evento('cc000000-0000-0000-0000-00000000000a');
  reset role;
  insert into esiti values (8, 'la chiusura certifica solo chi è sopra soglia',
    '2 presenti, 1 certificati', format('%s presenti, %s certificati', v_p, v_c),
    v_p = 2 and v_c = 1);
end $$;

do $$
declare v_n integer; v_fonte text; v_dim text; v_peso numeric; v_val numeric; v_mot text; v_ev uuid;
begin
  select count(*), min(fonte::text), min(dimensione::text), min(peso), min(valore), min(motivazione), min(evento_id::text)::uuid
    into v_n, v_fonte, v_dim, v_peso, v_val, v_mot, v_ev
  from public.evidence
  where student_id = 'aa000000-0000-0000-0000-00000000000a';

  insert into esiti values (9, 'una prova per area, curiosity, peso 0,5, fonte presenza',
    '1 / curiosity / 0.50 / presenza',
    format('%s / %s / %s / %s', v_n, v_dim, v_peso, v_fonte),
    v_n = 1 and v_dim = 'curiosity' and v_peso = 0.50 and v_fonte = 'presenza');

  -- `valore` è la COPERTURA misurata, non una costante: 24/30 = 0,800.
  insert into esiti values (10, 'valore = la copertura misurata (24 ping su 30 attesi)',
    '0.800', coalesce(v_val::text, '(nessuna)'), v_val = 0.800);

  insert into esiti values (11, 'la prova porta l''evento e la motivazione concordata',
    'evento A / «Da un incontro che hai seguito per intero.»',
    format('%s / «%s»', case when v_ev = 'cc000000-0000-0000-0000-00000000000a' then 'evento A' else '(altro)' end,
           coalesce(v_mot, '(nessuna)')),
    v_ev = 'cc000000-0000-0000-0000-00000000000a'
      and v_mot = 'Da un incontro che hai seguito per intero.');

  -- Chi è sotto soglia non ha nessuna prova.
  select count(*) into v_n from public.evidence where student_id = 'aa000000-0000-0000-0000-00000000000b';
  insert into esiti values (12, 'chi è sotto soglia non lascia nessuna prova',
    '0', v_n::text, v_n = 0);
end $$;

-- 13 · il profilo: curiosity valorizzato, interest NULLO → nessuna affinità,
--      per nessun peso e per nessun numero.
do $$
declare v_cur smallint; v_int smallint; v_conf numeric;
begin
  select curiosity_score, interest_score, confidence into v_cur, v_int, v_conf
  from public.area_signal
  where student_id = 'aa000000-0000-0000-0000-00000000000a' and area_slug = 'informatica-digitale';
  insert into esiti values (13, 'area_signal: curiosity 80, interest NULLO, confidence 0,050',
    '80 / (null) / 0.050',
    format('%s / %s / %s', coalesce(v_cur::text,'(null)'), coalesce(v_int::text,'(null)'), coalesce(v_conf::text,'(nessuna riga)')),
    v_cur = 80 and v_int is null and v_conf = 0.050);
end $$;

-- 14 · idempotenza: una seconda chiusura non scrive una seconda prova.
do $$
declare v_c integer; v_n integer;
begin
  perform set_config('request.jwt.claim.sub', 'aa000000-0000-0000-0000-0000000000e1', true);
  set local role authenticated;
  select certificati into v_c from public.chiudi_diretta_evento('cc000000-0000-0000-0000-00000000000a');
  reset role;
  select count(*) into v_n from public.evidence where student_id = 'aa000000-0000-0000-0000-00000000000a';
  insert into esiti values (14, 'seconda chiusura: 0 certificati, nessuna prova in più',
    '0 certificati, 1 prove', format('%s certificati, %s prove', v_c, v_n),
    v_c = 0 and v_n = 1);
end $$;

-- 15 · un evento per DOCENTI non scrive nessuna prova (e nessun profilo d'area).
insert into public.iscrizioni_eventi (student_id, evento_id)
  values ('aa000000-0000-0000-0000-0000000000d1', 'cc000000-0000-0000-0000-00000000000d');
insert into public.presenze_live (evento_id, user_id, ping_totali)
  values ('cc000000-0000-0000-0000-00000000000d', 'aa000000-0000-0000-0000-0000000000d1', 28);
do $$
declare v_prove integer; v_att integer;
begin
  perform set_config('request.jwt.claim.sub', 'aa000000-0000-0000-0000-0000000000e1', true);
  set local role authenticated;
  perform public.chiudi_diretta_evento('cc000000-0000-0000-0000-00000000000d');
  reset role;
  select count(*) into v_prove from public.evidence where student_id = 'aa000000-0000-0000-0000-0000000000d1';
  select count(*) into v_att from public.attestati where user_id = 'aa000000-0000-0000-0000-0000000000d1';
  insert into esiti values (15, 'evento docenti: attestato sì, prove d''area no',
    '0 prove, 1 attestati', format('%s prove, %s attestati', v_prove, v_att),
    v_prove = 0 and v_att = 1);
end $$;

-- ═══════════════ §C — il cap dice quello che scarta ═══════════════
-- Evento B, stessa area, stesso giorno, stesso studente: la riga di
-- activity_log è già lì e il cap la sopprime.
insert into public.iscrizioni_eventi (student_id, evento_id)
  values ('aa000000-0000-0000-0000-00000000000a', 'cc000000-0000-0000-0000-00000000000b');
insert into public.presenze_live (evento_id, user_id, ping_totali)
  values ('cc000000-0000-0000-0000-00000000000b', 'aa000000-0000-0000-0000-00000000000a', 10);

do $$
declare v_righe integer; v_guasti integer; v_dett text;
begin
  select count(*) into v_righe from public.activity_log
  where student_id = 'aa000000-0000-0000-0000-00000000000a'
    and area_slug = 'informatica-digitale' and tipo_attivita = 'partecipazione_webinar';

  perform set_config('request.jwt.claim.sub', 'aa000000-0000-0000-0000-0000000000e1', true);
  set local role authenticated;
  perform public.chiudi_diretta_evento('cc000000-0000-0000-0000-00000000000b');
  reset role;

  insert into esiti values (16, 'linea di base: una riga di credito prima del secondo evento',
    '1', v_righe::text, v_righe = 1);

  select count(*) into v_righe from public.activity_log
  where student_id = 'aa000000-0000-0000-0000-00000000000a'
    and area_slug = 'informatica-digitale' and tipo_attivita = 'partecipazione_webinar';
  insert into esiti values (17, 'il cap sopprime il secondo credito (resta UNA riga)',
    '1', v_righe::text, v_righe = 1);

  select count(*), min(dettaglio) into v_guasti, v_dett from public.guasti
  where specie = 'credito_area_fuso' and processo = 'diretta/chiusura';
  insert into esiti values (18, 'e il cap REGISTRA quello che ha scartato',
    '1 guasti', format('%s guasti', v_guasti), v_guasti = 1);

  insert into esiti values (19, 'il dettaglio nomina lo studente e l''area (la domanda ha una risposta)',
    'studente:area nel dettaglio',
    case when v_dett like '%aa000000-0000-0000-0000-00000000000a:informatica-digitale%'
         then 'studente:area nel dettaglio' else coalesce(left(v_dett, 60), '(nessuno)') end,
    v_dett like '%aa000000-0000-0000-0000-00000000000a:informatica-digitale%');

  -- La prova del §2 invece c'è: due presenze sono due fatti, e `evidence` non
  -- ha nessun cap. È la ragione per cui la prova non riusa quel cap.
  select count(*) into v_righe from public.evidence
  where student_id = 'aa000000-0000-0000-0000-00000000000a' and fonte = 'presenza';
  insert into esiti values (20, 'ma le PROVE sono due: evidence non ha il cap di activity_log',
    '2', v_righe::text, v_righe = 2);
end $$;

-- 21 · un solo evento non produce nessun allarme (nessun falso positivo).
do $$
declare v_g integer;
begin
  select count(*) into v_g from public.guasti
  where specie = 'credito_area_fuso' and dettaglio like '%aa000000-0000-0000-0000-00000000000b:%';
  insert into esiti values (21, 'nessun allarme per lo studente sotto soglia (mai certificato)',
    '0', v_g::text, v_g = 0);
end $$;

-- ═══════════ §C lato scuola, e il falso positivo che si evita ═══════════
insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto)
  values ('TEST0001', 'Scuola Test', 'MI', 'Liceo') on conflict do nothing;
insert into public.scuole_profili (id, scuola_id, stato)
  values ('dd000000-0000-0000-0000-000000000001', 'TEST0001', 'attiva');
insert into auth.users (id, email) values ('aa000000-0000-0000-0000-0000000000f1', 'ref@test.local');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
  values ('aa000000-0000-0000-0000-0000000000f1', 'referente_scuola', 'Ref', 'Scuola', '1980-01-01');
insert into public.school_staff (scuola_profilo_id, user_id, ruolo_staff, attivo, creato_da)
  values ('dd000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-0000000000f1', 'referente', true, 'aa000000-0000-0000-0000-0000000000f1');

insert into auth.users (id, email) values ('aa000000-0000-0000-0000-00000000000c', 'stu-c@test.local');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
  values ('aa000000-0000-0000-0000-00000000000c', 'studente', 'Stu', 'C', '2008-01-01');
insert into public.student_profiles (user_id, school_code, classe, anno_diploma, stato_verifica)
  values ('aa000000-0000-0000-0000-00000000000c', 'TEST0001', '5A', 2027, 'verificato');
insert into public.iscrizioni_eventi (student_id, evento_id, origine, iscritto_da) values
  ('aa000000-0000-0000-0000-00000000000c', 'cc000000-0000-0000-0000-00000000000a', 'scuola', 'aa000000-0000-0000-0000-0000000000f1'),
  ('aa000000-0000-0000-0000-00000000000c', 'cc000000-0000-0000-0000-00000000000b', 'scuola', 'aa000000-0000-0000-0000-0000000000f1');

do $$
declare v_prove integer; v_g integer;
begin
  perform set_config('request.jwt.claim.sub', 'aa000000-0000-0000-0000-0000000000f1', true);
  set local role authenticated;
  perform public.certifica_presenza('cc000000-0000-0000-0000-00000000000a', 'aa000000-0000-0000-0000-00000000000c');
  reset role;

  -- 22 · la certificazione della SCUOLA non scrive nessuna prova: è la
  --      dichiarazione di un terzo, non un heartbeat.
  select count(*) into v_prove from public.evidence where student_id = 'aa000000-0000-0000-0000-00000000000c';
  insert into esiti values (22, 'certificazione della scuola: nessuna prova nel profilo',
    '0', v_prove::text, v_prove = 0);

  -- 23 · e nessun allarme: è il primo credito di quell'area oggi
  select count(*) into v_g from public.guasti
  where specie = 'credito_area_fuso' and processo = 'scuola/certificazione';
  insert into esiti values (23, 'prima certificazione della scuola: nessun allarme',
    '0', v_g::text, v_g = 0);

  -- 24 · RI-certificazione dello STESSO evento: ancora nessun allarme (il
  --      falso positivo che una lettura dopo l'upsert avrebbe prodotto)
  set local role authenticated;
  perform public.certifica_presenza('cc000000-0000-0000-0000-00000000000a', 'aa000000-0000-0000-0000-00000000000c');
  reset role;
  select count(*) into v_g from public.guasti
  where specie = 'credito_area_fuso' and processo = 'scuola/certificazione';
  insert into esiti values (24, 'ri-certificazione dello stesso evento: ancora nessun allarme',
    '0', v_g::text, v_g = 0);

  -- 25 · un SECONDO evento della stessa area, lo stesso giorno: allarme
  set local role authenticated;
  perform public.certifica_presenza('cc000000-0000-0000-0000-00000000000b', 'aa000000-0000-0000-0000-00000000000c');
  reset role;
  select count(*) into v_g from public.guasti
  where specie = 'credito_area_fuso' and processo = 'scuola/certificazione';
  insert into esiti values (25, 'secondo evento della stessa area: il cap lo registra',
    '1', v_g::text, v_g = 1);
end $$;

-- ════════════════════════════ esito ════════════════════════════
select n, cosa, atteso, trovato, case when ok then 'OK' else '*** ROTTO ***' end as esito
from esiti order by n;

-- `coalesce(ok, false)` e non `not ok`: un `ok` NULL (una proprietà il cui
-- confronto cade su un valore assente — `v_cur = 80` con v_cur nullo) si legge
-- ROTTO nella tabella qui sopra e NON si conterebbe nel riassunto, che
-- direbbe meno rotte di quante se ne vedono. Misurato: 16/25 verificate e
-- «5 ROTTE» mentre le righe rosse erano nove. È la direzione comoda, e un
-- riassunto che la prende è un riassunto che nessuno va a ricontrollare.
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) || ' proprietà verificate' as riassunto,
       case when count(*) filter (where not coalesce(ok, false)) = 0
            then 'TUTTO VERDE'
            else '*** ' || count(*) filter (where not coalesce(ok, false)) || ' ROTTE ***' end as verdetto
from esiti;

rollback;
