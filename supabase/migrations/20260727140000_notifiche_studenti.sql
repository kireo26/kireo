-- Livello social (5/8): notifiche in-app, leva di piano. Alla
-- APPROVAZIONE di un post o di un evento (pubblico=studenti) di un ente
-- con piano a pagamento (plus/premium), tutti i follower ricevono una
-- notifica. Un ente Free: il contenuto compare comunque nel feed, ma
-- NESSUNA notifica — la differenza di piano, non una funzione bloccata.

create type public.notifica_tipo as enum ('nuovo_post', 'nuovo_evento_ente');

create table public.notifiche_studenti (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  tipo public.notifica_tipo not null,
  riferimento_id uuid not null,
  letta boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifiche_studenti is
  'riferimento_id punta a post_enti.id (tipo=nuovo_post) o eventi.id (tipo=nuovo_evento_ente) — nessuna FK diretta (due possibili tabelle di origine), il client risolve il link in base al tipo. Scritte SOLO dai trigger di approvazione sotto (SECURITY DEFINER): nessuna policy insert self-service.';

create index notifiche_studenti_student_letta_idx on public.notifiche_studenti (student_id, letta, created_at desc);

alter table public.notifiche_studenti enable row level security;

create policy notifiche_studenti_select_own
  on public.notifiche_studenti for select
  to authenticated
  using (student_id = auth.uid());

-- Lo studente può solo segnarle come lette (o non lette) sulla propria
-- riga: nessun altro campo ha senso che modifichi da sé, ma non c'è nulla
-- da proteggere in più (tipo/riferimento_id sulla propria riga non danno
-- accesso a dati che lo studente non potrebbe già raggiungere navigando).
create policy notifiche_studenti_update_own
  on public.notifiche_studenti for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy notifiche_studenti_admin_tutto
  on public.notifiche_studenti for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- ============ trigger: nuovo post approvato -> follower di un ente a pagamento ============
create or replace function public.notifica_follower_post_approvato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stato = 'approvato' and old.stato is distinct from 'approvato' then
    if exists (
      select 1 from public.istituzioni i
      join public.piani p on p.id = i.piano_id
      where i.id = new.istituzione_id and p.nome <> 'free'
    ) then
      insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
      select s.student_id, 'nuovo_post', new.id
      from public.seguiti s
      where s.istituzione_id = new.istituzione_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger notifica_follower_post_approvato
after update on public.post_enti
for each row execute function public.notifica_follower_post_approvato();

-- ============ trigger: nuovo evento approvato -> follower di un ente a pagamento ============
-- Solo pubblico=studenti: un webinar docenti non è raggiungibile dai
-- follower studenti, non ha senso notificarli.
create or replace function public.notifica_follower_evento_approvato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stato = 'approvato' and old.stato is distinct from 'approvato'
     and new.organizzatore_id is not null and new.pubblico = 'studenti'
  then
    if exists (
      select 1 from public.istituzioni i
      join public.piani p on p.id = i.piano_id
      where i.id = new.organizzatore_id and p.nome <> 'free'
    ) then
      insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
      select s.student_id, 'nuovo_evento_ente', new.id
      from public.seguiti s
      where s.istituzione_id = new.organizzatore_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger notifica_follower_evento_approvato
after update on public.eventi
for each row execute function public.notifica_follower_evento_approvato();
