-- KIREO — Test attitudinali, Fase 1. Migrazione B: le tabelle.
--
-- Motore dei test riprendibile, sullo stesso modello di Escape
-- (mission_attempt / step_response): il CONTENUTO dei test vive in config
-- TypeScript (lib/test/config.ts), in DB stanno solo i dati dello studente.
-- Riusa l'enum escape_attempt_stato (in_corso/completata/abbandonata) già
-- esistente: nessun enum nuovo.

-- ============ test_attempt ============
create table public.test_attempt (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  test_slug text not null,                     -- riferimento a un test in config TS (nessuna FK, come mission_slug)
  stato public.escape_attempt_stato not null default 'in_corso',
  item_corrente smallint not null default 1 check (item_corrente >= 1),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Un solo tentativo attivo per (studente, test); ri-tentativi storici ammessi
-- (stesso idioma di mission_attempt / workshop_iscrizioni).
create unique index test_attempt_una_attiva_idx
  on public.test_attempt (student_id, test_slug) where stato = 'in_corso';
create index test_attempt_student_idx on public.test_attempt (student_id);

alter table public.test_attempt enable row level security;

create policy test_attempt_select_own on public.test_attempt
  for select to authenticated using (student_id = auth.uid());
create policy test_attempt_insert_own on public.test_attempt
  for insert to authenticated with check (student_id = auth.uid());
create policy test_attempt_update_own on public.test_attempt
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ============ test_response ============
-- Una riga per (attempt, item): upsert su re-risposta/ripresa, stesso pattern
-- di step_response. unique (attempt_id, item_id) abilita l'upsert e la ripresa.
create table public.test_response (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempt (id) on delete cascade,
  item_id text not null,                       -- id dell'item nel config TS
  payload jsonb not null,                      -- la scelta dello studente ({ opzioneId })
  created_at timestamptz not null default now(),
  unique (attempt_id, item_id)
);
create index test_response_attempt_idx on public.test_response (attempt_id);

alter table public.test_response enable row level security;

-- Ownership tramite l'attempt (nessuna colonna student_id denormalizzata),
-- stesso pattern di step_response.
create policy test_response_select_own on public.test_response
  for select to authenticated using (
    exists (select 1 from public.test_attempt a where a.id = attempt_id and a.student_id = auth.uid())
  );
create policy test_response_insert_own on public.test_response
  for insert to authenticated with check (
    exists (select 1 from public.test_attempt a where a.id = attempt_id and a.student_id = auth.uid())
  );
create policy test_response_update_own on public.test_response
  for update to authenticated using (
    exists (select 1 from public.test_attempt a where a.id = attempt_id and a.student_id = auth.uid())
  ) with check (
    exists (select 1 from public.test_attempt a where a.id = attempt_id and a.student_id = auth.uid())
  );

-- ============ evidence: collegamento al tentativo di test ============
-- evidence.attempt_id già referenzia mission_attempt: per le prove dei test
-- serve un secondo collegamento nullable a test_attempt. Una prova di test ha
-- attempt_id null e test_attempt_id valorizzato (fonte='test'); una prova di
-- missione il contrario. Il cascade tiene pulite le prove se il tentativo di
-- test viene cancellato (es. cancellazione account → cascade su profiles).
alter table public.evidence
  add column test_attempt_id uuid references public.test_attempt (id) on delete cascade;
create index evidence_test_attempt_idx on public.evidence (test_attempt_id);
