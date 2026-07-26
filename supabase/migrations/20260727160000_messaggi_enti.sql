-- Livello social (7/8): messaggi studente -> ente, riservati ai
-- maggiorenni e ai piani a pagamento (lato ente). Solo lo studente può
-- APRIRE una conversazione; l'ente può solo rispondere in conversazioni
-- già esistenti. Tutte le scritture passano da funzioni SECURITY DEFINER
-- (autorizzazione incrociata studente/ente/piano/stato, non esprimibile in
-- RLS pura) — nessuna policy insert/update self-service sulle due tabelle,
-- stesso principio già in uso per iscrizioni_classe_eventi/certifica_
-- presenza nell'area scuola.

create type public.conversazione_ente_stato as enum ('aperta', 'bloccata_da_studente', 'chiusa_da_admin');
create type public.messaggio_ente_mittente as enum ('studente', 'ente');

create table public.conversazioni_enti (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  stato public.conversazione_ente_stato not null default 'aperta',
  created_at timestamptz not null default now()
);

comment on table public.conversazioni_enti is
  'stato aperta -> bloccata_da_studente (blocca-e-segnala: l''ente non può più scrivere, la conversazione resta visibile ad admin per l''ispezione) o chiusa_da_admin (chiusura forzata). Una volta uscita da "aperta" nessuna delle due parti può più scrivere (freeze simmetrico, scelta deliberata per semplicità: non solo l''ente bloccato).';

create index conversazioni_enti_student_idx on public.conversazioni_enti (student_id);
create index conversazioni_enti_istituzione_idx on public.conversazioni_enti (istituzione_id);

create table public.messaggi_enti (
  id uuid primary key default gen_random_uuid(),
  conversazione_id uuid not null references public.conversazioni_enti (id) on delete cascade,
  mittente public.messaggio_ente_mittente not null,
  corpo text not null check (char_length(corpo) <= 2000 and char_length(btrim(corpo)) > 0),
  created_at timestamptz not null default now(),
  letta boolean not null default false
);

create index messaggi_enti_conversazione_idx on public.messaggi_enti (conversazione_id, created_at);

alter table public.conversazioni_enti enable row level security;
alter table public.messaggi_enti enable row level security;

create policy conversazioni_enti_select_partecipante
  on public.conversazioni_enti for select
  to authenticated
  using (student_id = auth.uid() or istituzione_id = public.current_istituzione_id());

create policy conversazioni_enti_admin_tutto
  on public.conversazioni_enti for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

create policy messaggi_enti_select_partecipante
  on public.messaggi_enti for select
  to authenticated
  using (
    exists (
      select 1 from public.conversazioni_enti c
      where c.id = messaggi_enti.conversazione_id
        and (c.student_id = auth.uid() or c.istituzione_id = public.current_istituzione_id())
    )
  );

create policy messaggi_enti_admin_tutto
  on public.messaggi_enti for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- ============ apertura conversazione (solo studente maggiorenne) ============
create or replace function public.apri_conversazione_ente(p_istituzione_id uuid, p_corpo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conteggio_oggi integer;
  v_conversazione_id uuid;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;
  if not public.current_e_maggiorenne() then
    raise exception 'solo_maggiorenni';
  end if;
  if not exists (select 1 from public.istituzioni where id = p_istituzione_id and stato = 'attiva') then
    raise exception 'ente_non_disponibile';
  end if;

  select count(*) into v_conteggio_oggi
  from public.conversazioni_enti
  where student_id = v_uid
    and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;

  if v_conteggio_oggi >= 5 then
    raise exception 'troppe_conversazioni_oggi';
  end if;

  insert into public.conversazioni_enti (student_id, istituzione_id)
  values (v_uid, p_istituzione_id)
  returning id into v_conversazione_id;

  insert into public.messaggi_enti (conversazione_id, mittente, corpo)
  values (v_conversazione_id, 'studente', p_corpo);

  return v_conversazione_id;
end;
$$;

grant execute on function public.apri_conversazione_ente(uuid, text) to authenticated;

-- ============ invio messaggio (studente maggiorenne o ente a pagamento, solo su conversazione aperta) ============
create or replace function public.invia_messaggio_ente(p_conversazione_id uuid, p_corpo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_istituzione_id uuid;
  v_stato public.conversazione_ente_stato;
  v_mittente public.messaggio_ente_mittente;
  v_conteggio_oggi integer;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  select student_id, istituzione_id, stato into v_student_id, v_istituzione_id, v_stato
  from public.conversazioni_enti where id = p_conversazione_id;

  if v_student_id is null then
    raise exception 'conversazione_non_trovata';
  end if;

  if v_uid = v_student_id then
    if not public.current_e_maggiorenne() then
      raise exception 'solo_maggiorenni';
    end if;
    v_mittente := 'studente';
  elsif v_istituzione_id = public.current_istituzione_id() then
    if not exists (
      select 1 from public.istituzioni i
      join public.piani p on p.id = i.piano_id
      where i.id = v_istituzione_id and p.nome <> 'free'
    ) then
      raise exception 'piano_non_abilitato';
    end if;
    v_mittente := 'ente';
  else
    raise exception 'non_autorizzato';
  end if;

  if v_stato <> 'aperta' then
    raise exception 'conversazione_non_scrivibile';
  end if;

  select count(*) into v_conteggio_oggi
  from public.messaggi_enti
  where conversazione_id = p_conversazione_id
    and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;

  if v_conteggio_oggi >= 20 then
    raise exception 'troppi_messaggi_oggi';
  end if;

  insert into public.messaggi_enti (conversazione_id, mittente, corpo)
  values (p_conversazione_id, v_mittente, p_corpo);
end;
$$;

grant execute on function public.invia_messaggio_ente(uuid, text) to authenticated;

-- ============ blocca e segnala (solo studente, sulla propria conversazione aperta) ============
create or replace function public.blocca_conversazione_studente(p_conversazione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversazioni_enti
  set stato = 'bloccata_da_studente'
  where id = p_conversazione_id and student_id = auth.uid() and stato = 'aperta';

  if not found then
    raise exception 'non_autorizzato_o_gia_chiusa';
  end if;
end;
$$;

grant execute on function public.blocca_conversazione_studente(uuid) to authenticated;

-- ============ chiusura forzata (solo admin) ============
create or replace function public.chiudi_conversazione_admin(p_conversazione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  update public.conversazioni_enti set stato = 'chiusa_da_admin' where id = p_conversazione_id;
end;
$$;

grant execute on function public.chiudi_conversazione_admin(uuid) to authenticated;

-- ============ segna messaggio come letto (solo un partecipante della conversazione) ============
create or replace function public.segna_messaggio_letto(p_messaggio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversazione_id uuid;
  v_student_id uuid;
  v_istituzione_id uuid;
begin
  select conversazione_id into v_conversazione_id from public.messaggi_enti where id = p_messaggio_id;
  if v_conversazione_id is null then
    raise exception 'messaggio_non_trovato';
  end if;

  select student_id, istituzione_id into v_student_id, v_istituzione_id
  from public.conversazioni_enti where id = v_conversazione_id;

  if v_student_id = auth.uid() then
    null;
  elsif v_istituzione_id is not null and v_istituzione_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  update public.messaggi_enti set letta = true where id = p_messaggio_id;
end;
$$;

grant execute on function public.segna_messaggio_letto(uuid) to authenticated;
