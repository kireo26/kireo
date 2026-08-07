-- Workshop 2.0 v2 — percorso a tappe gated, con revisione formativa,
-- reazione del cliente e barra della fiducia. Evoluzione della v1
-- (workshop_elaborati, workshop_tutor_log — invariate, non toccate qui se
-- non per la colonna fiducia sotto). Fetta verticale: SOLO
-- palestra-popolare > salute, come da spec — nessun'altra migration
-- workshop toccata, nessun altro workshop/ruolo coinvolto (le righe di
-- workshop_fasi_stato nascono solo per iscrizioni a ruoli che hanno una
-- configurazione v2 in lib/workshop/elaborato-config.ts, quindi oggi solo
-- per quel ruolo — nessun rischio di effetti su altri workshop anche se
-- lo schema è generico).

alter table public.workshop_elaborati
  add column fiducia integer not null default 0 check (fiducia >= 0 and fiducia <= 100);

comment on column public.workshop_elaborati.fiducia is
  'Fiducia del cliente simulato (0-100), accumulata tappa per tappa da avanza_fase_workshop(). Mostrata come barra "quanto hai convinto il cliente" e citata nel messaggio di chiusura finale.';

-- ============ stato per-tappa di ogni iscrizione ============
create table public.workshop_fasi_stato (
  id uuid primary key default gen_random_uuid(),
  iscrizione_id uuid not null references public.workshop_iscrizioni (id) on delete cascade,
  fase_id text not null,
  stato text not null default 'bloccata'
    check (stato in ('bloccata', 'aperta', 'consegnata', 'revisionata')),
  aperta_at timestamptz,
  consegnata_at timestamptz,
  revisionata_at timestamptz,
  revisione jsonb,        -- {punti_forza[], da_migliorare[], domanda, commento_breve, punteggio_fiducia} — vedi lib/workshop/prompt-revisore.ts
  reazione_cliente text,  -- messaggio in carattere del cliente, generato dal cron
  unique (iscrizione_id, fase_id)
);

comment on table public.workshop_fasi_stato is
  'Stato di avanzamento per tappa (Workshop 2.0 v2): bloccata -> aperta -> consegnata -> revisionata, la successiva passa a sua volta bloccata -> aperta. Righe create da inizializza_fasi_workshop() all''iscrizione (SOLO per ruoli con una configurazione v2, non per tutti i workshop), avanzate da consegna_fase_workshop() (studente) e avanza_fase_workshop() (cron, SECURITY DEFINER service_role-only). Le sezioni compilate restano in workshop_elaborati.contenuto, invariato dalla v1 — questa tabella traccia solo lo stato di avanzamento, non i contenuti.';

create index workshop_fasi_stato_iscrizione_idx on public.workshop_fasi_stato (iscrizione_id);
create index workshop_fasi_stato_cron_idx on public.workshop_fasi_stato (stato) where stato = 'consegnata';

alter table public.workshop_fasi_stato enable row level security;

-- Nessuna policy insert/update/delete per lo studente: ogni transizione di
-- stato passa dalle funzioni sotto (function-only write, stesso principio
-- già in uso per workshop_chat_cliente/conversazioni_enti/messaggi_enti) —
-- altrimenti un insert diretto potrebbe marcare una tappa 'revisionata'
-- con un punteggio_fiducia a piacere, o sbloccarne una senza passare dal
-- cooldown.
create policy workshop_fasi_stato_select_own
  on public.workshop_fasi_stato for select
  to authenticated
  using (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
  );

create policy workshop_fasi_stato_admin_select
  on public.workshop_fasi_stato for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- ============ inizializzazione al primo accesso (tappa 1 aperta, resto bloccato) ============
-- Chiamata dalla pagina progetto (sessione autenticata dello studente),
-- non dall'iscrizione al ruolo (workshop_iscrizioni resta un flusso
-- generico condiviso da tutti i workshop, non va specializzato per la
-- progressione a tappe di un solo ruolo). Idempotente: on conflict do
-- nothing, un secondo accesso non tocca lo stato già esistente.
create or replace function public.inizializza_fasi_workshop(p_iscrizione_id uuid, p_fase_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fase_id text;
  v_indice integer := 0;
begin
  if not exists (
    select 1 from public.workshop_iscrizioni
    where id = p_iscrizione_id and student_id = auth.uid()
  ) then
    raise exception 'non_autorizzato';
  end if;

  foreach v_fase_id in array p_fase_ids loop
    insert into public.workshop_fasi_stato (iscrizione_id, fase_id, stato, aperta_at)
    values (
      p_iscrizione_id,
      v_fase_id,
      case when v_indice = 0 then 'aperta' else 'bloccata' end,
      case when v_indice = 0 then now() else null end
    )
    on conflict (iscrizione_id, fase_id) do nothing;
    v_indice := v_indice + 1;
  end loop;
end;
$$;

grant execute on function public.inizializza_fasi_workshop(uuid, text[]) to authenticated;

-- ============ consegna di una tappa (studente) ============
-- Verifica proprietà + che la tappa sia davvero 'aperta' (non si può
-- consegnare una tappa bloccata o già consegnata) + la chat minima col
-- cliente (conteggio reale su workshop_chat_cliente, non fidato dal
-- client). La validazione "sezioni minime compilate" resta lato
-- applicazione (route + client, contro il contenuto autorevole letto dal
-- DB): è un gate di qualità formativo, non un confine di sicurezza — il
-- worst case di uno studente che aggira il controllo client-side è una
-- tappa consegnata con risposte scarne, non un accesso o un dato che non
-- potrebbe già raggiungere. Idempotente: where stato = 'aperta' rende un
-- secondo tentativo un no-op silenzioso invece di un doppio avanzamento.
create or replace function public.consegna_fase_workshop(p_iscrizione_id uuid, p_fase_id text, p_chat_minima integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aperta_at timestamptz;
  v_messaggi integer;
begin
  if not exists (
    select 1 from public.workshop_iscrizioni
    where id = p_iscrizione_id and student_id = auth.uid()
  ) then
    raise exception 'non_autorizzato';
  end if;

  select aperta_at into v_aperta_at
  from public.workshop_fasi_stato
  where iscrizione_id = p_iscrizione_id and fase_id = p_fase_id and stato = 'aperta';

  if v_aperta_at is null then
    raise exception 'fase_non_aperta';
  end if;

  select count(*) into v_messaggi
  from public.workshop_chat_cliente
  where iscrizione_id = p_iscrizione_id
    and mittente = 'studente'
    and created_at >= v_aperta_at;

  if v_messaggi < p_chat_minima then
    raise exception 'chat_minima_non_raggiunta';
  end if;

  update public.workshop_fasi_stato
  set stato = 'consegnata', consegnata_at = now()
  where iscrizione_id = p_iscrizione_id and fase_id = p_fase_id and stato = 'aperta';
end;
$$;

grant execute on function public.consegna_fase_workshop(uuid, text, integer) to authenticated;

-- ============ avanzamento dal cron (motore del tempo) ============
-- SECURITY DEFINER ma SENZA controllo auth.uid(): il cron non ha una
-- sessione studente (nessuno è loggato quando scatta), quindi non c'è
-- nulla da confrontare con auth.uid() — l'autorizzazione è interamente
-- delegata al fatto che SOLO service_role può eseguire questa funzione
-- (revoke esplicito da authenticated/anon/public sotto): la route del
-- cron usa la service role key, mai raggiungibile da un client normale.
-- Idempotente: l'update su workshop_fasi_stato ha `where stato =
-- 'consegnata'`, quindi una seconda invocazione sulla stessa tappa (es.
-- due esecuzioni del cron sovrapposte) trova 0 righe e restituisce subito
-- senza incrementare la fiducia una seconda volta o riaprire una tappa
-- già aperta.
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
    -- p_feedback_finale è il feedback complessivo generato da
    -- promptFeedbackFinale (forma diversa da p_revisione, che resta la
    -- revisione rubrica-based di questa singola tappa) — coalesce come
    -- rete di sicurezza, non il percorso atteso: il cron lo passa sempre
    -- quando p_ultima è true.
    update public.workshop_elaborati
    set stato = 'consegnato', feedback_ai = coalesce(p_feedback_finale, p_revisione), consegnato_at = now(), updated_at = now()
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
