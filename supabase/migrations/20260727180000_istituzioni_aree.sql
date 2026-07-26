-- Esplora — ricerca enti per area (aggiunta alla build del livello
-- social). L'ente propone fino a 3 aree di competenza (18 aree di
-- orientamento; per un'istituzione tipo=formazione_docenti, i 5 filoni
-- docenti — stesso taxonomy slot, valori diversi), soggette a revisione
-- KIREO come il resto dei contenuti pubblici dell'ente (a differenza dei
-- campi descrittivi del profilo, self-service senza revisione: le aree
-- guidano il matching verso gli studenti, un errore qui è più simile a un
-- contenuto pubblico che a un dettaglio descrittivo).

create type public.istituzione_area_stato as enum ('in_approvazione', 'approvata', 'rifiutata');

create table public.istituzioni_aree (
  id uuid primary key default gen_random_uuid(),
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  area_slug text not null check (
    area_slug in (
      'informatica-digitale', 'salute-professioni-sanitarie', 'ristorazione-turismo', 'meccanica-meccatronica',
      'agrifood-ambiente', 'arte-design-moda', 'musica-spettacolo', 'energia-sostenibilita', 'edilizia-architettura',
      'economia-management', 'giurisprudenza-pa', 'mobilita-sostenibile', 'scienze-educazione', 'comunicazione-media',
      'scienze-ricerca', 'sicurezza-difesa', 'lingue-relazioni-internazionali', 'studi-umanistici-beni-culturali',
      'ai_didattica', 'valutazione_ai', 'etica_normativa', 'ai_burocrazia', 'orientamento_pcto'
    )
  ),
  stato public.istituzione_area_stato not null default 'in_approvazione',
  created_at timestamptz not null default now(),
  constraint istituzioni_aree_unica unique (istituzione_id, area_slug)
);

comment on table public.istituzioni_aree is
  'Aree di competenza (o filoni, per formazione_docenti) proposte dall''ente, in revisione KIREO. Solo le righe stato=approvata alimentano /app/esplora e la sezione "Enti di quest''area" su /app/aree/[slug] — le formazione_docenti non compaiono comunque in quelle superfici (scoped a chi offre percorsi post-diploma, il tagging qui serve solo alla loro categorizzazione interna).';

create index istituzioni_aree_area_idx on public.istituzioni_aree (area_slug, stato);

alter table public.istituzioni_aree enable row level security;

create policy istituzioni_aree_insert_propria
  on public.istituzioni_aree for insert
  to authenticated
  with check (istituzione_id = public.current_istituzione_id() and stato = 'in_approvazione');

create policy istituzioni_aree_select_propria
  on public.istituzioni_aree for select
  to authenticated
  using (istituzione_id = public.current_istituzione_id());

create policy istituzioni_aree_select_pubblico_approvate
  on public.istituzioni_aree for select
  to anon, authenticated
  using (stato = 'approvata');

create policy istituzioni_aree_delete_propria
  on public.istituzioni_aree for delete
  to authenticated
  using (istituzione_id = public.current_istituzione_id());

create policy istituzioni_aree_admin_tutto
  on public.istituzioni_aree for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Max 3 aree "attive" (proposte o approvate, una rifiutata non conta) per
-- istituzione — stesso principio del fair-use eventi/post, qui sul totale
-- anziché sulla sola coda di revisione.
create or replace function public.limite_aree_istituzione()
returns trigger
language plpgsql
as $$
declare
  v_conteggio integer;
begin
  select count(*) into v_conteggio
  from public.istituzioni_aree
  where istituzione_id = new.istituzione_id and stato <> 'rifiutata';

  if v_conteggio >= 3 then
    raise exception 'troppe_aree_istituzione';
  end if;

  return new;
end;
$$;

create trigger limite_aree_istituzione
before insert on public.istituzioni_aree
for each row execute function public.limite_aree_istituzione();

-- ============ bootstrap per gli enti esistenti ============
-- Deriva fino a 3 aree per istituzione dalle aree dei loro eventi già
-- approvati (le più frequenti prima), impostate direttamente come
-- approvata: è KIREO (questa migration) a scriverle, non l'ente in
-- self-service, quindi non serve farle passare dalla coda di revisione.
insert into public.istituzioni_aree (istituzione_id, area_slug, stato)
select ranked.organizzatore_id, ranked.area_slug, 'approvata'
from (
  select
    e.organizzatore_id,
    ea.area_slug,
    row_number() over (partition by e.organizzatore_id order by count(*) desc, ea.area_slug) as rn
  from public.eventi e
  join public.eventi_aree ea on ea.evento_id = e.id
  where e.stato = 'approvato' and e.organizzatore_id is not null
  group by e.organizzatore_id, ea.area_slug
) ranked
where ranked.rn <= 3
on conflict (istituzione_id, area_slug) do nothing;
