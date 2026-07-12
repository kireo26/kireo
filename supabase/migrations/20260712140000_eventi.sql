-- Eventi (webinar/workshop/altro) con approvazione e organizzatore
-- (istituzione). Sostituisce la migration webinars/webinar_registrations
-- della sessione precedente (mai applicata, quindi rimossa dal repo invece
-- di essere lasciata come doppione morto): eventi è un sovrainsieme —
-- tipo copre webinar, più workshop/altro, con ore PCTO e workflow di
-- approvazione.
--
-- Le aree restano riferite per slug testuale (area_slug + CHECK), come
-- student_area_interests già in produzione: non esiste una tabella `aree`
-- nel DB, le 18 aree reali sono dati statici in data/aree.ts.

create table public.istituzioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

comment on table public.istituzioni is
  'Anagrafica minima delle istituzioni organizzatrici di eventi (solo id+nome). Il catalogo istituzioni completo (piani, profilo pubblico, statistiche) è un cantiere futuro separato — vedi CLAUDE.md, Fase 2 "catalogo istituzioni consultabile".';

alter table public.istituzioni enable row level security;

create policy istituzioni_select_public
  on public.istituzioni for select
  to anon, authenticated
  using (true);

create type public.evento_tipo as enum ('webinar', 'workshop', 'altro');
create type public.evento_stato as enum ('bozza', 'in_approvazione', 'approvato', 'rifiutato');
create type public.iscrizione_stato as enum ('iscritto', 'partecipato', 'assente');

create table public.eventi (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  descrizione text,
  tipo public.evento_tipo not null,
  organizzatore_id uuid references public.istituzioni (id),
  data_inizio timestamptz not null,
  data_fine timestamptz,
  sede text,
  link text,
  posti integer check (posti is null or posti > 0),
  ore_pcto numeric(5, 1) not null default 0 check (ore_pcto >= 0),
  stato public.evento_stato not null default 'bozza',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventi_date_order check (data_fine is null or data_fine >= data_inizio)
);

comment on table public.eventi is
  'Eventi di orientamento (webinar/workshop/altro), organizzati da KIREO o da un''istituzione (organizzatore_id nullable per eventi KIREO). Scrittura riservata a service_role: nessuna policy di insert/update/delete, nessun pannello di gestione in questa fase.';

create index eventi_data_inizio_idx on public.eventi (data_inizio);
create index eventi_stato_idx on public.eventi (stato);

alter table public.eventi enable row level security;

create policy eventi_select_approvati
  on public.eventi for select
  to anon, authenticated
  using (stato = 'approvato');

create table public.eventi_aree (
  evento_id uuid not null references public.eventi (id) on delete cascade,
  area_slug text not null check (
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
  primary key (evento_id, area_slug)
);

comment on table public.eventi_aree is
  'Aree tematiche di un evento. Il limite di 2 aree per evento è applicativo, non un vincolo DB — stesso approccio già usato per il limite di 3 aree di interesse per studente in student_area_interests (nessun trigger di conteggio, per coerenza con quel precedente).';

alter table public.eventi_aree enable row level security;

create policy eventi_aree_select_approvati
  on public.eventi_aree for select
  to anon, authenticated
  using (exists (select 1 from public.eventi e where e.id = eventi_aree.evento_id and e.stato = 'approvato'));

create table public.iscrizioni_eventi (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  evento_id uuid not null references public.eventi (id) on delete cascade,
  stato public.iscrizione_stato not null default 'iscritto',
  created_at timestamptz not null default now(),
  constraint iscrizioni_eventi_unica unique (student_id, evento_id)
);

comment on table public.iscrizioni_eventi is
  'Iscrizioni di uno studente a un evento. Lo stato oltre "iscritto" (partecipato/assente) è aggiornato da KIREO — nessun pannello self-service in questa fase; lo studente può solo iscriversi o cancellare la propria iscrizione.';

create index iscrizioni_eventi_evento_id_idx on public.iscrizioni_eventi (evento_id);

alter table public.iscrizioni_eventi enable row level security;

create policy iscrizioni_eventi_select_own
  on public.iscrizioni_eventi for select
  to authenticated
  using (student_id = auth.uid());

create policy iscrizioni_eventi_insert_own
  on public.iscrizioni_eventi for insert
  to authenticated
  with check (student_id = auth.uid());

create policy iscrizioni_eventi_delete_own
  on public.iscrizioni_eventi for delete
  to authenticated
  using (student_id = auth.uid());
