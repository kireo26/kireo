-- Risorse scaricabili per filone (upload da admin in questa fase — "per
-- gli enti in v2" per esplicita nota del compito) e newsletter docenti
-- (un'unica newsletter KIREO-wide, non per istituzione: a differenza di
-- newsletter_iscrizioni — quella è per-ente — qui non serve una FK a
-- istituzioni).

create table public.risorse_docenti (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  descrizione text,
  filone public.filone_docenti not null,
  file_url text,
  pubblicata boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.risorse_docenti is
  'Materiali scaricabili per filone di formazione docenti. Upload/pubblicazione riservati ad admin in questa fase (nessun pannello enti, v2 futura). pubblicata=false finché non è pronta per la lista pubblica /docente/risorse.';

alter table public.risorse_docenti enable row level security;

create policy risorse_docenti_select_pubblicate
  on public.risorse_docenti for select
  to authenticated
  using (pubblicata = true);

create policy risorse_docenti_admin_tutto
  on public.risorse_docenti for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

create table public.newsletter_docenti (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  iscritto_il timestamptz not null default now()
);

comment on table public.newsletter_docenti is
  'Consenso esplicito alla newsletter KIREO per i docenti (iscrizione/disiscrizione self-service dal Profilo). Nessun invio email reale in questa fase, vedi CLAUDE.md.';

alter table public.newsletter_docenti enable row level security;

create policy newsletter_docenti_select_own
  on public.newsletter_docenti for select
  to authenticated
  using (user_id = auth.uid());

create policy newsletter_docenti_insert_own
  on public.newsletter_docenti for insert
  to authenticated
  with check (user_id = auth.uid());

create policy newsletter_docenti_delete_own
  on public.newsletter_docenti for delete
  to authenticated
  using (user_id = auth.uid());

create policy newsletter_docenti_admin_select
  on public.newsletter_docenti for select
  to authenticated
  using (public.current_ruolo() = 'admin');
