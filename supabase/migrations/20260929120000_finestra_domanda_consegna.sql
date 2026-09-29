-- KIREO — la domanda finale si scrive con calma, non mentre si è in onda.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- COSA È SUCCESSO, il 2026-09-29 alle 12:23
-- ═══════════════════════════════════════════════════════════════════════════
-- Evento approvato per le 15:00, link della diretta impostato, uno studente
-- iscritto. L'ente scrive la domanda finale, preme «Poni la domanda» e legge:
-- «La domanda si pone mentre la diretta è aperta: adesso è troppo tardi (o
-- troppo presto).»
--
-- La finestra era `evento_in_finestra_diretta`: da `data_inizio - 15 minuti` a
-- `data_fine`. Per un evento 15:00-15:15 sono TRENTA MINUTI, quindici dei quali
-- l'ente li passa IN ONDA A PARLARE.
--
-- PERCHÉ È UN DIFETTO E NON UNA SCELTA STRETTA. La domanda è il pezzo del
-- formato che l'ente non sa fare da solo — sta scritto nel documento del
-- formato, due giorni prima di questo file. Le due cose che succedono davvero,
-- in ordine di probabilità: la scrive di fretta, e diventa una domanda a cui si
-- può rispondere restando generici (cioè esattamente quello contro cui sono
-- stati scritti il placeholder e la riga sopra il campo); oppure se la dimentica,
-- e allora la consegna non esiste — nessuna prova, nessun credito, nessun
-- riepilogo. Il pezzo che regge tutto il formato dipendeva da un gesto fatto nel
-- momento in cui una persona è più occupata.
--
-- E NESSUN CONTROLLO POTEVA TROVARLO: la finestra funziona perfettamente, la
-- guardia è corretta, il messaggio compare quando deve. È giusta la macchina e
-- sbagliato il momento in cui chiede una cosa a un essere umano.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LA FINESTRA NUOVA, E PERCHÉ LE DUE METÀ HANNO RAGIONI OPPOSTE
-- ═══════════════════════════════════════════════════════════════════════════
-- SCRIVIBILE da quando l'evento è APPROVATO: una domanda del genere si prepara
-- con calma, e così si può anche aiutare l'ente a scriverla — cosa oggi
-- impossibile, dato che nasce mentre lui è in onda.
-- MODIFICABILE fino alla FINE DELLA DIRETTA: una diretta prende una piega che
-- nessuno aveva previsto, e la domanda migliore è quella che nasce da com'è
-- andata davvero.
--
-- ⚠️ QUELLO CHE NON CAMBIA È QUANDO GLI STUDENTI LA VEDONO: a diretta conclusa,
-- come prima. `consegna_evento_aperta` non si tocca — scriverla prima non vuol
-- dire mostrarla prima. Le due finestre restano ADIACENTE E DISGIUNTE: la
-- domanda si cambia finché `now() < fine`, la consegna si apre da `now() >=
-- fine`. Quindi la proprietà della migrazione precedente resta intatta per
-- costruzione: una domanda non si cambia mai sotto a chi sta già scrivendo.
--
-- `evento_in_finestra_diretta` NON SI TOCCA, e non per prudenza: i suoi altri
-- due chiamanti — la policy di insert su `domande_live` e la guardia di
-- `ping_presenza_live` — vogliono legittimamente la finestra stretta. Una
-- domanda del pubblico o un battito di presenza fuori dalla diretta non sono la
-- stessa cosa di una domanda finale preparata il giorno prima.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- APPLICAZIONE: via SQL Editor, DOPO 20260927120000_consegna_evento.sql (di cui
-- ridefinisce `imposta_domanda_consegna`). Nessun dato trasformato: cambia solo
-- chi può scrivere e quando. Dopo, `scripts/verifica-finestra-domanda.sql` prova
-- le proprietà in una transazione con ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════ la finestra della domanda ════════════════════════
-- SECURITY INVOKER come le due sorelle (`evento_in_finestra_diretta`,
-- `consegna_evento_aperta`): legge solo eventi approvati, che il chiamante può
-- già leggere da sé.
--
-- LA FINE È LA STESSA DELLE ALTRE DUE — `data_fine`, o `data_inizio + 3 ore`
-- quando manca — perché le tre finestre non possano divergere sul significato
-- di «fine»: quella di una è esattamente l'inizio dell'altra.
--
-- «Modificabile» comprende «scrivibile la prima volta»: è una finestra sola, e
-- due predicati per i due gesti sarebbero due definizioni della stessa cosa.
create or replace function public.domanda_consegna_modificabile(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = p_evento_id
      and e.stato = 'approvato'
      and now() < coalesce(e.data_fine, e.data_inizio + interval '3 hours')
  );
$$;

comment on function public.domanda_consegna_modificabile(uuid) is
  'La finestra della domanda finale: da quando l''evento è approvato fino alla fine della diretta. Si chiude esattamente dove si apre consegna_evento_aperta, così una domanda non cambia mai sotto a chi sta già rispondendo.';

-- ════════════════════════ l'ente pone la domanda ════════════════════════
-- Corpo riportato da 20260927120000_consegna_evento.sql: `create or replace`
-- sostituisce la funzione INTERA, quindi il corpo va riscritto per forza — e
-- chi applica questo file deve sapere da dove viene (l'elenco delle «migrazioni
-- in attesa» in CLAUDE.md non è un registro di cosa c'è sul database).
--
-- STESSA IDENTICA FIRMA (uuid, text): un parametro in più creerebbe un SECONDO
-- overload invece di sostituirla.
--
-- COSA CAMBIA: la guardia della finestra, e il fatto che i due rifiuti adesso
-- sono DUE. `fuori_finestra_diretta` diceva una cosa sola per due situazioni
-- opposte, e il messaggio che ne usciva ammetteva di non sapere da che parte
-- fossi («è troppo tardi (o troppo presto)») — cioè non diceva né cosa fare né
-- quando tornare, le due informazioni per cui un rifiuto esiste. Il sistema le
-- ha entrambe: conosce now(), data_inizio e data_fine.
create or replace function public.imposta_domanda_consegna(p_evento_id uuid, p_domanda text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizzatore uuid;
  v_stato text;
  v_aree integer;
begin
  select organizzatore_id, stato::text into v_organizzatore, v_stato
  from public.eventi where id = p_evento_id;
  if not found then
    raise exception 'evento_non_trovato';
  end if;

  -- Autorizzazione a RAMI AFFERMATIVI con `else raise`: un ruolo o
  -- un'istituzione NULL non entra in nessun ramo positivo, quindi è NULL-safe
  -- per costruzione senza bisogno di `is distinct from`.
  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore is not null and v_organizzatore = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  -- I DUE RIFIUTI, separati perché sono due attese opposte per chi legge: uno
  -- si risolve aspettando la revisione di KIREO, l'altro non si risolve più.
  -- `is distinct from` e non `<>`: oggi `eventi.stato` è NOT NULL, quindi `<>`
  -- basterebbe — ma basterebbe per un vincolo che vive in un altro file, e la
  -- forma che non dipende da lui costa zero.
  if v_stato is distinct from 'approvato' then
    raise exception 'evento_non_approvato';
  end if;

  if not public.domanda_consegna_modificabile(p_evento_id) then
    raise exception 'domanda_non_piu_modificabile';
  end if;

  -- Il punto più a monte in cui l'assenza di aree si può dire a qualcuno che
  -- può rimediare — e da oggi lo si dice GIORNI PRIMA della diretta invece che
  -- durante, che è l'altra cosa che questa finestra più larga regala.
  select count(*) into v_aree from public.eventi_aree where evento_id = p_evento_id;
  if v_aree = 0 then
    raise exception 'evento_senza_aree';
  end if;

  update public.eventi set domanda_consegna = p_domanda, updated_at = now() where id = p_evento_id;
end;
$$;

comment on column public.eventi.domanda_consegna is
  'La domanda che l''organizzatore pone sul contenuto della diretta e a cui si risponde in KIREO (vedi consegne_evento). NULL = questo evento non ha una consegna, ed è il caso normale. Si imposta solo da imposta_domanda_consegna(), da quando l''evento è approvato fino alla fine della diretta.';

-- `revoke … from public, anon` e non solo `from public`: i default privileges di
-- Supabase concedono EXECUTE ad anon e authenticated su ogni funzione nuova
-- dello schema public, e revocare dal solo PUBLIC non chiude niente.
-- `create or replace` PRESERVA i privilegi, quindi per `imposta_domanda_consegna`
-- queste righe non servirebbero: si rimettono lo stesso, idempotenti, perché chi
-- legge questo file da solo deve poter vedere chi può eseguirla.
revoke all on function public.domanda_consegna_modificabile(uuid) from public, anon;
revoke all on function public.imposta_domanda_consegna(uuid, text) from public, anon;
grant execute on function public.domanda_consegna_modificabile(uuid) to authenticated;
grant execute on function public.imposta_domanda_consegna(uuid, text) to authenticated;
