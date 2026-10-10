-- Verifica di 20261011110000_domanda_chi_la_tocca.sql: la riga di una domanda
-- dice chi l'ha toccata e quando, così due moderatori non rispondono entrambi
-- alla stessa e nessuno a quella dopo.
--
-- Gira anche nel SQL Editor di Supabase: tutto dentro una transazione che
-- finisce con ROLLBACK, e in coda un `select` invece di un silenzio — un file
-- che non stampa niente non si distingue da un file che non è stato eseguito.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA la migrazione: un
-- `drop`+`create` di funzione ricrea lo stato e i permessi, quindi riapplicare
-- un file sabotato sulla stessa replica dà una risposta che SEMBRA una
-- risposta.
--   - senza la migrazione intera: cadono le colonne, quindi quasi tutto;
--   - togliendo le due colonne dall'`update` di `aggiorna_stato_domanda_live`:
--     diventano rosse la 2, la 3 e la 4 (lo stato cambia e la riga resta muta,
--     cioè il difetto di partenza);
--   - togliendo le due colonne dal ramo STUDENTI di
--     `domande_live_organizzatore`: diventa rossa la 5 — e la 6, che è il ramo
--     docenti, resta verde: le due metà si guardano separate apposta, perché
--     una modifica a un ramo solo è la cosa più facile da fare;
--   - togliendo il CHECK `domande_live_nuova_senza_tocco`: diventa rossa la 9.
--
-- ⚠️ `now()` È COSTANTE DENTRO UNA TRANSAZIONE, quindi «la seconda transizione
-- sposta l'ora» NON si può provare qui confrontando due `now()`: la 4 mette
-- l'ora indietro a mano e verifica che la funzione la sposti. Un confronto fra
-- due `now()` resterebbe verde anche con l'`update` sabotato.

begin;

set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
-- Il registro si scrive anche da dentro i blocchi che cambiano ruolo: senza
-- questo grant la riga non entra e il rosso che si legge è del banco, non del
-- prodotto.
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

-- EV_S — diretta in corso, pubblico studenti (ramo anonimo).
-- EV_D — diretta in corso, pubblico docenti (ramo col nome).
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                           filone, hosting_diretta, youtube_video_id, incorporamento_sonda) values
  ('e0000000-0000-0000-0000-000000000055', 'Studenti', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '5 minutes', now() + interval '25 minutes', 'approvato', 'studenti', null, 'kireo', 'abcdefghijk', 'attivo'),
  ('e0000000-0000-0000-0000-000000000066', 'Docenti', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '5 minutes', now() + interval '25 minutes', 'approvato', 'docenti', 'ai_didattica', 'kireo', 'abcdefghijk', 'attivo');

insert into public.eventi_aree (evento_id, area_slug) values
  ('e0000000-0000-0000-0000-000000000055', 'informatica-digitale');

insert into public.iscrizioni_eventi (evento_id, student_id, iscritto_da) values
  ('e0000000-0000-0000-0000-000000000055', '22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000066', '33333333-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001');

-- Tre domande sull'evento studenti (il rate limit è 1/minuto: si scrivono come
-- postgres, che non passa dalla policy, e con `creata_il` distanziati) più una
-- sull'evento docenti.
insert into public.domande_live (id, evento_id, user_id, testo, creata_il) values
  ('dddddddd-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000055', '22222222-0000-0000-0000-000000000001', 'Prima', now() - interval '4 minutes'),
  ('dddddddd-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000055', '22222222-0000-0000-0000-000000000001', 'Seconda', now() - interval '3 minutes'),
  ('dddddddd-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000055', '22222222-0000-0000-0000-000000000001', 'Terza', now() - interval '2 minutes'),
  ('dddddddd-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000066', '33333333-0000-0000-0000-000000000001', 'Docente', now() - interval '2 minutes');

-- =================================================================
-- §1 — CHI TOCCA LA RIGA LO SCRIVE
-- =================================================================

-- 1) Una domanda appena arrivata non ha nessun tocco.
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.domande_live
  where id = 'dddddddd-0000-0000-0000-000000000001'
    and stato = 'nuova' and stato_da_tipo is null and stato_il is null;
  insert into esiti values (1, 'domanda nuova: nessun tocco', '1 riga', v_n || ' righe', v_n = 1);
end $$;

-- 2) L'ente la segna letta: la riga dice «ente» e porta un'ora.
do $$
declare v_tipo text; v_il timestamptz;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  perform public.aggiorna_stato_domanda_live('dddddddd-0000-0000-0000-000000000001', 'letta');
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  select stato_da_tipo, stato_il into v_tipo, v_il from public.domande_live
  where id = 'dddddddd-0000-0000-0000-000000000001';
  insert into esiti values (2, 'l''ente segna letta: la riga dice chi e quando', 'ente + un''ora',
    coalesce(v_tipo, 'NULL') || ' + ' || coalesce(v_il::text, 'NULL'),
    v_tipo = 'ente' and v_il is not null);
end $$;

-- 3) L'admin segna letta un'altra domanda: la riga dice «kireo».
do $$
declare v_tipo text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000003', true);
  perform public.aggiorna_stato_domanda_live('dddddddd-0000-0000-0000-000000000002', 'letta');
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  select stato_da_tipo into v_tipo from public.domande_live
  where id = 'dddddddd-0000-0000-0000-000000000002';
  insert into esiti values (3, 'l''admin segna letta: la riga dice kireo', 'kireo', coalesce(v_tipo, 'NULL'), v_tipo = 'kireo');
end $$;

-- 4) LA SECONDA TRANSIZIONE SPOSTA L'ORA E CAMBIA LA PARTE.
--    ⚠️ L'ora si mette indietro A MANO prima di chiamare: dentro una
--    transazione `now()` è costante, quindi confrontare due `now()` sarebbe
--    verde anche con l'`update` sabotato.
--    E `letta_il` NON si sposta: è l'ora del PRIMO tocco, e un nome che tiene
--    un'altra cosa è la specie di casa.
do $$
declare v_tipo text; v_il timestamptz; v_letta timestamptz; v_prima timestamptz;
begin
  -- ⚠️ LA PRECONDIZIONE SI SCRIVE INTERA, e le due colonne insieme: il CHECK di
  -- completezza rifiuta mezzo tocco, quindi scrivere `stato_il` da solo
  -- AMMAZZA la transazione invece di produrre una riga rossa — cioè «rotto» e
  -- «lo script non gira» tornerebbero indistinguibili (difetto già pagato il
  -- 4/10 e il 5/10). Non maschera la sabotatura: che la PRIMA transizione
  -- scriva le colonne lo provano la 2 e la 3; questa prova che la SECONDA
  -- sposti l'ora, e la sua precondizione è un tocco completo nel passato.
  update public.domande_live
  set stato_da_tipo = 'ente', stato_il = now() - interval '10 minutes', letta_il = now() - interval '10 minutes'
  where id = 'dddddddd-0000-0000-0000-000000000001';
  select stato_il into v_prima from public.domande_live where id = 'dddddddd-0000-0000-0000-000000000001';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000003', true);
  perform public.aggiorna_stato_domanda_live('dddddddd-0000-0000-0000-000000000001', 'risposta_live');
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  select stato_da_tipo, stato_il, letta_il into v_tipo, v_il, v_letta from public.domande_live
  where id = 'dddddddd-0000-0000-0000-000000000001';
  insert into esiti values (4, 'seconda transizione: parte e ora si spostano, letta_il no',
    'kireo + ora nuova + letta_il ferma',
    coalesce(v_tipo, 'NULL') || ' + ' || (case when v_il > v_prima then 'ora nuova' else 'ora ferma' end)
      || ' + ' || (case when v_letta = v_prima then 'letta_il ferma' else 'letta_il spostata' end),
    v_tipo = 'kireo' and v_il > v_prima and v_letta = v_prima);
end $$;

-- =================================================================
-- §2 — CHI LEGGE LE VEDE, E L'ANONIMATO RESTA
-- =================================================================

-- 5) L'ente legge le proprie domande e trova il tocco. RAMO STUDENTI: nessun
--    nome, per costruzione (quel ramo non tocca `profiles`).
do $$
declare v_tipo text; v_il timestamptz; v_nome text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select d.stato_da_tipo, d.stato_il, d.nome_completo into v_tipo, v_il, v_nome
  from public.domande_live_organizzatore('e0000000-0000-0000-0000-000000000055') d
  where d.id = 'dddddddd-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (5, 'l''ente legge il tocco (ramo studenti, anonimo)', 'kireo + ora + nessun nome',
    coalesce(v_tipo, 'NULL') || ' + ' || (case when v_il is null then 'nessuna ora' else 'ora' end)
      || ' + ' || coalesce(v_nome, 'nessun nome'),
    v_tipo = 'kireo' and v_il is not null and v_nome is null);
end $$;

-- 6) RAMO DOCENTI: il nome c'è (è la metà che la modifica poteva rompere
--    toccando un ramo solo), e il tocco pure.
do $$
declare v_tipo text; v_nome text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  perform public.aggiorna_stato_domanda_live('dddddddd-0000-0000-0000-000000000004', 'letta');
  select d.stato_da_tipo, d.nome_completo into v_tipo, v_nome
  from public.domande_live_organizzatore('e0000000-0000-0000-0000-000000000066') d
  where d.id = 'dddddddd-0000-0000-0000-000000000004';
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (6, 'ramo docenti: nome e tocco insieme', 'ente + Do Cente',
    coalesce(v_tipo, 'NULL') || ' + ' || coalesce(v_nome, 'NULL'),
    v_tipo = 'ente' and v_nome = 'Do Cente');
end $$;

-- 7) Un ente che non è l'organizzatore non legge niente.
do $$
declare v_msg text := 'nessuna eccezione';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000002', true);
  begin
    perform * from public.domande_live_organizzatore('e0000000-0000-0000-0000-000000000055');
  exception when others then v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (7, 'un altro ente non legge le domande', 'non_autorizzato', v_msg, v_msg = 'non_autorizzato');
end $$;

-- 8) Un anonimo non arriva nemmeno alla guardia: il permesso è la prima porta.
do $$
declare v_msg text := 'nessuna eccezione';
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.domande_live_organizzatore('e0000000-0000-0000-0000-000000000055');
  exception when insufficient_privilege then v_msg := 'permission denied';
            when others then v_msg := 'sono arrivato alla guardia (' || sqlerrm || '): il permesso ha ceduto';
  end;
  reset role;
  insert into esiti values (8, 'un anonimo non arriva nemmeno alla guardia', 'permission denied', v_msg, v_msg = 'permission denied');
end $$;

-- =================================================================
-- §3 — I VINCOLI
-- =================================================================

-- 9) Una domanda `nuova` non può avere un autore del tocco: altrimenti la riga
--    a schermo direbbe «letta dall'ente» su una domanda che nessuno ha letto.
do $$
declare v_msg text := 'passata';
begin
  begin
    update public.domande_live set stato_da_tipo = 'ente', stato_il = now()
    where id = 'dddddddd-0000-0000-0000-000000000003';
  exception when check_violation then v_msg := 'check_violation';
            when others then v_msg := sqlerrm;
  end;
  insert into esiti values (9, 'una domanda nuova non può avere un autore del tocco', 'check_violation', v_msg, v_msg = 'check_violation');
end $$;

-- 10) Mezzo tocco (la parte senza l'ora) non è rappresentabile.
do $$
declare v_msg text := 'passata';
begin
  begin
    update public.domande_live set stato = 'letta', stato_da_tipo = 'ente', stato_il = null
    where id = 'dddddddd-0000-0000-0000-000000000003';
  exception when check_violation then v_msg := 'check_violation';
            when others then v_msg := sqlerrm;
  end;
  insert into esiti values (10, 'mezzo tocco (parte senza ora) respinto', 'check_violation', v_msg, v_msg = 'check_violation');
end $$;

-- 11) Una parte inventata è respinta.
do $$
declare v_msg text := 'passata';
begin
  begin
    update public.domande_live set stato = 'letta', stato_da_tipo = 'sistema', stato_il = now()
    where id = 'dddddddd-0000-0000-0000-000000000003';
  exception when check_violation then v_msg := 'check_violation';
            when others then v_msg := sqlerrm;
  end;
  insert into esiti values (11, 'una parte inventata è respinta', 'check_violation', v_msg, v_msg = 'check_violation');
end $$;

-- 12) NESSUNA REGRESSIONE: uno studente continua a vedere solo le PROPRIE
--     domande, e non quelle di un altro evento.
do $$
declare v_n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-000000000001', true);
  select count(*) into v_n from public.domande_live;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (12, 'lo studente vede solo le proprie domande', '3', v_n::text, v_n = 3);
end $$;

-- 13) NESSUNA REGRESSIONE: uno stato inventato è ancora respinto.
do $$
declare v_msg text := 'passata';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  begin
    perform public.aggiorna_stato_domanda_live('dddddddd-0000-0000-0000-000000000003', 'archiviata');
  exception when others then v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (13, 'uno stato inventato è respinto', 'stato_non_valido', v_msg, v_msg = 'stato_non_valido');
end $$;

-- 14) NESSUNA REGRESSIONE: un ente che non è l'organizzatore non cambia lo
--     stato di una domanda altrui.
do $$
declare v_msg text := 'passata';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000002', true);
  begin
    perform public.aggiorna_stato_domanda_live('dddddddd-0000-0000-0000-000000000003', 'letta');
  exception when others then v_msg := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into esiti values (14, 'un altro ente non cambia lo stato', 'non_autorizzato', v_msg, v_msg = 'non_autorizzato');
end $$;

-- ---------------------------------------------------------------- esito
select * from esiti order by n;
-- `coalesce(ok, false)`: un `ok` NULL (un confronto su un valore assente) non
-- verrebbe contato da un `filter (where not ok)`, e il riepilogo direbbe
-- «tutto verde» mentre la tabella sopra stampa delle righe ROTTE.
select count(*) filter (where coalesce(ok, false)) || '/' || count(*) as verificate,
       count(*) filter (where not coalesce(ok, false)) as rotte
from esiti;

rollback;
