-- Agenda webinar (Fase 4 dell'area studente): catalogo webinar e
-- prenotazioni. Stesso pattern di student_area_interests per il CHECK su
-- area_slug (18 aree reali di data/aree.ts, va aggiornato in una nuova
-- migration se l'elenco cambia) e per le RLS "solo proprie righe".

create table public.webinars (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  descrizione text,
  area_slug text check (
    area_slug in (
      'informatica-digitale',
      'salute-professioni-sanitarie',
      'ristorazione-turismo',
      'meccanica-meccatronica',
      'agrifood-ambiente',
      'arte-design-moda',
      'musica-spettacolo',
      'energia-sostenibilita',
      'edilizia-architettura',
      'economia-management',
      'giurisprudenza-pa',
      'mobilita-sostenibile',
      'scienze-educazione',
      'comunicazione-media',
      'scienze-ricerca',
      'sicurezza-difesa',
      'lingue-relazioni-internazionali',
      'studi-umanistici-beni-culturali'
    )
  ),
  data_ora timestamptz not null,
  durata_min integer not null check (durata_min > 0),
  link_partecipazione text,
  pubblicato boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.webinars is
  'Catalogo webinar di orientamento (Agenda, area studente). Scrittura riservata a service_role: nessuna policy di insert/update/delete.';

create index webinars_data_ora_idx on public.webinars (data_ora);

alter table public.webinars enable row level security;

-- Lettura pubblica dei soli webinar pubblicati, stesso pattern di
-- schools_select_public: serve anche a chi non è ancora autenticato in
-- futuro (oggi l'Agenda vive solo sotto /app, ma la policy non lo presume).
create policy webinars_select_public
  on public.webinars for select
  to anon, authenticated
  using (pubblicato = true);

create table public.webinar_registrations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  webinar_id uuid not null references public.webinars (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, webinar_id)
);

comment on table public.webinar_registrations is 'Prenotazioni di uno studente a un webinar (Agenda, area studente).';

alter table public.webinar_registrations enable row level security;

create policy webinar_registrations_select_own
  on public.webinar_registrations for select
  to authenticated
  using (user_id = auth.uid());

create policy webinar_registrations_insert_own
  on public.webinar_registrations for insert
  to authenticated
  with check (user_id = auth.uid());

-- Consente di annullare una prenotazione (bottone "Prenotato" a toggle),
-- stesso pattern di student_area_interests_delete_own.
create policy webinar_registrations_delete_own
  on public.webinar_registrations for delete
  to authenticated
  using (user_id = auth.uid());
