-- Workshop 2.0 — elaborato online guidato a tappe, con AI-tutor.
-- Fetta verticale (validazione prima di scalare): il motore generico +
-- SOLO il ruolo palestra-popolare > salute. Lo schema dei contenuti
-- (fasi/sezioni/prompt del tutor) vive in lib/workshop/elaborato-config.ts,
-- non nel DB — qui vivono solo i dati dello studente, stesso principio
-- già seguito per lib/workshop/config.ts + workshop_iscrizioni/ecc.
--
-- NON tocca nessun'altra migration workshop, nessun altro workshop, nessun
-- altro ruolo: solo due tabelle nuove.
--
-- Divergenza dalla bozza di schema fornita da Mario (segnalata anche in
-- CLAUDE.md): la tabella reale workshop_iscrizioni usa la colonna
-- `student_id`, non `studente_id` — tutti i riferimenti sotto usano il
-- nome reale. La bozza usava anche una policy `for all` con `using`
-- soltanto sull'appartenenza dell'iscrizione: avrebbe permesso allo
-- studente di scrivere direttamente anche `stato`/`feedback_ai` (lo stesso
-- bug di sicurezza descritto nel compito come "trovato nel materiale di
-- partenza" per i workshop originali — vedi CLAUDE.md, sezione Workshop).
-- Qui è invece impedito con un `with check` che blocca stato/feedback_ai/
-- consegnato_at su ogni insert/update diretto dello studente: solo la
-- funzione SECURITY DEFINER sotto (che gira come proprietario della
-- tabella e quindi bypassa la RLS, stesso principio di ogni altra funzione
-- "function-only write" del progetto) può scrivere quei tre campi.

create table public.workshop_elaborati (
  id uuid primary key default gen_random_uuid(),
  iscrizione_id uuid not null unique references public.workshop_iscrizioni (id) on delete cascade,
  contenuto jsonb not null default '{}'::jsonb,
  fase_corrente text,
  fasi_completate text[] not null default '{}',
  stato text not null default 'bozza' check (stato in ('bozza', 'consegnato')),
  feedback_ai jsonb,
  updated_at timestamptz not null default now(),
  consegnato_at timestamptz
);

comment on table public.workshop_elaborati is
  'Elaborato online a sezioni per una iscrizione a workshop (Workshop 2.0). Una riga per iscrizione: contenuto è {sezioneId: valore}, aggiornato via upsert dal salvataggio automatico lato client (debounce ~1,5s). Lo schema di fasi/sezioni/prompt vive in lib/workshop/elaborato-config.ts, non qui.';

create index workshop_elaborati_iscrizione_idx on public.workshop_elaborati (iscrizione_id);

alter table public.workshop_elaborati enable row level security;

create policy workshop_elaborati_select_own
  on public.workshop_elaborati for select
  to authenticated
  using (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
  );

-- L'autosave scrive direttamente la tabella (contenuto/fase_corrente/
-- fasi_completate): il `with check` impedisce che la stessa scrittura
-- possa anche marcare l'elaborato come consegnato o inventarsi un
-- feedback — quei tre campi restano sempre ai valori "non consegnato"
-- su ogni insert/update fatto dallo studente stesso.
create policy workshop_elaborati_insert_own
  on public.workshop_elaborati for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
    and stato = 'bozza'
    and feedback_ai is null
    and consegnato_at is null
  );

create policy workshop_elaborati_update_own
  on public.workshop_elaborati for update
  to authenticated
  using (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
    and stato = 'bozza'
    and feedback_ai is null
    and consegnato_at is null
  );

create policy workshop_elaborati_admin_select
  on public.workshop_elaborati for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- ============ log + fair-use del tutor (stesso pattern di assistente_conversazioni) ============
create table public.workshop_tutor_log (
  id uuid primary key default gen_random_uuid(),
  iscrizione_id uuid not null references public.workshop_iscrizioni (id) on delete cascade,
  sezione_id text not null,
  modo text not null check (modo in ('aiuto', 'revisione')),
  created_at timestamptz not null default now()
);

comment on table public.workshop_tutor_log is
  'Una riga per ogni richiesta al tutor AI (aiuto o revisione) — mai il contenuto scambiato, solo il conteggio per il limite giornaliero in app/api/workshop/tutor/route.ts.';

create index workshop_tutor_log_iscrizione_giorno_idx
  on public.workshop_tutor_log (iscrizione_id, ((created_at at time zone 'utc')::date));

alter table public.workshop_tutor_log enable row level security;

create policy workshop_tutor_log_select_own
  on public.workshop_tutor_log for select
  to authenticated
  using (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
  );

create policy workshop_tutor_log_insert_own
  on public.workshop_tutor_log for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workshop_iscrizioni wi
      where wi.id = iscrizione_id and wi.student_id = auth.uid()
    )
  );

create policy workshop_tutor_log_admin_select
  on public.workshop_tutor_log for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- Cap giornaliero (15 richieste/iscrizione/giorno) come vincolo DB reale,
-- non solo un controllo applicativo prima dell'insert — stesso principio
-- di limite_conversazioni_assistente_giorno: chiude anche la finestra di
-- corsa fra due richieste quasi simultanee.
create or replace function public.limite_tutor_workshop_giorno()
returns trigger
language plpgsql
as $$
declare
  v_conteggio integer;
begin
  select count(*) into v_conteggio
  from public.workshop_tutor_log
  where iscrizione_id = new.iscrizione_id
    and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;

  if v_conteggio >= 15 then
    raise exception 'troppe_richieste_tutor_oggi';
  end if;

  return new;
end;
$$;

create trigger limite_tutor_workshop_giorno_trg
before insert on public.workshop_tutor_log
for each row execute function public.limite_tutor_workshop_giorno();

-- ============ consegna del progetto (function-only write dell'esito) ============
-- SECURITY DEFINER: gira come proprietario della tabella, quindi bypassa
-- la RLS che invece blocca allo studente la scrittura diretta di
-- stato/feedback_ai/consegnato_at (vedi le policy insert/update sopra).
-- Nessun `returning` sull'upsert (lezione RLS+RETURNING già documentata
-- più volte in CLAUDE.md): non serve comunque, la route rilegge con una
-- select separata sotto la policy di lettura normale.
create or replace function public.consegna_progetto_workshop(p_iscrizione_id uuid, p_feedback jsonb)
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

  update public.workshop_elaborati
  set stato = 'consegnato',
      feedback_ai = p_feedback,
      consegnato_at = now(),
      updated_at = now()
  where iscrizione_id = p_iscrizione_id;

  if not found then
    insert into public.workshop_elaborati (iscrizione_id, stato, feedback_ai, consegnato_at)
    values (p_iscrizione_id, 'consegnato', p_feedback, now());
  end if;
end;
$$;

grant execute on function public.consegna_progetto_workshop(uuid, jsonb) to authenticated;

-- ============ cron promemoria (§4 della spec) — STUB, non implementato in questa fase ============
-- TODO Workshop 2.0 — promemoria scadenze morbide: un Vercel Cron
-- giornaliero (route /api/cron/workshop-promemoria, non ancora creata)
-- dovrebbe, per ogni iscrizione attiva con un elaborato in bozza,
-- inserire una notifica in notifiche_studenti (tabella già esistente,
-- vedi 20260727140000_notifiche_studenti.sql) quando una fase scade
-- domani o quando si "apre" un nuovo incarico — idempotente, una
-- notifica per fase/tipo. Lasciato fuori da questo giro esplicitamente
-- (compito: "puoi lasciarlo come stub/TODO per ora").
