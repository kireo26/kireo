-- Log delle attività di esplorazione per area (alimenta il radar
-- attitudinale via la vista score_aree). Un cap di una riga al giorno per
-- (studente, area, tipo attività) è applicato con un indice unico
-- sull'espressione created_at::date — un vincolo DB reale, non solo
-- applicativo: un secondo tentativo nello stesso giorno viola l'unicità
-- (23505) e va trattato come "già registrato oggi", non un errore.

create type public.tipo_attivita as enum (
  'visita_area',
  'lettura_articolo',
  'chat_assistente',
  'download_guida',
  'iscrizione_webinar',
  'partecipazione_webinar',
  'workshop_pcto'
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
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
  tipo_attivita public.tipo_attivita not null,
  peso integer not null check (peso > 0),
  created_at timestamptz not null default now()
);

comment on table public.activity_log is
  'Traccia le attività di esplorazione dello studente per area, con un peso per attività (vedi lib/app/activityLog.ts per i valori: visita_area 1, lettura_articolo 2, chat_assistente 3, download_guida 5, iscrizione_webinar 8, partecipazione_webinar 15, workshop_pcto 25). Alimenta la vista score_aree e il radar attitudinale.';

-- created_at::date non è IMMUTABLE (dipende dal timezone di sessione), non
-- ammesso in un'espressione di indice: fissato al timezone UTC, così
-- l'espressione diventa deterministica indipendentemente da chi scrive.
create unique index activity_log_cap_giornaliero_idx
  on public.activity_log (student_id, area_slug, tipo_attivita, ((created_at at time zone 'utc')::date));

create index activity_log_student_area_idx on public.activity_log (student_id, area_slug);

alter table public.activity_log enable row level security;

create policy activity_log_select_own
  on public.activity_log for select
  to authenticated
  using (student_id = auth.uid());

create policy activity_log_insert_own
  on public.activity_log for insert
  to authenticated
  with check (student_id = auth.uid());

-- security_invoker: la vista viene eseguita con i permessi/RLS di chi la
-- interroga (quindi soggetta alle stesse policy select-own di
-- activity_log), non con quelli del proprietario della vista — altrimenti
-- rischierebbe di esporre il punteggio di tutti gli studenti a chiunque.
create view public.score_aree
with (security_invoker = true) as
select student_id, area_slug, sum(peso)::integer as punteggio
from public.activity_log
group by student_id, area_slug;

comment on view public.score_aree is 'Punteggio di esplorazione per studente+area (somma dei pesi in activity_log), usato dal radar attitudinale. Normalizzazione semplice sul massimo dello studente lato applicazione; nessun decay temporale in questa versione.';
