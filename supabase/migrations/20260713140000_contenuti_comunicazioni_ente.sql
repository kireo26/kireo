-- Contenuti e comunicazioni delle istituzioni: guide scaricabili,
-- iscrizioni newsletter, il "recinto" (quali istituzioni conoscono, in
-- aggregato, quale studente — mai esposto riga per riga a un'istituzione,
-- vedi stats_istituzione), e le comunicazioni in coda di approvazione.

create table public.guide_enti (
  id uuid primary key default gen_random_uuid(),
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  titolo text not null,
  pdf_url text not null,
  created_at timestamptz not null default now()
);

alter table public.guide_enti enable row level security;

create policy guide_enti_select_pubblico
  on public.guide_enti for select
  to anon, authenticated
  using (exists (select 1 from public.istituzioni i where i.id = guide_enti.istituzione_id and i.stato = 'attiva'));

create policy guide_enti_select_propria
  on public.guide_enti for select
  to authenticated
  using (istituzione_id = public.current_istituzione_id());

create policy guide_enti_insert_propria
  on public.guide_enti for insert
  to authenticated
  with check (istituzione_id = public.current_istituzione_id());

create policy guide_enti_update_propria
  on public.guide_enti for update
  to authenticated
  using (istituzione_id = public.current_istituzione_id())
  with check (istituzione_id = public.current_istituzione_id());

create policy guide_enti_delete_propria
  on public.guide_enti for delete
  to authenticated
  using (istituzione_id = public.current_istituzione_id());

create policy guide_enti_admin_tutto
  on public.guide_enti for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

create table public.newsletter_iscrizioni (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint newsletter_iscrizioni_unica unique (student_id, istituzione_id)
);

comment on table public.newsletter_iscrizioni is
  'Iscrizioni di uno studente alla newsletter di un''istituzione. Nessuna policy per il ruolo istituzione: il principio "i dati degli studenti non escono mai da KIREO" vale anche per il solo conteggio riga per riga, non solo per l''export — le istituzioni vedono solo l''aggregato in stats_istituzione.';

alter table public.newsletter_iscrizioni enable row level security;

create policy newsletter_iscrizioni_select_own
  on public.newsletter_iscrizioni for select
  to authenticated
  using (student_id = auth.uid());

create policy newsletter_iscrizioni_insert_own
  on public.newsletter_iscrizioni for insert
  to authenticated
  with check (student_id = auth.uid());

create policy newsletter_iscrizioni_delete_own
  on public.newsletter_iscrizioni for delete
  to authenticated
  using (student_id = auth.uid());

create type public.recinto_origine as enum ('guida', 'newsletter', 'evento');

create table public.recinto_enti (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  origine public.recinto_origine not null,
  created_at timestamptz not null default now(),
  constraint recinto_enti_unica unique (student_id, istituzione_id)
);

comment on table public.recinto_enti is
  'Traccia quali istituzioni "conoscono" (in aggregato) uno studente: popolata da download guida, iscrizione newsletter, iscrizione a un evento dell''ente — logica applicativa (upsert con ON CONFLICT DO NOTHING sulla coppia studente+istituzione, per non perdere la prima origine se lo studente interagisce più volte). Stessa regola di newsletter_iscrizioni: nessuna policy per il ruolo istituzione, solo aggregati via stats_istituzione.';

alter table public.recinto_enti enable row level security;

create policy recinto_enti_select_own
  on public.recinto_enti for select
  to authenticated
  using (student_id = auth.uid());

create policy recinto_enti_insert_own
  on public.recinto_enti for insert
  to authenticated
  with check (student_id = auth.uid());

create type public.comunicazione_tipo as enum ('newsletter', 'comunicazione_kireo');
create type public.comunicazione_stato as enum ('bozza', 'in_approvazione', 'approvata', 'rifiutata', 'inviata');

create table public.comunicazioni (
  id uuid primary key default gen_random_uuid(),
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  tipo public.comunicazione_tipo not null,
  oggetto text not null,
  corpo text not null,
  stato public.comunicazione_stato not null default 'bozza',
  note_revisione text,
  created_at timestamptz not null default now()
);

comment on table public.comunicazioni is
  'Comunicazioni proposte da un''istituzione (newsletter o, se piano premium, comunicazione mirata): l''ente propone, KIREO approva e veicola — mai un invio diretto self-service. Fase 1: solo creazione e coda di approvazione, l''invio reale (stato "inviata") è Fase 2.';

alter table public.comunicazioni enable row level security;

create policy comunicazioni_select_propria
  on public.comunicazioni for select
  to authenticated
  using (istituzione_id = public.current_istituzione_id());

-- L'ente può creare/modificare solo mentre è bozza o appena inviata in
-- approvazione: non può mai scrivere approvata/rifiutata/inviata (il
-- WITH CHECK lo impedisce a livello di valore, non solo di riga).
create policy comunicazioni_insert_propria
  on public.comunicazioni for insert
  to authenticated
  with check (istituzione_id = public.current_istituzione_id() and stato in ('bozza', 'in_approvazione'));

create policy comunicazioni_update_propria_non_revisionata
  on public.comunicazioni for update
  to authenticated
  using (istituzione_id = public.current_istituzione_id() and stato in ('bozza', 'in_approvazione'))
  with check (istituzione_id = public.current_istituzione_id() and stato in ('bozza', 'in_approvazione'));

create policy comunicazioni_admin_tutto
  on public.comunicazioni for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');
