-- Le 27 SECURITY DEFINER che scrivono e nascevano aperte: chiuse a chi non è nessuno.
--
-- DA APPLICARE DOPO `20260926100000_tetto_workshop.sql` — una cosa per volta
-- nell'SQL Editor. Non c'è una dipendenza tecnica fra le due, solo l'ordine.
--
-- PERCHÉ ESISTE. Su Supabase i default privileges danno EXECUTE a PUBLIC,
-- `anon` e `authenticated` su ogni funzione nuova dello schema `public`:
-- «non l'ho concessa a nessuno» non è una frase vera qui dentro. Finché una
-- riga non dice il contrario, una SECURITY DEFINER — che gira come
-- proprietario, quindi fuori dalla RLS — è chiamabile anche da chi non è
-- collegato. [verificato da Mario sul DB live il 19/09 su `registra_guasto`, e
-- su Postgres 16 il 26/09: `revoke … from public` da solo lascia i due ruoli,
-- `revoke … from anon` da solo lascia PUBLIC, e `create or replace` non tocca
-- i privilegi]
--
-- NESSUNA DI QUESTE È UN BUCO VIVO: tutte hanno una guardia che con un
-- `auth.uid()` NULL fallisce chiuso, ed è `npm run test:guardie` a pretenderlo.
-- Il motivo della migrazione non è il rischio di oggi — è che la classe non
-- aveva una regola leggibile: su nove il `revoke` c'era, su ventisette no, e la
-- prossima persona doveva indovinare se fosse una dimenticanza o una scelta.
-- Quando una classe non ha una regola, la decisione la prende ogni volta
-- l'ultimo che passa.
--
-- LA CONDIZIONE, verificata per tutte e 27 prima di scrivere queste righe:
-- ognuna ha già un `grant execute … to authenticated` ESPLICITO nella propria
-- migrazione, quindi togliere PUBLIC non le lascia senza strada. Era la cosa da
-- guardare per prima: una funzione che perde l'unica strada che aveva non
-- fallisce chiusa — fallisce e basta, su un utente vero. Da oggi lo pretende
-- anche il controllo, che su una funzione aperta senza grant esplicito dice che
-- il `revoke` va scritto insieme al `grant`, nella stessa migrazione.
--
-- COSA NON CAMBIA: `authenticated` conserva l'EXECUTE su tutte. Nessuna
-- chiamata del prodotto passa da `anon` su queste funzioni — ognuna comincia
-- guardando `auth.uid()`, che per un anonimo è NULL. Nessun dato trasformato,
-- nessuna funzione ridefinita, nessuna policy toccata.
--
-- PERCHÉ 27 RIGHE LETTERALI E NON UN CICLO SU `pg_proc`. Un ciclo sarebbe più
-- corto e più robusto sulle firme, ma `npm run test:guardie` LEGGE le righe
-- delle migrazioni, non le esegue: una revoca dentro un `execute format` è
-- invisibile al controllo, e il controllo continuerebbe a dire «27 aperte»
-- mentre il database le ha chiuse. Uno strumento che non vede la cura è
-- peggio di una cura più lunga da scrivere.
--
-- E LE DUE COSE CHE UN ELENCO LETTERALE NON SA FARE le fanno i due blocchi
-- attorno: il PREFLIGHT nomina in un colpo solo tutte le funzioni che in questo
-- database non esistono (senza, si scoprirebbero una alla volta, un errore per
-- rilancio), e la VERIFICA in coda rilegge i permessi veri — se una firma
-- orfana di una ridefinizione vecchia fosse rimasta aperta, una riga scritta a
-- mano l'avrebbe lasciata così proprio mentre dichiarava di aver chiuso.
-- Questo file si può rilanciare quante volte serve: una revoca è idempotente.

-- ── preflight ───────────────────────────────────────────────────────────────
do $$
declare
  v_assenti text[];
begin
  select array_agg(n order by n) into v_assenti
    from unnest(array[
      'delete_own_account', 'redeem_class_code', 'verifica_studente',
      'finalize_registration_scuola', 'redeem_invito_staff', 'iscrivi_classe_evento',
      'iscrivi_studenti_evento', 'certifica_presenza', 'metti_in_evidenza_evento',
      'certifica_partecipazione_docente', 'ping_presenza_live',
      'aggiorna_stato_domanda_live', 'chiudi_diretta_evento', 'apri_conversazione_ente',
      'invia_messaggio_ente', 'blocca_conversazione_studente', 'chiudi_conversazione_admin',
      'segna_messaggio_letto', 'crea_proposta_incontro', 'ritira_proposta_incontro',
      'invia_messaggio_chat_cliente', 'invia_risposta_cliente_workshop',
      'invia_messaggio_rete_workshop', 'ritira_iscrizione_workshop',
      'consegna_progetto_workshop', 'inizializza_fasi_workshop', 'consegna_fase_workshop'
    ]) as n
   where not exists (
     select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = n
   );

  if v_assenti is not null then
    raise exception
      'In questo database non esistono: %. Applica prima le migrazioni che le creano, poi rilancia questo file.',
      array_to_string(v_assenti, ', ');
  end if;
end $$;

-- ── area studente ───────────────────────────────────────────────────────────
revoke all on function public.delete_own_account() from public, anon;
revoke all on function public.redeem_class_code(text) from public, anon;

-- ── area scuola ─────────────────────────────────────────────────────────────
revoke all on function public.verifica_studente(uuid, public.stato_verifica_studente) from public, anon;
revoke all on function public.finalize_registration_scuola(text, text, text) from public, anon;
revoke all on function public.redeem_invito_staff(text, text, text) from public, anon;
revoke all on function public.iscrivi_classe_evento(uuid, uuid, public.iscrizione_classe_modalita) from public, anon;
revoke all on function public.iscrivi_studenti_evento(uuid, uuid[]) from public, anon;
revoke all on function public.certifica_presenza(uuid, uuid) from public, anon;

-- ── area ente e docenti ─────────────────────────────────────────────────────
revoke all on function public.metti_in_evidenza_evento(uuid) from public, anon;
revoke all on function public.certifica_partecipazione_docente(uuid, uuid) from public, anon;

-- ── diretta webinar ─────────────────────────────────────────────────────────
revoke all on function public.ping_presenza_live(uuid) from public, anon;
revoke all on function public.aggiorna_stato_domanda_live(uuid, text) from public, anon;
revoke all on function public.chiudi_diretta_evento(uuid) from public, anon;

-- ── livello social: messaggi studente↔ente ──────────────────────────────────
revoke all on function public.apri_conversazione_ente(uuid, text) from public, anon;
revoke all on function public.invia_messaggio_ente(uuid, text) from public, anon;
revoke all on function public.blocca_conversazione_studente(uuid) from public, anon;
revoke all on function public.chiudi_conversazione_admin(uuid) from public, anon;
revoke all on function public.segna_messaggio_letto(uuid) from public, anon;

-- ── proposte di incontro scuola→ente ────────────────────────────────────────
revoke all on function public.crea_proposta_incontro(uuid, text[], text, integer, text, text) from public, anon;
revoke all on function public.ritira_proposta_incontro(uuid) from public, anon;

-- ── workshop ────────────────────────────────────────────────────────────────
revoke all on function public.invia_messaggio_chat_cliente(uuid, text) from public, anon;
revoke all on function public.invia_risposta_cliente_workshop(uuid, text) from public, anon;
revoke all on function public.invia_messaggio_rete_workshop(uuid, uuid, text) from public, anon;
revoke all on function public.ritira_iscrizione_workshop(uuid) from public, anon;
revoke all on function public.consegna_progetto_workshop(uuid, jsonb) from public, anon;
revoke all on function public.inizializza_fasi_workshop(uuid, text[]) from public, anon;
revoke all on function public.consegna_fase_workshop(uuid, text, integer) from public, anon;

-- ── verifica, nello stesso file ─────────────────────────────────────────────
-- Un `raise notice` si perde fra gli altri messaggi dell'SQL Editor; un errore
-- no. E la domanda non è «le righe sono state eseguite» ma «adesso chi può
-- chiamarle»: la risposta la dà il database, non l'elenco qui sopra.
do $$
declare
  v_aperte text;
  v_senza_auth text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into v_aperte
    from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and p.prosecdef
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('public', p.oid, 'execute'))
     and p.proname = any (array[
       'delete_own_account', 'redeem_class_code', 'verifica_studente',
       'finalize_registration_scuola', 'redeem_invito_staff', 'iscrivi_classe_evento',
       'iscrivi_studenti_evento', 'certifica_presenza', 'metti_in_evidenza_evento',
       'certifica_partecipazione_docente', 'ping_presenza_live',
       'aggiorna_stato_domanda_live', 'chiudi_diretta_evento', 'apri_conversazione_ente',
       'invia_messaggio_ente', 'blocca_conversazione_studente', 'chiudi_conversazione_admin',
       'segna_messaggio_letto', 'crea_proposta_incontro', 'ritira_proposta_incontro',
       'invia_messaggio_chat_cliente', 'invia_risposta_cliente_workshop',
       'invia_messaggio_rete_workshop', 'ritira_iscrizione_workshop',
       'consegna_progetto_workshop', 'inizializza_fasi_workshop', 'consegna_fase_workshop'
     ]);

  if v_aperte is not null then
    raise exception 'Restano raggiungibili da chi non è collegato: %', v_aperte;
  end if;

  -- E la metà opposta: una revoca che avesse portato via anche la strada di
  -- `authenticated` romperebbe un utente vero, in silenzio, alla prima chiamata.
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into v_senza_auth
    from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and not has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname = any (array[
       'delete_own_account', 'redeem_class_code', 'verifica_studente',
       'finalize_registration_scuola', 'redeem_invito_staff', 'iscrivi_classe_evento',
       'iscrivi_studenti_evento', 'certifica_presenza', 'metti_in_evidenza_evento',
       'certifica_partecipazione_docente', 'ping_presenza_live',
       'aggiorna_stato_domanda_live', 'chiudi_diretta_evento', 'apri_conversazione_ente',
       'invia_messaggio_ente', 'blocca_conversazione_studente', 'chiudi_conversazione_admin',
       'segna_messaggio_letto', 'crea_proposta_incontro', 'ritira_proposta_incontro',
       'invia_messaggio_chat_cliente', 'invia_risposta_cliente_workshop',
       'invia_messaggio_rete_workshop', 'ritira_iscrizione_workshop',
       'consegna_progetto_workshop', 'inizializza_fasi_workshop', 'consegna_fase_workshop'
     ]);

  if v_senza_auth is not null then
    raise exception 'Hanno perso la strada di authenticated: %', v_senza_auth;
  end if;

  raise notice 'Tutte e 27 chiuse a public e anon, e authenticated le chiama ancora.';
end $$;
