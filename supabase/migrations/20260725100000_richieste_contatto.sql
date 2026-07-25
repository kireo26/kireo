-- Richieste dal form "Richiedi informazioni" delle landing del funnel
-- scuole (/dirigenti, /scuole — raggiungibili solo da link email, mai
-- indicizzate né linkate dal sito). Insert pubblico (anon), lettura solo
-- admin — stesso pattern *_admin_tutto già in uso altrove nel progetto.
create table public.richieste_contatto (
  id uuid primary key default gen_random_uuid(),
  origine text not null check (origine in ('dirigenti', 'scuole')),
  nome text not null,
  ruolo text not null,
  istituto text not null,
  codice_meccanografico text,
  email text not null,
  messaggio text not null,
  created_at timestamptz not null default now(),
  gestita boolean not null default false
);

comment on table public.richieste_contatto is
  'Richieste dal form "Richiedi informazioni" delle landing /dirigenti e /scuole del funnel scuole. codice_meccanografico è testo libero facoltativo, nessuna FK verso schools: un errore di battitura non deve bloccare l''invio della richiesta.';

create index richieste_contatto_gestita_idx on public.richieste_contatto (gestita, created_at);

alter table public.richieste_contatto enable row level security;

create policy richieste_contatto_insert_pubblico
  on public.richieste_contatto for insert
  to anon, authenticated
  with check (true);

create policy richieste_contatto_admin_tutto
  on public.richieste_contatto for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Rate limit di cortesia: un vincolo DB reale (stesso principio dei
-- fair-use già in uso altrove — limite_eventi_in_approvazione,
-- limite_conversazioni_assistente_giorno — non un semplice controllo
-- applicativo prima dell'insert) che blocca un doppio invio involontario
-- (es. click ripetuto sul pulsante) dalla stessa email entro 10 minuti.
-- Non è pensato come difesa anti-spam robusta, solo come garanzia di
-- cortesia verso chi compila il form due volte per errore.
create or replace function public.limite_richieste_contatto_email()
returns trigger
language plpgsql
as $$
declare
  v_recente boolean;
begin
  select exists (
    select 1 from public.richieste_contatto
    where lower(email) = lower(new.email)
      and created_at > now() - interval '10 minutes'
  ) into v_recente;

  if v_recente then
    raise exception 'richiesta_recente';
  end if;

  return new;
end;
$$;

create trigger limite_richieste_contatto_email
before insert on public.richieste_contatto
for each row execute function public.limite_richieste_contatto_email();
