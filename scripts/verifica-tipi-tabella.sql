-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║ I TIPI DICHIARATI DA UNA `RETURNS TABLE` COMBACIANO CON QUELLO CHE LA  ║
-- ║ QUERY PRODUCE DAVVERO.                                                 ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- IL DIFETTO DA CUI NASCE (11/10/2026, trovato in produzione da Mario al primo
-- giro a schermo su /diretta/[id], e rotto dal 26 LUGLIO):
--
--     Errore esporta_presenze_admin: structure of query does not match
--     function result type
--
-- `esporta_presenze_admin` dichiara `email text` e seleziona `u.email`, che in
-- Supabase è `character varying(255)`. In PL/pgSQL il confronto fra i tipi della
-- query e quelli del `returns table (...)` è STRETTO: non ammette nemmeno la
-- conversione varchar → text, che in una funzione `language sql` passa senza che
-- nessuno se ne accorga. Nessun CSV è mai uscito da quella route.
--
-- ⚠️⚠️ PERCHÉ 19 PROPRIETÀ SQL ERANO VERDI SU UNA FUNZIONE ROTTA, e la risposta
-- NON è quella che sembrava. L'ipotesi era «Postgres confronta quando una riga
-- esce; la replica è vuota, quindi niente righe e niente confronto» — cioè il
-- modo 2 dei tredici, sotto un'intera suite. **Misurato, ed è falsa**: il
-- controllo scatta all'esecuzione del `return query`, e con ZERO righe solleva
-- identico.
--
-- La ragione vera è il modo 4: **la replica mostrava un sistema diverso.** Lo
-- shim dichiarava `auth.users.email` come `text`, quindi su quella replica la
-- funzione era CORRETTA. Non un buco di una prova: un ambiente in cui il
-- difetto non esisteva.
--
-- QUINDI LE DUE METÀ, e nessuna basta da sola:
--   1. lo shim porta i TIPI DI PRODUZIONE (fatto: `scripts/replica-shim.sql`);
--   2. qualcuno CHIAMA la funzione — ed è questo file.
--
-- E la riga seminata, che era la proposta, non serve: basta la chiamata. Questo
-- file non inserisce NESSUN dato di prova oltre alle identità che servono a
-- passare le guardie, e passa un uuid inesistente: la query torna vuota, il
-- confronto scatta uguale.
--
-- ─────────────────────────────────── perché l'elenco non è scritto a mano
-- Le funzioni si enumerano da `pg_proc`. Una `RETURNS TABLE` nuova entra in
-- questa prova da sé, senza che nessuno si ricordi di aggiungerla — ed è il
-- punto, perché il difetto del 26/07 è vissuto tre mesi esattamente in una
-- funzione che nessuna prova chiamava (SEI su dodici, al 11/10).
--
-- ─────────────────────────────────── tre esiti, e il terzo non è un verde
--   ✗ ROTTA          → 42804: il difetto, in produzione, adesso.
--   ✓ pulita         → la chiamata è arrivata al `return query` e i tipi tornano.
--   ⚠ non raggiunta  → ogni identità è stata respinta dalla guardia prima del
--                      `return query`. NON si sa niente di quei tipi, e si
--                      dichiara invece di contarlo buono (`zero ≠ non ho
--                      guardato`). Il conto delle non raggiunte è l'unica cosa
--                      che resta da chiudere.
--
-- ⚠️ IL LIMITE, dichiarato: se una funzione con un argomento inesistente
-- tornasse PRIMA del `return query` (un `if ... then return; end if;`), qui
-- risulterebbe pulita senza essere stata controllata. Per questo gli argomenti
-- non sono `null` ma valori plausibili (un uuid casuale), che percorrono la
-- strada normale e non un ramo di uscita.
--
-- ─────────────────────────────────── come si lancia
-- Si incolla nel SQL Editor di Supabase (gira in una transazione con ROLLBACK e
-- non lascia niente), oppure:
--   psql -h /tmp/pgk -U postgres -d postgres -f scripts/verifica-tipi-tabella.sql
--
-- ⚠️ SULLA REPLICA VALE SOLO SE LO SHIM PORTA I TIPI DI PRODUZIONE. Su un
-- database vero non c'è niente da sapere: i tipi sono quelli.

begin;

create temporary table esiti (
  n serial,
  funzione text,
  esito text,
  identita text,
  dettaglio text
) on commit drop;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ente uuid := gen_random_uuid();
  v_studente uuid := gen_random_uuid();
  v_istituzione uuid;
  v_scuola_profilo uuid;
  v_scuola text;
  v_evento uuid;
  v_workshop uuid;
  v_ruolo uuid;
  v_convenzione uuid;
  v_fn record;
  v_args text;
  v_identita record;
  v_sql text;
  v_esito text;
  v_chi text;
  v_dettaglio text;
  v_enumerate integer;
begin
  -- ============ le quattro identità, e nient'altro ============
  -- Solo quello che serve a passare le guardie: nessuna riga di dati, nessun
  -- evento, nessuna presenza. Il confronto dei tipi non ne ha bisogno.
  insert into auth.users (id, email) values
    (v_admin, 'admin@prova.invalid'),
    (v_staff, 'staff@prova.invalid'),
    (v_ente, 'ente@prova.invalid'),
    (v_studente, 'studente@prova.invalid');

  insert into public.profiles (id, ruolo, nome, cognome, data_nascita, di_prova) values
    (v_admin, 'admin', 'Prova', 'Admin', '1980-01-01', true),
    (v_staff, 'referente_scuola', 'Prova', 'Referente', '1980-01-01', true),
    (v_ente, 'istituzione', 'Prova', 'Ente', '1980-01-01', true),
    (v_studente, 'studente', 'Prova', 'Studente', '2008-01-01', true);

  -- staff: serve una scuola del dataset, un profilo scuola e una riga di staff
  -- con il permesso che `esporta_presenze_scuola` pretende.
  select codice_meccanografico into v_scuola from public.schools limit 1;
  if v_scuola is null then
    insert into public.schools (codice_meccanografico, denominazione, provincia, tipo_istituto)
      values ('XX00000000', 'Scuola di prova', 'Roma', 'Liceo')
      returning codice_meccanografico into v_scuola;
  end if;
  insert into public.scuole_profili (scuola_id, stato) values (v_scuola, 'attiva')
    returning id into v_scuola_profilo;
  insert into public.school_staff (user_id, scuola_profilo_id, ruolo_staff, attivo, puo_certificare_presenze, creato_da)
    values (v_staff, v_scuola_profilo, 'referente', true, true, v_admin);

  -- ente: il collegamento utente↔istituzione da cui legge current_istituzione_id()
  insert into public.istituzioni (nome, stato) values ('Ente di prova', 'attiva')
    returning id into v_istituzione;
  insert into public.institution_profiles (user_id, istituzione_id) values (v_ente, v_istituzione);

  -- ============ le tre chiavi che aprono le guardie «a oggetto» ============
  -- Tre funzioni non si raggiungono con un uuid casuale, perché la loro guardia
  -- cerca un OGGETTO e non un ruolo: un evento, un'iscrizione, un codice. Senza
  -- queste tre righe restano «non raggiunte» — cioè un «non ho guardato» — e DUE
  -- DI LORO NON LE CHIAMA NESSUN'ALTRA PROVA (`peers_workshop`,
  -- `redeem_class_code`), mentre girano in produzione a ogni pagina di workshop
  -- e a ogni registrazione con codice classe.
  insert into public.eventi (titolo, tipo, organizzatore_id, data_inizio, data_fine, stato)
    values ('Diretta di prova', 'webinar', v_istituzione,
            now() - interval '2 days', now() - interval '2 days' + interval '5 minutes', 'approvato')
    returning id into v_evento;

  select w.id, r.id into v_workshop, v_ruolo
  from public.workshop w join public.workshop_ruoli r on r.workshop_id = w.id limit 1;
  if v_workshop is not null then
    insert into public.workshop_iscrizioni (workshop_id, student_id, ruolo_id, stato)
      values (v_workshop, v_studente, v_ruolo, 'attivo');
  end if;

  insert into public.conventions (school_code, stato) values (v_scuola, 'attiva')
    returning id into v_convenzione;
  insert into public.class_codes (codice, convention_id, classe, attivo, max_usi, usi_correnti)
    values ('KIREO-ZZ99', v_convenzione, '5ª Z', true, 10, 0);

  -- ============ l'enumerazione, da pg_proc ============
  select count(*) into v_enumerate
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public' and l.lanname = 'plpgsql'
    and pg_get_function_result(p.oid) like 'TABLE(%';

  insert into esiti (funzione, esito, identita, dettaglio)
    values ('(enumerazione)', 'nota', '-', v_enumerate || ' funzioni plpgsql con RETURNS TABLE trovate in pg_proc');

  for v_fn in
    select p.oid, p.proname, p.proargtypes
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and l.lanname = 'plpgsql'
      and pg_get_function_result(p.oid) like 'TABLE(%'
    order by p.proname
  loop
    -- ⚠️ L'ELENCO DELLE CHIAVI NON PUÒ NASCONDERE NIENTE, ed è la ragione per
    -- cui è scritto a mano senza violare la regola di casa: una funzione che
    -- non è qui dentro viene enumerata COMUNQUE e riceve l'argomento generico;
    -- se la sua guardia la respinge compare fra le «non raggiunte». Questa
    -- tabella può solo ALZARE la copertura, mai abbassarla in silenzio.
    v_args := case v_fn.proname
      when 'chiudi_diretta_evento' then quote_literal(v_evento) || '::uuid'
      when 'peers_workshop' then quote_literal(v_workshop) || '::uuid'
      when 'redeem_class_code' then quote_literal('KIREO-ZZ99')
      else null
    end;

    -- Argomenti plausibili e non `null`: vedi il limite dichiarato in testa.
    select coalesce(v_args, coalesce(string_agg(
      case t::regtype::text
        when 'uuid' then 'gen_random_uuid()'
        when 'uuid[]' then 'array[gen_random_uuid()]'
        when 'text' then '''zzz'''
        when 'text[]' then 'array[''zzz'']'
        when 'integer' then '1'
        when 'boolean' then 'false'
        else 'null::' || t::regtype::text
      end, ', ' order by i), ''))
    into v_args
    from unnest(v_fn.proargtypes) with ordinality as a(t, i);

    v_sql := format('select count(*) from public.%I(%s)', v_fn.proname, v_args);
    v_esito := 'non raggiunta';
    v_chi := '-';
    v_dettaglio := null;

    for v_identita in
      select * from (values
        ('admin', v_admin), ('staff', v_staff), ('ente', v_ente), ('studente', v_studente)
      ) as x(etichetta, id)
    loop
      begin
        perform set_config('request.jwt.claim.sub', v_identita.id::text, true);
        execute v_sql;
        -- Nessuna eccezione: siamo arrivati al `return query` e i tipi tornano.
        v_esito := 'pulita';
        v_chi := v_identita.etichetta;
        exit;
      exception
        when sqlstate '42804' then
          v_esito := 'ROTTA';
          v_chi := v_identita.etichetta;
          v_dettaglio := sqlerrm;
          exit;
        when others then
          -- Una guardia che respinge (`non_autorizzato`) o un altro errore che
          -- non è un disallineamento di tipi: si prova l'identità dopo.
          if v_dettaglio is null then v_dettaglio := sqlerrm; end if;
      end;
    end loop;

    insert into esiti (funzione, esito, identita, dettaglio)
      values (v_fn.proname, v_esito, v_chi, v_dettaglio);
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
end $$;

\echo ''
\echo '════════ I TIPI DICHIARATI CONTRO QUELLO CHE LA QUERY PRODUCE ════════'
\echo ''

select
  case esito when 'ROTTA' then '✗' when 'pulita' then '✓' when 'nota' then ' ' else '⚠' end as " ",
  funzione,
  esito,
  identita as "passata con",
  left(coalesce(dettaglio, ''), 90) as "dettaglio / perché non raggiunta"
from esiti
order by case esito when 'nota' then 0 when 'ROTTA' then 1 when 'non raggiunta' then 2 else 3 end, funzione;

\echo ''
-- ⚠️ LA SOGLIA DICHIARATA: se l'enumerazione da pg_proc tornasse vuota o
-- quasi, ogni riga qui sopra sarebbe verde per un insieme vuoto — il modo 2.
-- Al 11/10/2026 le funzioni plpgsql con RETURNS TABLE sono DODICI: sotto le
-- dieci è l'enumeratore a doversi spiegare, non il prodotto.
select
  (select count(*) from esiti where esito = 'ROTTA') as rotte,
  (select count(*) from esiti where esito = 'non raggiunta') as "non raggiunte",
  (select count(*) from esiti where esito = 'pulita') as pulite,
  (select count(*) from esiti where esito <> 'nota') as enumerate,
  case
    when (select count(*) from esiti where esito <> 'nota') < 10
      then '⚠ SOTTO SOGLIA: l''enumerazione da pg_proc non sta leggendo — nessuna riga qui sopra vuol dire niente'
    when (select count(*) from esiti where esito = 'ROTTA') > 0
      then '✗ ROTTE: una funzione solleva 42804. In produzione quella chiamata non restituisce niente a nessuno.'
    when (select count(*) from esiti where esito = 'non raggiunta') > 0
      then '✓ nessuna rotta fra quelle raggiunte — ma le «non raggiunte» restano un «non ho guardato», non un verde'
    else '✓ tutte raggiunte e tutte pulite'
  end as esito;

rollback;
