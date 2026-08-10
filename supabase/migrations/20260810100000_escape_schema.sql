-- KIREO Escape — schema del profilo unico progressivo e delle missioni a
-- stanze. Fetta verticale: motore + evidence + profilo minimo. Il CONTENUTO
-- delle missioni (escape_mission, mission_step) vive in config TypeScript
-- (lib/escape/config.ts), non qui — in DB stanno solo i dati dello studente.
--
-- DEBITO TECNICO (decisione presa con Mario): la lista dei 18 area_slug è
-- replicata come CHECK anche qui (come già in activity_log,
-- student_area_interests, workshop_ruoli). Una futura migrazione dedicata
-- dovrà introdurre una tabella `aree` e spostare TUTTE queste tabelle
-- (vecchie + nuove) su FK, in un colpo solo. Per ora si replica il pattern.

-- ============ enum ============
-- Tutti nuovi (CREATE TYPE): usabili nella stessa transazione. La
-- restrizione Postgres vale solo per ALTER TYPE ADD VALUE su enum esistenti.
create type public.escape_dimensione as enum ('interest', 'performance', 'self_efficacy', 'curiosity');

-- Include già 'workshop' e 'activity' anche se la fetta verticale emette solo
-- 'mission': così il cross-feed futuro (Step 4+) non richiederà un ALTER TYPE
-- ADD VALUE isolato più avanti.
create type public.escape_fonte as enum ('mission', 'workshop', 'activity');

create type public.escape_attempt_stato as enum ('in_corso', 'completata', 'abbandonata');

-- Le righe di area_signal nascono lazy (solo aree con almeno una prova):
-- "non esplorata" = riga assente, quindi non è uno stato memorizzato.
create type public.area_signal_status as enum ('emergente', 'confermata', 'da_verificare');

-- ============ mission_attempt ============
create table public.mission_attempt (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  mission_slug text not null,               -- riferimento a escape_mission in config TS (nessuna FK, come workshop_slug)
  stato public.escape_attempt_stato not null default 'in_corso',
  stanza_corrente smallint not null default 1 check (stanza_corrente between 1 and 5),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Un solo tentativo attivo per (studente, missione); ri-tentativi storici
-- ammessi (stesso idioma di workshop_iscrizioni / richieste_upgrade).
create unique index mission_attempt_una_attiva_idx
  on public.mission_attempt (student_id, mission_slug) where stato = 'in_corso';
create index mission_attempt_student_idx on public.mission_attempt (student_id);

alter table public.mission_attempt enable row level security;

create policy mission_attempt_select_own on public.mission_attempt
  for select to authenticated using (student_id = auth.uid());
create policy mission_attempt_insert_own on public.mission_attempt
  for insert to authenticated with check (student_id = auth.uid());
create policy mission_attempt_update_own on public.mission_attempt
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ============ step_response ============
-- Una riga per (attempt, step): upsert su re-risposta/ripresa (deviazione
-- pratica dall'append-only puro del design — l'attempt è una compilazione
-- riprendibile e modificabile finché non è finalizzata; le prove derivate
-- restano append-only/ricomputate).
create table public.step_response (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mission_attempt (id) on delete cascade,
  stanza smallint not null check (stanza between 1 and 5),
  step_id text not null,                    -- id dello step nel config TS
  tipo text not null,                       -- scelta_singola, alloca_budget, ... (config-driven)
  payload jsonb not null,                   -- l'azione dello studente
  created_at timestamptz not null default now(),
  unique (attempt_id, step_id)
);
create index step_response_attempt_idx on public.step_response (attempt_id);

alter table public.step_response enable row level security;

-- Ownership tramite l'attempt (nessuna colonna student_id denormalizzata):
-- insert/update verificano che l'attempt sia del chiamante, così nessuno può
-- iniettare risposte nell'attempt di un altro studente.
create policy step_response_select_own on public.step_response
  for select to authenticated using (
    exists (select 1 from public.mission_attempt a
            where a.id = attempt_id and a.student_id = auth.uid())
  );
create policy step_response_insert_own on public.step_response
  for insert to authenticated with check (
    exists (select 1 from public.mission_attempt a
            where a.id = attempt_id and a.student_id = auth.uid())
  );
create policy step_response_update_own on public.step_response
  for update to authenticated using (
    exists (select 1 from public.mission_attempt a
            where a.id = attempt_id and a.student_id = auth.uid())
  ) with check (
    exists (select 1 from public.mission_attempt a
            where a.id = attempt_id and a.student_id = auth.uid())
  );

-- ============ evidence (prova atomica, scrittura SOLO via funzione) ============
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid references public.mission_attempt (id) on delete cascade,  -- null per fonte workshop/activity
  area_slug text check (                                                     -- null per prove trasversali
    area_slug is null or area_slug in (
      'informatica-digitale','salute-professioni-sanitarie','ristorazione-turismo',
      'meccanica-meccatronica','agrifood-ambiente','arte-design-moda','musica-spettacolo',
      'energia-sostenibilita','edilizia-architettura','economia-management','giurisprudenza-pa',
      'mobilita-sostenibile','scienze-educazione','comunicazione-media','scienze-ricerca',
      'sicurezza-difesa','lingue-relazioni-internazionali','studi-umanistici-beni-culturali'
    )
  ),
  dimensione public.escape_dimensione not null,
  valore numeric(4,3) not null check (valore >= 0 and valore <= 1),  -- forza del segnale 0..1
  peso numeric(5,2) not null check (peso > 0),                        -- importanza/affidabilità della prova
  fonte public.escape_fonte not null,
  step_id text,                                                       -- da quale step (null per non-mission)
  motivazione text not null,                                          -- spiegazione leggibile (requisito GDPR)
  created_at timestamptz not null default now()
);
create index evidence_student_area_dim_idx on public.evidence (student_id, area_slug, dimensione);
create index evidence_attempt_idx on public.evidence (attempt_id);

alter table public.evidence enable row level security;

-- Lettura-own consentita (trasparenza GDPR: lo studente può vedere le proprie
-- prove con la loro motivazione — la UI mostra solo la motivazione, mai i
-- numeri grezzi valore/peso). NESSUNA policy insert/update/delete: si scrive
-- solo via registra_evidence() (SECURITY DEFINER), mai dal client.
create policy evidence_select_own on public.evidence
  for select to authenticated using (student_id = auth.uid());

-- ============ area_signal (IL profilo unico, scrittura SOLO via funzione) ============
create table public.area_signal (
  student_id uuid not null references public.profiles (id) on delete cascade,
  area_slug text not null check (
    area_slug in (
      'informatica-digitale','salute-professioni-sanitarie','ristorazione-turismo',
      'meccanica-meccatronica','agrifood-ambiente','arte-design-moda','musica-spettacolo',
      'energia-sostenibilita','edilizia-architettura','economia-management','giurisprudenza-pa',
      'mobilita-sostenibile','scienze-educazione','comunicazione-media','scienze-ricerca',
      'sicurezza-difesa','lingue-relazioni-internazionali','studi-umanistici-beni-culturali'
    )
  ),
  interest_score smallint not null default 0 check (interest_score between 0 and 100),
  performance_score smallint not null default 0 check (performance_score between 0 and 100),
  self_efficacy_score smallint not null default 0 check (self_efficacy_score between 0 and 100),
  curiosity_score smallint not null default 0 check (curiosity_score between 0 and 100),
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  status public.area_signal_status not null default 'emergente',
  updated_at timestamptz not null default now(),
  primary key (student_id, area_slug)
);

alter table public.area_signal enable row level security;

-- Solo lettura-own dal client. Scrittura solo via ricalcola_area_signal()
-- (SECURITY DEFINER). Le letture aggregate scuola/docente sono rinviate.
create policy area_signal_select_own on public.area_signal
  for select to authenticated using (student_id = auth.uid());

-- ============ journal_entry (diario, stanza 5) ============
create table public.journal_entry (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid references public.mission_attempt (id) on delete set null,
  testo text not null,
  created_at timestamptz not null default now()
);
create index journal_entry_student_idx on public.journal_entry (student_id);

alter table public.journal_entry enable row level security;

create policy journal_entry_select_own on public.journal_entry
  for select to authenticated using (student_id = auth.uid());
create policy journal_entry_insert_own on public.journal_entry
  for insert to authenticated with check (student_id = auth.uid());
create policy journal_entry_delete_own on public.journal_entry
  for delete to authenticated using (student_id = auth.uid());

-- ============ portfolio_item (artefatto salvato) ============
create table public.portfolio_item (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid references public.mission_attempt (id) on delete set null,
  titolo text not null,
  contenuto jsonb not null,
  created_at timestamptz not null default now()
);
create index portfolio_item_student_idx on public.portfolio_item (student_id);

alter table public.portfolio_item enable row level security;

create policy portfolio_item_select_own on public.portfolio_item
  for select to authenticated using (student_id = auth.uid());
create policy portfolio_item_insert_own on public.portfolio_item
  for insert to authenticated with check (student_id = auth.uid());
create policy portfolio_item_update_own on public.portfolio_item
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy portfolio_item_delete_own on public.portfolio_item
  for delete to authenticated using (student_id = auth.uid());
