-- Piani per le istituzioni formative: free (gratis), plus, premium. Le
-- quote sono per anno accademico (settembre-agosto), calcolate lato
-- applicazione — la tabella contiene solo i limiti, non il conteggio.

create type public.piano_nome as enum ('free', 'plus', 'premium');

create table public.piani (
  id uuid primary key default gen_random_uuid(),
  nome public.piano_nome not null unique,
  prezzo_min numeric(8, 2) not null default 0,
  prezzo_max numeric(8, 2) not null default 0,
  quota_webinar_anno integer not null,
  quota_newsletter integer not null,
  quota_cta_esterne integer not null,
  quota_comunicazioni_kireo integer not null,
  created_at timestamptz not null default now()
);

comment on table public.piani is
  'I 3 piani delle istituzioni formative. Pagare aumenta visibilità e strumenti (quote più alte), mai accesso privilegiato ai dati degli studenti — vedi CLAUDE.md.';

alter table public.piani enable row level security;

-- Lettura pubblica: serve al confronto piani su /per-le-istituzioni e alla
-- dashboard ente per mostrare quota/utilizzo.
create policy piani_select_public
  on public.piani for select
  to anon, authenticated
  using (true);

-- Prezzi: quelli già comunicati pubblicamente su /per-le-istituzioni prima
-- di questa migration (ex "Standard" 290€/anno, ex "Premium" 590€/anno),
-- solo i nomi dei piani cambiano (free/plus/premium invece di
-- Base/Standard/Premium).
insert into public.piani (nome, prezzo_min, prezzo_max, quota_webinar_anno, quota_newsletter, quota_cta_esterne, quota_comunicazioni_kireo) values
  ('free', 0, 0, 3, 0, 0, 0),
  ('plus', 290, 290, 5, 2, 1, 0),
  ('premium', 590, 590, 15, 5, 5, 5);
