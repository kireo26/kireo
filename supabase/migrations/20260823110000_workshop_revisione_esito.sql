-- KIREO Workshop 2.0 v2 — una revisione fallita non avanza più in silenzio.
--
-- Prima: se la chiamata AI della revisione falliva, il cron teneva
-- REVISIONE_VUOTA (fiducia 0) e chiamava `avanza_fase_workshop` LO STESSO. La
-- tappa passava a 'revisionata' e non veniva mai ritentata: lo studente perdeva
-- 25 punti di fiducia su 100 per un guasto NOSTRO, in modo permanente e
-- indistinguibile da un giudizio severo. È la stessa malattia del revisore
-- Escape (un guasto travestito da risultato), sulla superficie gemella.
--
-- Ora: su fallimento la tappa RESTA 'consegnata' e il cron successivo ritenta.
-- Dopo 3 giri ci si arrende — ma dichiarando l'assenza, mai uno zero:
--   - la tappa avanza comunque (lo studente non resta mai bloccato),
--   - viene marcata `revisione_esito` ≠ 'riuscita',
--   - la barra della fiducia ACCORCIA IL DENOMINATORE (45/75, non 45/100) con
--     la nota «una tappa non è stata valutata». NULL non è zero: è lo stesso
--     principio già applicato a area_signal (punteggi nullable) e alle barre
--     «non ancora misurata» dell'esito missione.
--
-- Tre esiti, gemelli dei tre di Escape (letto / letto_senza_credito /
-- non_riuscito):
--   riuscita          — JSON valido e di forma attesa
--   non_riuscita      — chiamata o estrazione JSON fallita
--   forma_non_valida  — JSON tornato ma di forma inattesa (il gemello di
--                       letto_senza_credito: prima cadeva in un `else` che non
--                       c'era, quindi non produceva nulla E non veniva contato
--                       dall'alert giornaliero)
-- Il comportamento dei due esiti di fallimento è identico (ritenta, poi
-- dichiara): il valore distinto serve alla diagnosi.

-- ── parte 1 — le due colonne su workshop_fasi_stato ──────────────────────
-- Nessun default diverso da quello naturale: le righe esistenti restano a
-- tentativi 0 / esito NULL, che significa «mai tentata» — corretto sia per le
-- tappe non ancora consegnate sia per quelle già revisionate prima di questa
-- migrazione (per quelle il display ricade sul comportamento di prima: se c'è
-- una revisione con contenuto, la mostra).
alter table public.workshop_fasi_stato
  add column tentativi_revisione smallint not null default 0,
  add column revisione_esito text
    check (revisione_esito in ('riuscita', 'non_riuscita', 'forma_non_valida'));

comment on column public.workshop_fasi_stato.tentativi_revisione is
  'Quante volte il cron ha provato a generare la revisione di questa tappa. Si ferma a MAX_TENTATIVI_REVISIONE (3, in app/api/cron/workshop-motore/route.ts).';
comment on column public.workshop_fasi_stato.revisione_esito is
  'Esito della revisione AI: riuscita | non_riuscita | forma_non_valida. NULL = mai tentata (tappa non ancora consegnata, o riga antecedente alla migrazione). Un esito ≠ riuscita esclude la tappa dal DENOMINATORE della barra fiducia — mai uno 0 spacciato per giudizio.';

-- ── parte 2 — avanza_fase_workshop: niente più fallback sul feedback finale ──
-- STESSA IDENTICA FIRMA (9 parametri): `create or replace` sostituisce la
-- funzione in place. NON aggiungere parametri qui — cambierebbe l'identità
-- della funzione e creerebbe un SECONDO overload invece di sostituirla (la
-- trappola Postgres già pagata con finalize_registration_istituzione). Le due
-- colonne nuove le scrive il cron con UPDATE diretti (gira in service-role).
--
-- Unica differenza rispetto alla versione 20260809100000: il
-- `coalesce(p_feedback_finale, p_revisione)` diventa `p_feedback_finale` secco.
-- Quel coalesce, nato come rete di sicurezza, infilava la revisione della
-- SINGOLA tappa nello slot del feedback COMPLESSIVO (forme diverse): lo
-- studente avrebbe letto un finale di progetto che parla solo dell'ultima
-- tappa. Ora un feedback finale mancante resta NULL — assente, non finto.
-- Conta doppio perché `punteggio_area` (dentro feedback_ai) è la fonte che
-- useremo per collegare i workshop al profilo: uno 0 al posto di un'assenza
-- rientrerebbe in evidence il giorno del cross-feed, reintroducendo
-- «non misurato = zero», la prima cosa tolta da area_signal.
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
    -- feedback_ai = p_feedback_finale SECCO (niente coalesce, vedi sopra):
    -- NULL significa «non l'abbiamo generato», e la UI lo dice invece di
    -- mostrare la revisione di una tappa al posto del finale.
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
  end if;
end;
$$;

revoke all on function public.avanza_fase_workshop(uuid, text, text, jsonb, text, integer, boolean, text, jsonb) from public, authenticated, anon;
grant execute on function public.avanza_fase_workshop(uuid, text, text, jsonb, text, integer, boolean, text, jsonb) to service_role;

-- ── ricorso manuale (ricetta, non eseguita) ──────────────────────────────
-- Per rimettere in coda una tappa che si è arresa (es. dopo aver corretto un
-- guasto), il cron successivo la ritenta da zero:
--   update public.workshop_fasi_stato
--   set stato = 'consegnata', tentativi_revisione = 0, revisione_esito = null
--   where iscrizione_id = '<uuid>' and fase_id = '<fase>';
