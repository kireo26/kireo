-- Proposte di incontro scuola->ente (2/2). Disponibile a TUTTI i piani
-- ente, Free incluso (ricevere e accettare proposte genera contenuto ed
-- engagement, è il motore del marketplace, non una leva di piano). Tutte
-- le scritture passano da funzioni SECURITY DEFINER (autorizzazione
-- incrociata scuola/ente/permesso/stato, non esprimibile in RLS pura,
-- stesso principio già in uso per iscrivi_classe_evento/certifica_presenza
-- nell'area scuola).

create type public.proposta_incontro_stato as enum ('inviata', 'accettata', 'rifiutata', 'ritirata');
create type public.proposta_incontro_modalita as enum ('online');

create table public.proposte_incontro (
  id uuid primary key default gen_random_uuid(),
  scuola_profilo_id uuid not null references public.scuole_profili (id) on delete cascade,
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  proposta_da uuid not null references public.profiles (id),
  aree text[] not null default '{}',
  descrizione text not null check (char_length(descrizione) <= 1000 and char_length(btrim(descrizione)) > 0),
  n_studenti_stimato integer check (n_studenti_stimato is null or n_studenti_stimato > 0),
  classi_coinvolte text,
  date_preferite text,
  modalita public.proposta_incontro_modalita not null default 'online',
  stato public.proposta_incontro_stato not null default 'inviata',
  risposta_ente text check (risposta_ente is null or char_length(risposta_ente) <= 1000),
  created_at timestamptz not null default now(),
  risposta_il timestamptz
);

comment on table public.proposte_incontro is
  'La scuola (referente/tutor con permesso gestione_classi) propone un incontro di orientamento a un ente dalla card Esplora. All''accettazione l''ente crea l''evento webinar collegato (eventi.proposta_incontro_id sotto), che segue il flusso normale di revisione KIREO — nessuna scorciatoia.';

-- Max 1 proposta ATTIVA (inviata o accettata) per coppia scuola-ente: uno
-- storico di proposte risolte nel tempo (rifiutate/ritirate) resta
-- possibile, stesso principio dell''indice parziale già usato per
-- richieste_upgrade/manifestazioni_interesse.
create unique index proposte_incontro_attiva_coppia_idx
  on public.proposte_incontro (scuola_profilo_id, istituzione_id)
  where stato in ('inviata', 'accettata');

create index proposte_incontro_scuola_idx on public.proposte_incontro (scuola_profilo_id);
create index proposte_incontro_istituzione_idx on public.proposte_incontro (istituzione_id);

alter table public.proposte_incontro enable row level security;

create policy proposte_incontro_select_scuola
  on public.proposte_incontro for select
  to authenticated
  using (scuola_profilo_id = public.current_scuola_profilo_id());

create policy proposte_incontro_select_ente
  on public.proposte_incontro for select
  to authenticated
  using (istituzione_id = public.current_istituzione_id());

create policy proposte_incontro_admin_tutto
  on public.proposte_incontro for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- ============ evento collegato ============
-- Nullable, valorizzato dall'ente quando crea l'evento a valle di una
-- proposta accettata: solo un riferimento per la tracciabilità, nessuna
-- scorciatoia sul flusso di approvazione dell'evento (resta identico).
alter table public.eventi
  add column proposta_incontro_id uuid references public.proposte_incontro (id);

-- ============ creazione (solo referente/tutor con permesso gestione_classi) ============
create or replace function public.crea_proposta_incontro(
  p_istituzione_id uuid,
  p_aree text[],
  p_descrizione text,
  p_n_studenti_stimato integer,
  p_classi_coinvolte text,
  p_date_preferite text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scuola_profilo_id uuid := public.current_scuola_profilo_id();
  v_conteggio integer;
  v_id uuid;
begin
  if not public.current_ha_permesso_staff('gestione_classi') then
    raise exception 'non_autorizzato';
  end if;
  if v_scuola_profilo_id is null then
    raise exception 'non_autorizzato';
  end if;
  if not exists (select 1 from public.istituzioni where id = p_istituzione_id and stato = 'attiva') then
    raise exception 'ente_non_disponibile';
  end if;

  select count(*) into v_conteggio
  from public.proposte_incontro
  where scuola_profilo_id = v_scuola_profilo_id and stato in ('inviata', 'accettata');

  if v_conteggio >= 5 then
    raise exception 'troppe_proposte_attive';
  end if;

  insert into public.proposte_incontro (scuola_profilo_id, istituzione_id, proposta_da, aree, descrizione, n_studenti_stimato, classi_coinvolte, date_preferite)
  values (v_scuola_profilo_id, p_istituzione_id, auth.uid(), coalesce(p_aree, array[]::text[]), p_descrizione, p_n_studenti_stimato, p_classi_coinvolte, p_date_preferite)
  returning id into v_id;

  insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
  select ip.user_id, 'proposta_incontro_ricevuta', v_id
  from public.institution_profiles ip
  where ip.istituzione_id = p_istituzione_id;

  return v_id;
end;
$$;

grant execute on function public.crea_proposta_incontro(uuid, text[], text, integer, text, text) to authenticated;

-- ============ risposta (solo l'ente destinatario) ============
create or replace function public.rispondi_proposta_incontro(p_proposta_id uuid, p_accetta boolean, p_risposta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_istituzione_id uuid;
  v_proposta_da uuid;
  v_stato public.proposta_incontro_stato;
begin
  select istituzione_id, proposta_da, stato into v_istituzione_id, v_proposta_da, v_stato
  from public.proposte_incontro where id = p_proposta_id;

  if v_istituzione_id is null then
    raise exception 'proposta_non_trovata';
  end if;
  if v_istituzione_id <> public.current_istituzione_id() then
    raise exception 'non_autorizzato';
  end if;
  if v_stato <> 'inviata' then
    raise exception 'proposta_gia_gestita';
  end if;

  update public.proposte_incontro
  set stato = (case when p_accetta then 'accettata' else 'rifiutata' end)::public.proposta_incontro_stato,
      risposta_ente = p_risposta,
      risposta_il = now()
  where id = p_proposta_id;

  insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
  values (v_proposta_da, 'proposta_incontro_risposta', p_proposta_id);
end;
$$;

grant execute on function public.rispondi_proposta_incontro(uuid, boolean, text) to authenticated;

-- ============ ritiro (solo la scuola proponente, solo se ancora inviata) ============
create or replace function public.ritira_proposta_incontro(p_proposta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.proposte_incontro
  set stato = 'ritirata'
  where id = p_proposta_id and scuola_profilo_id = public.current_scuola_profilo_id() and stato = 'inviata';

  if not found then
    raise exception 'non_autorizzato_o_gia_gestita';
  end if;
end;
$$;

grant execute on function public.ritira_proposta_incontro(uuid) to authenticated;
