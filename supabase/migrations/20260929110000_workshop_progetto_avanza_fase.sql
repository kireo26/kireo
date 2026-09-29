-- KIREO — la chiusura di un progetto workshop scrive 'workshop_progetto'.
--
-- L'UNICA COSA CHE CAMBIA rispetto alla definizione viva (20260830130000) è il
-- LETTERALE ENUM nell'insert su activity_log: 'workshop_pcto' → 'workshop_progetto'.
-- Il peso resta 25, la firma resta la stessa (9 parametri), tutto il resto del
-- corpo è riportato tale e quale. Il perché sta per esteso nella migrazione
-- 20260929100000, che aggiunge il valore.
--
-- PERCHÉ IL CORPO È RICOPIATO E NON «PATCHATO». Postgres non sa modificare una
-- riga dentro una funzione: `create or replace` la sostituisce intera, quindi
-- il corpo va riscritto per forza. È la forma già usata da 20260823110000 e
-- 20260830130000 sulla stessa funzione, e la ragione per cui questo file dice
-- da DOVE viene il corpo — l'elenco delle «migrazioni in attesa» in CLAUDE.md
-- non è un registro di cosa c'è sul database: chi applica questo file deve
-- sapere che il corpo di partenza è quello di 20260830130000 e non un altro.
--
-- STESSA IDENTICA FIRMA (9 parametri): NON aggiungere parametri — creerebbe un
-- SECONDO overload invece di sostituirla (la trappola Postgres già pagata con
-- finalize_registration_istituzione).
--
-- LE ALTRE DUE SCRITTURE NON SI TOCCANO. `certifica_presenza`
-- (20260715140000) e `chiudi_diretta_evento` (20260927130000) continuano a
-- scrivere 'workshop_pcto' per gli eventi di tipo 'workshop': lì la parola è
-- vera, le ore esistono e le produce la stessa transazione che certifica.
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
    --
    -- ▼ 'workshop_progetto', NON 'workshop_pcto'. Un progetto workshop KIREO
    -- non produce ore PCTO: non ha un monte ore (la tabella `workshop` ha
    -- `durata_giorni`, non ore) e non ha nessuna catena di responsabilità —
    -- l'ha giudicato un'AI. Le ore nascono solo dove qualcuno le certifica.
    insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
    select wi.student_id, p_area_slug, 'workshop_progetto', 25
    from public.workshop_iscrizioni wi
    where wi.id = p_iscrizione_id
    on conflict do nothing;

    -- Il progetto è chiuso: l'iscrizione smette di dire «ci sto lavorando».
    -- `where stato = 'attivo'` la rende idempotente come tutto il resto della
    -- funzione, e non tocca un'iscrizione che nel frattempo fosse stata
    -- ritirata.
    update public.workshop_iscrizioni
    set stato = 'completato'
    where id = p_iscrizione_id and stato = 'attivo';
  end if;
end;
$$;

-- `create or replace` PRESERVA i privilegi, quindi queste due righe non
-- servirebbero. Si rimettono lo stesso, e sono idempotenti: una funzione
-- service-role-only che per restare tale dipende da una migrazione precedente
-- è una cosa che nessuno va a ricontrollare, e chi legge questo file da solo
-- deve poter vedere chi può eseguirla.
revoke all on function public.avanza_fase_workshop(uuid, text, text, jsonb, text, integer, boolean, text, jsonb) from public, authenticated, anon;
grant execute on function public.avanza_fase_workshop(uuid, text, text, jsonb, text, integer, boolean, text, jsonb) to service_role;

comment on type public.tipo_attivita is
  'I tipi di attività di esplorazione. workshop_progetto = un progetto workshop KIREO portato a termine (nessuna ora PCTO: nessun monte ore, nessuna certificazione umana). workshop_pcto = la presenza certificata su un EVENTO di tipo workshop, dove le ore esistono davvero. I due erano lo stesso valore fino al 2026-09-29: le righe scritte prima non sono attribuibili e non si prova a farlo.';
