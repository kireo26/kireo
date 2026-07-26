-- Livello social (4/8): follow. Aperto a tutti gli studenti, anche
-- minorenni (seguire un ente non condivide alcun dato individuale, è
-- sicuro per costruzione — a differenza di manifestazione di interesse e
-- messaggi, riservati ai maggiorenni).

create table public.seguiti (
  student_id uuid not null references public.profiles (id) on delete cascade,
  istituzione_id uuid not null references public.istituzioni (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, istituzione_id)
);

comment on table public.seguiti is
  'Follow studente -> istituzione. Alimenta il feed /app/bacheca e, per gli enti con piano a pagamento, le notifiche ai follower su nuovo post/evento (vedi notifiche_studenti). Le singole righe non sono mai leggibili dall''ente: solo il conteggio pubblico via conteggio_follower().';

create index seguiti_istituzione_idx on public.seguiti (istituzione_id);

alter table public.seguiti enable row level security;

create policy seguiti_select_own
  on public.seguiti for select
  to authenticated
  using (student_id = auth.uid());

create policy seguiti_insert_own
  on public.seguiti for insert
  to authenticated
  with check (student_id = auth.uid());

create policy seguiti_delete_own
  on public.seguiti for delete
  to authenticated
  using (student_id = auth.uid());

-- Nessuna policy per il ruolo istituzione: l'ente non legge mai le righe
-- individuali dei propri follower, solo l'aggregato sotto.
create or replace function public.conteggio_follower(p_istituzione_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.seguiti where istituzione_id = p_istituzione_id;
$$;

comment on function public.conteggio_follower(uuid) is
  'Conteggio pubblico (come un numero di follower social): mai una riga individuale, solo il numero. Pubblica ad anon perché il profilo ente è una pagina pubblica.';

grant execute on function public.conteggio_follower(uuid) to anon, authenticated;
