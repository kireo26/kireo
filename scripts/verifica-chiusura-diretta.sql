-- Verifica di 20261011100000_chiusura_diretta.sql: chiudere una diretta lascia
-- una traccia sull'evento, e ripremere dice «l'ho già fatto» invece di
-- «nessuno si è qualificato».
--
-- Gira anche nel SQL Editor di Supabase: tutto dentro una transazione che
-- finisce con ROLLBACK, e in coda un `select` invece di un silenzio — un file
-- che non stampa niente non si distingue da un file che non è stato eseguito.
--
-- LA CONTROPROVA va fatta su una replica NATA SENZA la migrazione: un
-- `drop`+`create` di funzione e un `drop policy`/`create policy` ricreano lo
-- stato, quindi riapplicare un file sabotato sulla stessa replica dà una
-- risposta che SEMBRA una risposta.
--   - senza la migrazione intera: cadono le colonne, quindi quasi tutto;
--   - tenendo le colonne e togliendo il `return` anticipato: diventano rosse
--     la 4 e la 6 — la 4 è quella che conta, perché è il difetto del 4/10
--     (la seconda pressione risponde «0 certificazioni» a secco, cioè
--     un'affermazione sugli studenti al posto di «l'ho già fatto»);
--   - togliendo le tre clausole dal `with check` di
--     `eventi_update_propria_non_revisionato`: diventa rossa la 11, e la 12
--     resta verde — che è la metà che la cura poteva rompere;
--   - spostando la scrittura della traccia DOPO il ciclo: la 3 resta verde e
--     NON si vede niente, perché la corsa fra due pressioni non si riproduce
--     in una transazione sola. Quella proprietà la tiene la `where`, non una
--     sonda: sta scritta nella funzione.
--
-- ⚠️ QUELLO CHE QUESTO FILE **NON** PROVA: il denominatore. `ping_attesi_evento`
-- resta la durata PROGRAMMATA, e la traccia non la cambia — vedi la testa
-- della migrazione per il perché (`diretta_chiusa_il` è sempre >= `data_fine`,
-- quindi non è la fine vera della trasmissione).

begin;

set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
-- Il registro degli esiti si scrive anche da dentro i blocchi che cambiano
-- ruolo: senza questo grant la riga non entra e il rosso che si legge è del
-- banco, non del prodotto.
grant all on esiti to anon, authenticated;

-- ---------------------------------------------------------------- dati
insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'ente@test.it'),
  ('11111111-0000-0000-0000-000000000002', 'altro-ente@test.it'),
  ('11111111-0000-0000-0000-000000000003', 'admin@test.it'),
  ('22222222-0000-0000-0000-000000000001', 'studente1@test.it'),
  ('22222222-0000-0000-0000-000000000002', 'studente2@test.it');

insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
  ('11111111-0000-0000-0000-000000000001', 'istituzione', 'E', 'Nte', '1980-01-01'),
  ('11111111-0000-0000-0000-000000000002', 'istituzione', 'Al', 'Tro', '1980-01-01'),
  ('11111111-0000-0000-0000-000000000003', 'admin', 'Ad', 'Min', '1980-01-01'),
  ('22222222-0000-0000-0000-000000000001', 'studente', 'Pri', 'Mo', '2008-01-01'),
  ('22222222-0000-0000-0000-000000000002', 'studente', 'Sec', 'Ondo', '2008-01-01');

insert into public.istituzioni (id, nome, slug, tipo, stato) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ente Uno', 'ente-uno', 'universita', 'attiva'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ente Due', 'ente-due', 'universita', 'attiva');

insert into public.institution_profiles (user_id, istituzione_id) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');

-- EV_A — finita, con un'area: due iscritti, uno sopra soglia e uno sotto.
--   dura 10 minuti → ping_attesi 10 → soglia 0,75 → servono 8 ping.
-- EV_C — finita, per la chiusura dell'admin.
-- EV_B — ancora in corso.
-- EV_D — bozza, per la policy.
insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, stato, pubblico,
                           hosting_diretta, youtube_video_id, incorporamento_sonda) values
  ('e0000000-0000-0000-0000-0000000000aa', 'Finita', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '1 hour', now() - interval '50 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo'),
  ('e0000000-0000-0000-0000-0000000000cc', 'Finita due', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '1 hour', now() - interval '50 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo'),
  ('e0000000-0000-0000-0000-0000000000bb', 'In corso', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '3 minutes', now() + interval '7 minutes', 'approvato', 'studenti', 'kireo', 'abcdefghijk', 'attivo'),
  ('e0000000-0000-0000-0000-0000000000dd', 'Bozza', 'x', 'webinar', 'aaaaaaaa-0000-0000-0000-000000000001',
   now() + interval '2 days', now() + interval '2 days 1 hour', 'bozza', 'studenti', 'kireo', null, null);

insert into public.eventi_aree (evento_id, area_slug) values
  ('e0000000-0000-0000-0000-0000000000aa', 'informatica-digitale'),
  ('e0000000-0000-0000-0000-0000000000cc', 'informatica-digitale');

insert into public.iscrizioni_eventi (evento_id, student_id, iscritto_da) values
  ('e0000000-0000-0000-0000-0000000000aa', '22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-0000000000aa', '22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-0000000000cc', '22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001');

insert into public.presenze_live (evento_id, user_id, ping_totali) values
  ('e0000000-0000-0000-0000-0000000000aa', '22222222-0000-0000-0000-000000000001', 10),  -- sopra soglia
  ('e0000000-0000-0000-0000-0000000000aa', '22222222-0000-0000-0000-000000000002', 3),   -- sotto
  ('e0000000-0000-0000-0000-0000000000cc', '22222222-0000-0000-0000-000000000001', 10);

-- =================================================================
-- §1 — LA TRACCIA
-- =================================================================

-- 1) Un evento non chiuso ha le tre colonne nulle.
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.eventi
  where id = 'e0000000-0000-0000-0000-0000000000aa'
    and diretta_chiusa_il is null and diretta_chiusa_da_tipo is null and diretta_chiusa_da_user is null;
  insert into esiti values (1, 'evento non chiuso: traccia nulla', '1 riga', v_n || ' righe', v_n = 1);
end $$;

-- 2) L'ente chiude: certifica chi è sopra soglia, e `gia_chiusa_il` è NULL —
--    cioè «è la prima volta».
do $$
declare v_presenti integer; v_cert integer; v_gia timestamptz;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select presenti, certificati, gia_chiusa_il into v_presenti, v_cert, v_gia
    from public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000aa');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (2, 'prima chiusura: 2 presenti, 1 certificato, gia_chiusa_il nullo',
    '2/1/null', format('%s/%s/%s', v_presenti, v_cert, coalesce(v_gia::text, 'null')),
    v_presenti = 2 and v_cert = 1 and v_gia is null);
end $$;

-- 3) …e la traccia è SULL'EVENTO: l'ora, la parte, la persona. È il difetto
--    del 4/10 — prima il messaggio verde viveva solo nel browser di chi aveva
--    premuto, e un F5 lo cancellava.
do $$
declare v_il timestamptz; v_tipo text; v_user uuid;
begin
  select diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_da_user
    into v_il, v_tipo, v_user
  from public.eventi where id = 'e0000000-0000-0000-0000-0000000000aa';
  insert into esiti values (3, 'la traccia è scritta: ora, tipo ente, chi ha premuto',
    'non null/ente/ente-user',
    format('%s/%s/%s', coalesce(v_il::text, 'null'), coalesce(v_tipo, 'null'), coalesce(v_user::text, 'null')),
    v_il is not null and v_tipo = 'ente' and v_user = '11111111-0000-0000-0000-000000000001');
end $$;

-- 4) ⚠️ LA PROPRIETÀ CHE CONTA. La seconda pressione NON dice «0 nuove
--    certificazioni» a secco — che si legge come «nessuno si è qualificato»,
--    cioè un'affermazione FALSA sugli studenti. Porta l'ora della prima.
do $$
declare v_cert integer; v_gia timestamptz; v_prima timestamptz;
begin
  select diretta_chiusa_il into v_prima from public.eventi where id = 'e0000000-0000-0000-0000-0000000000aa';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  select certificati, gia_chiusa_il into v_cert, v_gia
    from public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000aa');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (4, 'seconda pressione: dice QUANDO era già stata chiusa',
    'gia_chiusa_il = la prima ora', coalesce(v_gia::text, 'null'),
    v_gia is not null and v_gia = v_prima);
end $$;

-- 5) …e non certifica niente di nuovo: il conteggio non si muove.
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.iscrizioni_eventi
  where evento_id = 'e0000000-0000-0000-0000-0000000000aa' and certificata_da_tipo = 'sistema';
  insert into esiti values (5, 'seconda pressione: nessuna certificazione nuova', '1', v_n::text, v_n = 1);
end $$;

-- 6) ⚠️ IL CASO DEI DUE MODERATORI: l'ADMIN preme su una diretta che l'ente ha
--    già chiuso. Deve leggere «era già chiusa», e la traccia deve restare
--    quella dell'ente — un'ora e un autore che si riscrivono a ogni pressione
--    direbbero che la diretta è stata chiusa l'ultima volta che qualcuno ha
--    premuto per sbaglio, e attribuirebbero a KIREO un gesto dell'ente.
--
--    (La prima stesura di questa proprietà confrontava `diretta_chiusa_il <
--    now()` ed era ROSSA su codice giusto: dentro una transazione `now()` è
--    COSTANTE, e la traccia è stata scritta con quello stesso `now()`. Che
--    l'ora non si sia mossa lo prova già la 4, che la legge prima e dopo.)
do $$
declare v_gia timestamptz; v_tipo text; v_user uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000003', true);
  select gia_chiusa_il into v_gia
    from public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000aa');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  select diretta_chiusa_da_tipo, diretta_chiusa_da_user into v_tipo, v_user
  from public.eventi where id = 'e0000000-0000-0000-0000-0000000000aa';
  insert into esiti values (6, 'l''admin preme su una diretta già chiusa dall''ente: la traccia resta dell''ente',
    'già chiusa, ente/ente-user',
    format('%s, %s/%s', case when v_gia is null then 'NON dice che era chiusa' else 'già chiusa' end,
           coalesce(v_tipo, 'null'), coalesce(v_user::text, 'null')),
    v_gia is not null and v_tipo = 'ente' and v_user = '11111111-0000-0000-0000-000000000001');
end $$;

-- 7) L'admin chiude un altro evento: la parte è `kireo`, e la persona è lui.
--    Il TIPO si congela invece di dedurlo dal ruolo attuale, come
--    `certificata_da_tipo`.
do $$
declare v_tipo text; v_user uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000003', true);
  perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000cc');
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  select diretta_chiusa_da_tipo, diretta_chiusa_da_user into v_tipo, v_user
  from public.eventi where id = 'e0000000-0000-0000-0000-0000000000cc';
  insert into esiti values (7, 'chiusura dell''admin: tipo kireo, persona l''admin',
    'kireo/admin-user', format('%s/%s', coalesce(v_tipo, 'null'), coalesce(v_user::text, 'null')),
    v_tipo = 'kireo' and v_user = '11111111-0000-0000-0000-000000000003');
end $$;

-- =================================================================
-- §2 — CHI PUÒ CHIUDERE
-- =================================================================

-- 8) Un ente che non è l'organizzatore: `non_autorizzato`.
do $$
declare v_errore text := 'nessuno';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000002', true);
  begin
    perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000bb');
  exception when others then v_errore := sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (8, 'un ente non organizzatore non chiude', 'non_autorizzato', v_errore,
    v_errore = 'non_autorizzato');
end $$;

-- 9) Un anonimo: il PERMESSO è la prima porta, la guardia è la seconda. Se
--    qui si legge `non_autorizzato` il permesso ha ceduto e la revoca va
--    rimessa.
do $$
declare v_errore text := 'nessuno';
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000bb');
  exception
    when insufficient_privilege then v_errore := 'permission denied';
    when others then v_errore := sqlerrm;
  end;
  reset role;
  insert into esiti values (9, 'un anonimo non arriva nemmeno alla guardia', 'permission denied', v_errore,
    v_errore = 'permission denied');
end $$;

-- 10) `evento_ancora_in_corso` resta: non si chiude una diretta che non è
--     ancora finita. ⚠️ È anche la ragione per cui `diretta_chiusa_il` NON è
--     la fine vera della trasmissione, cioè per cui il denominatore resta una
--     domanda aperta.
do $$
declare v_errore text := 'nessuno';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  begin
    perform public.chiudi_diretta_evento('e0000000-0000-0000-0000-0000000000bb');
  exception when others then v_errore := sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (10, 'una diretta ancora in corso non si chiude', 'evento_ancora_in_corso', v_errore,
    v_errore = 'evento_ancora_in_corso');
end $$;

-- =================================================================
-- §3 — L'ENTE NON SI SCRIVE LA TRACCIA DA SÉ
-- =================================================================

-- 11) Sulla propria BOZZA l'ente può scrivere i campi del suo evento, ma non
--     la chiusura: `eventi_update_propria_non_revisionato` verificava DI CHI
--     è la riga e non COSA dice (la specie del 4-5/10).
-- ⚠️ LE DUE CLAUSOLE DI UNA POLICY DI UPDATE RESPINGONO IN DUE MODI DIVERSI, e
-- il 10/10 l'avevamo imparata a metà: «su UPDATE la RLS FILTRA invece di
-- sollevare» è vera della `using` (quali righe si possono toccare: una riga
-- che non passa semplicemente non c'è, zero righe e nessuna eccezione) e FALSA
-- della `with check` (come può essere la riga NUOVA: lì Postgres solleva
-- `new row violates row-level security policy`).
--
-- Qui la `using` passa — è la bozza dell'ente stesso — e a respingere è la
-- `with check`, quindi arriva un'eccezione. Un sondino che contasse solo le
-- righe morirebbe sull'errore senza dire niente; uno che catturasse solo
-- l'eccezione sarebbe verde su una `using` che filtra. Si guardano TUTTE E
-- DUE, e si riporta quale delle due ha respinto: è l'informazione che dice
-- quale clausola sta lavorando.
do $$
declare v_righe integer := -1; v_errore text := 'nessuno';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  begin
    update public.eventi
    set diretta_chiusa_il = now(), diretta_chiusa_da_tipo = 'ente',
        diretta_chiusa_da_user = '11111111-0000-0000-0000-000000000001'
    where id = 'e0000000-0000-0000-0000-0000000000dd';
    get diagnostics v_righe = row_count;
  exception when others then v_errore := sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (11, 'l''ente non si scrive la chiusura sulla propria bozza',
    'respinta (with check o zero righe)',
    case when v_errore <> 'nessuno' then 'with check: ' || v_errore else v_righe || ' righe' end,
    v_errore like '%row-level security%' or v_righe = 0);
end $$;

-- 12) …e un update LEGITTIMO sulla stessa bozza passa ancora. È la metà che
--     la cura poteva rompere: una clausola in più nel `with check` chiude
--     tutto se è scritta male.
do $$
declare v_righe integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-000000000001', true);
  update public.eventi set titolo = 'Bozza rinominata'
  where id = 'e0000000-0000-0000-0000-0000000000dd';
  get diagnostics v_righe = row_count;
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  insert into esiti values (12, 'l''ente modifica ancora la propria bozza', '1 riga', v_righe || ' righe', v_righe = 1);
end $$;

-- 13) Il CHECK rifiuta una parte inventata: `kireo` o `ente`, non altro.
do $$
declare v_errore text := 'nessuno';
begin
  begin
    update public.eventi
    set diretta_chiusa_il = now(), diretta_chiusa_da_tipo = 'scuola',
        diretta_chiusa_da_user = '11111111-0000-0000-0000-000000000001'
    where id = 'e0000000-0000-0000-0000-0000000000bb';
  exception when check_violation then v_errore := 'check_violation';
    when others then v_errore := sqlerrm;
  end;
  insert into esiti values (13, 'una parte inventata viene rifiutata', 'check_violation', v_errore,
    v_errore = 'check_violation');
end $$;

-- 14) …e una traccia A METÀ pure: l'ora senza l'autore non risponde alla
--     domanda per cui la traccia esiste.
do $$
declare v_errore text := 'nessuno';
begin
  begin
    update public.eventi set diretta_chiusa_il = now()
    where id = 'e0000000-0000-0000-0000-0000000000bb';
  exception when check_violation then v_errore := 'check_violation';
    when others then v_errore := sqlerrm;
  end;
  insert into esiti values (14, 'una traccia a metà viene rifiutata', 'check_violation', v_errore,
    v_errore = 'check_violation');
end $$;

-- =================================================================
-- §4 — NESSUNA REGRESSIONE (il corpo è stato riscritto)
-- =================================================================

-- 15) La prova della presenza nel profilo si scrive ancora (§2 del 4/10):
--     fonte `presenza`, dimensione `curiosity`, peso 0,5.
do $$
declare v_n integer; v_valore numeric;
begin
  select count(*), max(valore) into v_n, v_valore from public.evidence
  where evento_id = 'e0000000-0000-0000-0000-0000000000aa'
    and student_id = '22222222-0000-0000-0000-000000000001'
    and fonte = 'presenza' and dimensione = 'curiosity' and peso = 0.5;
  insert into esiti values (15, 'la presenza entra ancora nel profilo', '1 prova, valore 1',
    format('%s prove, valore %s', v_n, coalesce(v_valore::text, 'null')), v_n = 1 and v_valore = 1);
end $$;

-- 16) …e il credito di esplorazione in `activity_log` pure.
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.activity_log
  where student_id = '22222222-0000-0000-0000-000000000001'
    and tipo_attivita = 'partecipazione_webinar' and area_slug = 'informatica-digitale';
  insert into esiti values (16, 'il credito di esplorazione si scrive ancora', '1 riga', v_n || ' righe', v_n = 1);
end $$;

-- 17) …e chi è SOTTO soglia resta non certificato, come prima.
do $$
declare v_tipo text;
begin
  select certificata_da_tipo into v_tipo from public.iscrizioni_eventi
  where evento_id = 'e0000000-0000-0000-0000-0000000000aa' and student_id = '22222222-0000-0000-0000-000000000002';
  insert into esiti values (17, 'sotto soglia: non certificato', 'null', coalesce(v_tipo, 'null'), v_tipo is null);
end $$;

-- ---------------------------------------------------------------- esito
select n, cosa, atteso, trovato,
       case when coalesce(ok, false) then 'ok' else 'ROTTA' end as esito
from esiti order by n;

select count(*) filter (where coalesce(ok, false)) || '/' || count(*) as verificate,
       count(*) filter (where not coalesce(ok, false)) as rotte
from esiti;

rollback;
