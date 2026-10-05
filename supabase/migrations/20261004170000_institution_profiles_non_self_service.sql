-- ⚠️ UNO STUDENTE QUALUNQUE PUÒ DIVENTARE UN ENTE. Verificato per esecuzione su
-- una replica con tutte le migrazioni, non leggendo le policy.
--
-- LA CATENA, due scritture dalla porta normale del client:
--
--   1. `update profiles set ruolo = 'istituzione' where id = auth.uid()`
--      Passa: `profiles_update_own` è `with check (id = auth.uid() and ruolo <>
--      'admin')`. Il ruolo `istituzione` è self-service DI PROPOSITO
--      (20260713110000: «il signup di un ente crea comunque un profilo con quel
--      ruolo, solo l'attivazione è manuale»), e `referente_scuola` lo è
--      diventato il 15/07 con una ragione scritta: «il ruolo da solo non apre
--      nessuna porta».
--
--   2. `insert into institution_profiles (user_id, istituzione_id)
--       values (auth.uid(), '<id di un ente qualunque>')`
--      Passa: `institution_profiles_insert_own` è `with check (user_id =
--      auth.uid())`. Il trigger `check_ruolo_istituzione` chiede solo che il
--      ruolo sia `istituzione` — che il passo 1 ha appena dato.
--
-- E da quel momento `current_istituzione_id()` restituisce QUELL'ENTE, perché
-- legge esattamente questa tabella. Si fidano di lei **29 policy su 15 tabelle
-- e 14 funzioni** (attestati, chiavi_trasmissione, comunicazioni,
-- conversazioni_enti, eventi, eventi_aree, guide_enti, iscrizioni_eventi,
-- istituzioni, istituzioni_aree, messaggi_enti, post_enti, profiles,
-- proposte_incontro, richieste_upgrade).
--
-- MISURATO, non dedotto: con quelle due scritture si leggono **nome e cognome
-- degli studenti che hanno manifestato interesse** a quell'ente
-- (`manifestazioni_dettaglio_ente`), si legge **la chiave di trasmissione**
-- della sua diretta, e si pubblica **un post a suo nome**.
--
-- LA SPECIE, nelle parole di Mario: una policy che autorizza una scrittura
-- guardando **di chi è la riga** invece di **cosa dice la riga**. `user_id =
-- auth.uid()` verifica che la riga sia mia; non verifica **di quale ente**.
--
-- E LA RAGIONE PER CUI NESSUNO L'HA VISTA È CHE LE DUE DECISIONI SONO SICURE
-- UNA PER UNA. «Il ruolo da solo non apre nessuna porta» è vero per la scuola
-- (ogni policy dell'area scuola controlla `school_staff.attivo`, e inserire una
-- riga in `school_staff` richiede un referente già esistente: circolare, e
-- chiusa). Per l'ente non è vero: il ruolo apre il trigger, e la policy lascia
-- scegliere quale ente. Sono due decisioni prese in due giorni diversi, ognuna
-- con la sua ragione, e il cardine è la terza cosa che nessuna delle due
-- nominava.
--
-- ══════════════════════════════ LA CURA ══════════════════════════════
--
-- Nessun codice dell'app scrive `institution_profiles` dal client [verificato
-- su app/, components/, lib/: l'unica occorrenza è una `select` in
-- lib/ente/context.ts]. Gli unici scrittori sono le due versioni di
-- `finalize_registration_istituzione`. Quindi la policy di insert ha **zero
-- utenti legittimi** e apre tutta l'area ente: va via, come per
-- `evidence`/`area_signal`/`presenze_live`, che non hanno nessuna policy di
-- scrittura e la cui unica strada è una funzione.
--
-- MA NON BASTA TOGLIERLA, e qui sta il lavoro: la funzione è SECURITY INVOKER
-- [verificato su pg_proc], quindi la sua `insert` passa dalla RLS come
-- qualunque client — togliere la policy romperebbe la registrazione di ogni
-- nuovo ente. La funzione passa a SECURITY DEFINER, che è la scelta già fatta
-- il 15/07 per la gemella della scuola (`finalize_registration_scuola`) con
-- questa ragione scritta: «qui la scelta preventiva evita lo stesso problema
-- chicken-and-egg». La stessa decisione, per lo stesso motivo, applicata al
-- lato che l'aveva schivata con una correzione minimale fatta a mano sotto
-- pressione il 13/07 (vedi 20260713190000).
--
-- IL CORPO E LA FIRMA NON CAMBIANO DI UNA RIGA. Sono ripresi tale e quale da
-- 20260713190000_fix_finalize_registration_istituzione.sql, e il diff fra i due
-- file dice **una riga sola**: `security definer` al posto di `security
-- invoker` (il `set search_path = public` c'era già). La firma in particolare
-- NON si tocca: sei parametri posizionali in quell'ordine esatto — cambiarne
-- uno creerebbe un secondo overload invece di sostituire la funzione (è la
-- lezione di `finalize_registration` in Fase 2, dove un parametro aggiunto con
-- `create or replace` lasciò due funzioni vive) e romperebbe la chiamata del
-- client.
--
-- ⚠️ E LA PRIMA STESURA DI QUESTA MIGRAZIONE LA FIRMA L'AVEVA RISCRITTA A
-- MEMORIA — parametri in un altro ordine, uno in più, e una `public.slugify()`
-- che in questo database non esiste. L'ha trovata il diff contro il file del
-- 13/07, non una rilettura. Chi toccherà di nuovo questa funzione: il corpo si
-- COPIA e si confronta, non si ricorda.
--
-- ══════ IL CONFRONTO COL CORPO VIVO È STATO FATTO, E IL CORPO È LO STESSO ══════
--
-- Il 5/10, prima di applicare: la versione viva fu applicata A MANO il 13/07 e
-- il file del repo fu allineato DOPO — quindi nessuno aveva mai confrontato le
-- due, ed è il caso esatto per cui la disciplina dell'impronta esiste.
-- L'impronta grezza divergeva, e la differenza era UN BLOCCO DI COMMENTI:
--
--   corpo del repo (1514 car.)             → f8ecb7c9f7fc979166f93da392e34d38
--   lo stesso senza le 4 righe di commento → 656ab88cf04268cc07211b187bb6110b
--                                             ↑ ESATTAMENTE la produzione
--   forma canonica, da tutte e due         → c373ee1a6a89c5d1beaf92c63518a210
--
-- Verificato riproducendo il calcolo sul corpo vivo della replica: lo spoglio
-- che restituisce il valore di produzione mangia anche il newline delle righe
-- di commento (4 righe → 4 caratteri in meno di uno spoglio che lascia la riga
-- vuota). Quindi il codice è IDENTICO carattere per carattere e questa
-- sostituzione non perde niente: cambia una riga (`security definer`) e rimette
-- i commenti che il repo ha e la produzione non aveva.
--
-- L'impronta canonica la calcola `scripts/impronta-funzione.sql`, che è nato da
-- qui: `md5(prosrc)` legge anche l'impaginazione, quindi una sua divergenza non
-- vuol dire «il codice è diverso» — e un controllo che grida su una cosa giusta
-- è un controllo che la terza volta nessuno guarda più.
--
-- Resta la guardia `if v_uid is null then raise`, che era già lì dal 13/07 ma
-- da oggi fa un altro mestiere: in un DEFINER è l'unica cosa fra una chiamata
-- senza identità e la creazione di un ente.
--
-- E NON SI AGGIUNGE NESSUN PARAMETRO: la funzione ricava sempre l'utente da
-- `auth.uid()`, mai da un argomento. Un `p_user_id` su una DEFINER vorrebbe
-- dire poter creare un ente intestato a chiunque.
--
-- COSA NON CHIUDE. Il ruolo `istituzione` resta self-service: non è questo il
-- posto per cambiarlo, e dopo questa migrazione non apre più niente — un
-- profilo con quel ruolo e senza riga in `institution_profiles` ha
-- `current_istituzione_id()` NULL, e tutte e 29 le policy falliscono chiuse.

-- ─────────────────── 1) la porta: nessuna scrittura dal client
drop policy if exists institution_profiles_insert_own on public.institution_profiles;

-- La lettura resta: `lib/ente/context.ts` legge la propria riga per sapere di
-- quale ente fa parte, e `institution_profiles_select_own` è `user_id =
-- auth.uid()` — quella guarda di chi è la riga, ed è la domanda giusta per una
-- lettura della propria riga.

-- ─────────────────── 2) l'unico scrittore, che ora non ha bisogno della policy
create or replace function public.finalize_registration_istituzione(
  p_nome_ente text,
  p_slug text,
  p_tipo public.istituzione_tipo,
  p_referente_nome text,
  p_referente_cognome text,
  p_sito_ufficiale text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_istituzione_id uuid;
  v_piano_free_id uuid;
  v_slug_base text;
  v_slug text;
  v_tentativo integer := 1;
begin
  -- LA GUARDIA CHE IN UN DEFINER FA TUTTO IL LAVORO: senza di lei una chiamata
  -- senza identità creerebbe un ente senza nessuno a cui intestarlo. Era qui
  -- dal 13/07 e non è stata aggiunta per questa migrazione — ma da oggi è
  -- l'unica cosa che sta fra una connessione anonima e la creazione di un ente.
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    return; -- già finalizzato (es. link email aperto due volte)
  end if;

  select id into v_piano_free_id from public.piani where nome = 'free';

  -- Slug mai null: se manca o è vuoto dopo il trim (non dovrebbe succedere,
  -- generaSlug lato client parte sempre da un nome ente obbligatorio, ma la
  -- funzione non deve comunque poter scrivere una riga con slug nullo)
  -- ricade su un prefisso fisso, poi comunque reso univoco sotto.
  v_slug_base := nullif(trim(coalesce(p_slug, '')), '');
  if v_slug_base is null then
    v_slug_base := 'ente';
  end if;

  v_slug := v_slug_base;
  while public.slug_istituzione_in_uso(v_slug) loop
    v_tentativo := v_tentativo + 1;
    v_slug := v_slug_base || '-' || v_tentativo;
  end loop;

  v_istituzione_id := gen_random_uuid();

  insert into public.istituzioni (id, nome, slug, tipo, sito_ufficiale, piano_id, stato)
  values (v_istituzione_id, p_nome_ente, v_slug, p_tipo, p_sito_ufficiale, v_piano_free_id, 'in_attesa');

  insert into public.profiles (id, ruolo, nome, cognome)
  values (v_uid, 'istituzione', p_referente_nome, p_referente_cognome);

  insert into public.institution_profiles (user_id, istituzione_id)
  values (v_uid, v_istituzione_id);
end;
$$;


-- Il grant resta quello del 13/07, con la revoca esplicita ad `anon` che
-- mancava: una SECURITY DEFINER che scrive nasce raggiungibile da chi non è
-- collegato (i default privileges di Supabase danno EXECUTE ad anon e
-- authenticated su ogni funzione nuova dello schema public, e un `revoke …
-- from public` non li tocca). Qui non era un buco — `v_uid is null` alza
-- `non_autenticato` — ma da oggi la funzione bypassa la RLS, quindi la guardia
-- è l'unica porta e la riga di permesso si scrive per non doverla indovinare.
revoke all on function public.finalize_registration_istituzione(text, text, public.istituzione_tipo, text, text, text) from public, anon;
grant execute on function public.finalize_registration_istituzione(text, text, public.istituzione_tipo, text, text, text) to authenticated;

comment on table public.institution_profiles is
  'Collega un utente al suo ente. NESSUNA SCRITTURA DAL CLIENT: la riga la crea '
  'solo finalize_registration_istituzione (SECURITY DEFINER dal 4/10), e nessun '
  'altro percorso dell''app la scrive. Fino al 4/10 esisteva una policy di '
  'insert `user_id = auth.uid()` — che verifica DI CHI e'' la riga e non DI '
  'QUALE ENTE — e con essa chiunque potesse darsi il ruolo istituzione '
  '(self-service di proposito) diventava un ente qualunque: 29 policy su 15 '
  'tabelle si fidano di current_istituzione_id(), che legge questa tabella.';
