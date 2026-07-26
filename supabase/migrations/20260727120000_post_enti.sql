-- Livello social (3/8): bacheca — post degli enti, con revisione KIREO.
-- Stesso principio già in uso per eventi (insert/update self-service con
-- WITH CHECK, fair-use in coda, admin_tutto): niente di nuovo
-- architetturalmente, solo un nuovo contenuto tipizzato (testo/immagine/
-- link_social) con un gate di piano sull'embed social.

create type public.post_ente_tipo as enum ('testo', 'immagine', 'link_social');
create type public.post_ente_stato as enum ('in_approvazione', 'approvato', 'rifiutato');

create table public.post_enti (
  id uuid primary key default gen_random_uuid(),
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  tipo public.post_ente_tipo not null,
  corpo text not null check (char_length(corpo) <= 2000 and char_length(btrim(corpo)) > 0),
  immagine_url text,
  embed_url text,
  stato public.post_ente_stato not null default 'in_approvazione',
  motivo_rifiuto text,
  approvato_da uuid references public.profiles (id),
  approvato_il timestamptz,
  created_at timestamptz not null default now(),
  constraint post_enti_coerenza_tipo check (
    (tipo = 'testo' and immagine_url is null and embed_url is null)
    or (tipo = 'immagine' and immagine_url is not null and embed_url is null)
    or (
      tipo = 'link_social'
      and immagine_url is null
      and embed_url is not null
      and embed_url ~* '^https://(www\.)?(instagram\.com|tiktok\.com)/'
    )
  )
);

comment on table public.post_enti is
  'Post di bacheca proposti dagli enti, con revisione KIREO (stesso schema in_approvazione/approvato/rifiutato di eventi/comunicazioni). tipo=link_social (embed Instagram/TikTok) è riservato ai piani a pagamento, applicato sia lato client sia nella policy insert sotto (difesa in profondità).';

create index post_enti_istituzione_idx on public.post_enti (istituzione_id);
create index post_enti_stato_created_idx on public.post_enti (stato, created_at desc);

alter table public.post_enti enable row level security;

-- L'ente propone (sempre in_approvazione alla creazione), mai in stato
-- diverso, mai per un'altra istituzione — e l'embed social solo se il
-- piano attivo non è free (gate server-side, oltre a quello lato form).
create policy post_enti_insert_propria
  on public.post_enti for insert
  to authenticated
  with check (
    istituzione_id = public.current_istituzione_id()
    and stato = 'in_approvazione'
    and (
      tipo <> 'link_social'
      or exists (
        select 1 from public.istituzioni i
        join public.piani p on p.id = i.piano_id
        where i.id = post_enti.istituzione_id and p.nome <> 'free'
      )
    )
  );

-- L'ente vede sempre i propri post (qualunque stato, per "i miei post con
-- stati"); chiunque (anche anonimo) vede solo gli approvati (feed
-- pubblico/studente); admin tutto.
create policy post_enti_select_propria
  on public.post_enti for select
  to authenticated
  using (istituzione_id = public.current_istituzione_id());

create policy post_enti_select_pubblico_approvati
  on public.post_enti for select
  to anon, authenticated
  using (stato = 'approvato');

create policy post_enti_admin_tutto
  on public.post_enti for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Nessuna policy update/delete self-service: un post proposto non si
-- modifica (niente form di modifica richiesto), solo admin decide.

-- ============ fair use: max 3 post in_approvazione per ente ============
-- Stesso identico principio di limite_eventi_in_approvazione (soglia 4 per
-- gli eventi), qui a 3.
create or replace function public.limite_post_in_approvazione()
returns trigger
language plpgsql
as $$
declare
  v_conteggio integer;
begin
  if new.istituzione_id is not null and new.stato = 'in_approvazione' then
    select count(*) into v_conteggio
    from public.post_enti
    where istituzione_id = new.istituzione_id
      and stato = 'in_approvazione'
      and id is distinct from new.id;

    if v_conteggio >= 3 then
      raise exception 'troppi_post_in_revisione';
    end if;
  end if;

  return new;
end;
$$;

create trigger limite_post_in_approvazione
before insert on public.post_enti
for each row execute function public.limite_post_in_approvazione();
