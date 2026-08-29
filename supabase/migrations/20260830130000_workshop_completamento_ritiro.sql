-- KIREO — un'iscrizione a un workshop può finire.
--
-- IL DIFETTO. Gli stati 'completato' e 'ritirato' esistono nell'enum dal primo
-- giorno, con un commento che li dichiarava «predisposti per una fase
-- successiva»: quella fase non è mai arrivata. In tutta l'interfaccia NON
-- ESISTEVA NESSUN PERCORSO che portasse un'iscrizione fuori da 'attivo' —
-- nemmeno finire il progetto.
--
-- PERCHÉ CONTA ANCORA, ora che il ruolo non è più esclusivo (vedi
-- 20260830120000: non c'è più nessun posto scarso da liberare):
--   · un'iscrizione che resta 'attivo' per sempre è semplicemente un dato
--     sbagliato — dice che stai lavorando a una cosa che hai chiuso a maggio;
--   · `contaWorkshopConsegnati` e chiunque guardi «a cosa sta lavorando» non
--     hanno modo di distinguere in corso da finito;
--   · e il ritiro è quello che permette di CAMBIARE RUOLO: l'unico vincolo
--     rimasto è una sola iscrizione attiva per studente e workshop, quindi
--     per passare a un altro ruolo bisogna prima lasciare quello di adesso.
--
-- IL LAVORO NON SI PERDE MAI. Né il completamento né il ritiro cancellano
-- niente: le policy di lettura di workshop_elaborati, workshop_fasi_stato,
-- workshop_chat_cliente e workshop_consegne guardano `student_id = auth.uid()`
-- e NON lo stato dell'iscrizione [verificato, non dedotto: nessuna di quelle
-- policy nomina 'attivo']. Chi ha finito o ha lasciato continua a rileggere il
-- proprio progetto, le revisioni e la chat. Restano fuori solo le due cose che
-- riguardano i compagni — `peers_workshop` e `invia_messaggio_rete_workshop` —
-- che richiedono un'iscrizione attiva, ed è il verso giusto.

-- ── 1. il progetto che si chiude completa l'iscrizione ───────────────────────
-- STESSA IDENTICA FIRMA (9 parametri): `create or replace` sostituisce la
-- funzione in place. NON aggiungere parametri — creerebbe un SECONDO overload
-- invece di sostituirla (la trappola Postgres già pagata con
-- finalize_registration_istituzione).
-- Rispetto alla versione di 20260823110000 cambia UNA COSA SOLA: l'update su
-- workshop_iscrizioni in fondo al ramo `p_ultima`.
create or replace function public.avanza_fase_workshop(
  p_iscrizione_id uuid,
  p_fase_id text,
  p_prossima_fase_id text,
  p_revisione jsonb,
  p_reazione_cliente text,
  p_punteggio_fiducia integer,
  p_ultima boolean,
  p_area_slug text,
  p_feedback_finale jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workshop_fasi_stato
  set stato = 'revisionata',
      revisionata_at = now(),
      revisione = p_revisione,
      reazione_cliente = p_reazione_cliente
  where iscrizione_id = p_iscrizione_id and fase_id = p_fase_id and stato = 'consegnata';

  if not found then
    return; -- già processata (idempotenza) o stato incoerente: nessun effetto
  end if;

  -- Upsert, non un semplice update: se lo studente ha consegnato la tappa
  -- senza che l'autosave avesse ancora mai creato la riga in
  -- workshop_elaborati (edge case — richiede comunque le sezioni minime
  -- compilate, ma un autosave può non essere ancora atterrato), un update
  -- puro troverebbe 0 righe e la fiducia andrebbe persa in silenzio senza
  -- alcun errore.
  insert into public.workshop_elaborati (iscrizione_id, fiducia, updated_at)
  values (p_iscrizione_id, least(100, greatest(0, coalesce(p_punteggio_fiducia, 0))), now())
  on conflict (iscrizione_id) do update
  set fiducia = least(100, greatest(0, public.workshop_elaborati.fiducia + coalesce(p_punteggio_fiducia, 0))),
      updated_at = now();

  if p_prossima_fase_id is not null then
    update public.workshop_fasi_stato
    set stato = 'aperta', aperta_at = now()
    where iscrizione_id = p_iscrizione_id and fase_id = p_prossima_fase_id and stato = 'bloccata';
  end if;

  if p_ultima then
    -- feedback_ai = p_feedback_finale SECCO (niente coalesce): NULL significa
    -- «non l'abbiamo generato», e la UI lo dice invece di mostrare la
    -- revisione di una tappa al posto del finale.
    update public.workshop_elaborati
    set stato = 'consegnato', feedback_ai = p_feedback_finale, consegnato_at = now(), updated_at = now()
    where iscrizione_id = p_iscrizione_id;

    -- Stesso pattern già in uso in chiudi_diretta_evento (certificazione
    -- automatica delle presenze): un processo di sistema può scrivere
    -- activity_log direttamente, non solo il client dalla propria
    -- sessione — qui non c'è nessun browser aperto quando il cron scatta.
    -- on conflict do nothing: il cap giornaliero reale di activity_log (1
    -- riga/studente+area+tipo/giorno) potrebbe già essere stato consumato
    -- da un'altra attività dello stesso giorno, non è un errore.
    insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
    select wi.student_id, p_area_slug, 'workshop_pcto', 25
    from public.workshop_iscrizioni wi
    where wi.id = p_iscrizione_id
    on conflict do nothing;

    -- ▼ LA RIGA CHE MANCAVA. Il progetto è chiuso: l'iscrizione smette di
    -- dire «ci sto lavorando». `where stato = 'attivo'` la rende idempotente
    -- come tutto il resto della funzione, e non tocca un'iscrizione che nel
    -- frattempo fosse stata ritirata.
    update public.workshop_iscrizioni
    set stato = 'completato'
    where id = p_iscrizione_id and stato = 'attivo';
  end if;
end;
$$;

revoke all on function public.avanza_fase_workshop(uuid, text, text, jsonb, text, integer, boolean, text, jsonb) from public, authenticated, anon;
grant execute on function public.avanza_fase_workshop(uuid, text, text, jsonb, text, integer, boolean, text, jsonb) to service_role;

-- ── 2. il ritiro ─────────────────────────────────────────────────────────────
-- Function-only write, come ogni altra transizione di stato dei workshop: su
-- workshop_iscrizioni non esiste (e non va aggiunta) una policy UPDATE per lo
-- studente, altrimenti potrebbe scriversi lo stato che vuole — compreso
-- 'completato' su un progetto mai finito.
--
-- Idempotente: un'iscrizione già ritirata o già completata non viene toccata e
-- la funzione non solleva niente. Non si «ritira» un progetto finito:
-- l'iscrizione completata è la prova che l'ha fatto.
create or replace function public.ritira_iscrizione_workshop(p_iscrizione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.workshop_iscrizioni
    where id = p_iscrizione_id and student_id = auth.uid()
  ) then
    raise exception 'non_autorizzato';
  end if;

  update public.workshop_iscrizioni
  set stato = 'ritirato'
  where id = p_iscrizione_id and stato = 'attivo';
end;
$$;

grant execute on function public.ritira_iscrizione_workshop(uuid) to authenticated;

comment on function public.ritira_iscrizione_workshop(uuid) is
  'Lo studente lascia un workshop: il lavoro resta (nessuna riga viene cancellata), l''iscrizione smette di dire «ci sto lavorando» e si libera la strada per scegliere un altro ruolo. Idempotente.';

-- ── 3. tornare indietro ──────────────────────────────────────────────────────
-- Riprendere è tornare sullo STESSO ruolo, con il lavoro dov'era. Chi invece
-- vuole cambiare ruolo si iscrive normalmente all'altro: è una riga nuova, con
-- un elaborato nuovo, e la vecchia resta ritirata con dentro quello che aveva
-- scritto.
--
-- L'unica cosa che può andare storta è avere già un'iscrizione attiva in
-- questo workshop (l'indice parziale di 20260830120000). Qui l'eccezione viene
-- tradotta in un motivo leggibile, invece di arrivare al client come
-- `duplicate key value violates unique constraint`.
create or replace function public.riprendi_iscrizione_workshop(p_iscrizione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.workshop_iscrizioni
    where id = p_iscrizione_id and student_id = auth.uid()
  ) then
    raise exception 'non_autorizzato';
  end if;

  update public.workshop_iscrizioni
  set stato = 'attivo'
  where id = p_iscrizione_id and stato = 'ritirato';
exception
  when unique_violation then
    raise exception 'iscrizione_gia_attiva';
end;
$$;

grant execute on function public.riprendi_iscrizione_workshop(uuid) to authenticated;

comment on function public.riprendi_iscrizione_workshop(uuid) is
  'Riprende un''iscrizione ritirata, sullo stesso ruolo e con il lavoro dov''era. Solleva iscrizione_gia_attiva se nel frattempo lo studente ha già ripreso un altro ruolo di questo workshop.';

comment on table public.workshop_iscrizioni is
  'Una sola iscrizione ATTIVA per studente e workshop (workshop_iscrizioni_studente_attiva_idx). Un ruolo lo possono fare più studenti insieme: l''esclusività per ruolo è uscita il 2026-08-30. Un''iscrizione esce da «attivo» quando il progetto si chiude (avanza_fase_workshop -> completato) o quando lo studente lascia (ritira_iscrizione_workshop). Nessuna delle due cancella il lavoro.';
