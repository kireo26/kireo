-- Schema dati per l'area privata KIREO: profili, scuole, convenzioni PCTO,
-- codici classe e le tabelle di attività predisposte per il futuro.

-- profiles: estende auth.users con dati anagrafici e ruolo applicativo.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  ruolo public.profile_role not null,
  nome text not null,
  cognome text not null,
  data_nascita date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profilo applicativo di ogni utente KIREO, 1:1 con auth.users.';

-- schools: anagrafica scuole secondarie superiori (dataset MIM), stessa
-- fonte usata dai menu a cascata pubblici.
create table public.schools (
  codice_meccanografico text primary key,
  denominazione text not null,
  comune text,
  provincia text not null,
  tipo_istituto public.tipo_istituto not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.schools is 'Anagrafica scuole secondarie superiori (dataset MIM). comune è nullable: il CSV grezzo attualmente disponibile non ha questa colonna popolata per tutte le scuole, vedi CLAUDE.md.';

create index schools_provincia_idx on public.schools (provincia);

-- student_profiles: dati specifici per il ruolo studente.
create table public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  school_code text not null references public.schools (codice_meccanografico),
  classe text not null,
  anno_diploma integer not null check (anno_diploma between 2000 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_profiles_school_code_idx on public.student_profiles (school_code);

-- teacher_profiles: dati specifici per i ruoli docente e referente_scuola
-- (entrambi collegati a una scuola tramite codice meccanografico; materia
-- non si applica al referente, per questo è nullable).
create table public.teacher_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  school_code text not null references public.schools (codice_meccanografico),
  materia text,
  is_referente_orientamento boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_profiles_school_code_idx on public.teacher_profiles (school_code);

-- conventions: convenzione PCTO tra KIREO e una scuola.
create table public.conventions (
  id uuid primary key default gen_random_uuid(),
  school_code text not null references public.schools (codice_meccanografico),
  stato public.convention_status not null default 'in_attesa',
  data_inizio date,
  data_fine date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conventions_date_order check (data_fine is null or data_inizio is null or data_fine >= data_inizio)
);

create index conventions_school_code_idx on public.conventions (school_code);

-- class_codes: codice univoco leggibile (formato KIREO-XXXX) che una classe
-- usa per collegarsi alla convenzione della propria scuola.
create table public.class_codes (
  codice text primary key check (codice ~ '^KIREO-[A-Z0-9]{4}$'),
  convention_id uuid not null references public.conventions (id) on delete cascade,
  classe text not null,
  attivo boolean not null default true,
  max_usi integer not null check (max_usi > 0),
  usi_correnti integer not null default 0 check (usi_correnti >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_codes_usi_entro_max check (usi_correnti <= max_usi)
);

create index class_codes_convention_id_idx on public.class_codes (convention_id);
create index class_codes_classe_idx on public.class_codes (classe);

-- activities: catalogo attività di orientamento, predisposto per il futuro
-- (solo struttura, nessun flusso applicativo in questa fase).
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  tipo text not null,
  area text,
  ore_pcto numeric(5, 1) not null default 0 check (ore_pcto >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- student_activities: partecipazione di uno studente a un'attività,
-- predisposta per il futuro (solo struttura).
create table public.student_activities (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (user_id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  stato public.student_activity_status not null default 'assegnata',
  ore_certificate numeric(5, 1) not null default 0 check (ore_certificate >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_activities_unique unique (student_id, activity_id)
);

create index student_activities_student_id_idx on public.student_activities (student_id);
create index student_activities_activity_id_idx on public.student_activities (activity_id);
