-- Classi della scuola e loro composizione. Solo studenti VERIFICATI della
-- stessa scuola possono entrare in una classe (vincolo trigger, non solo
-- applicativo: vedi check_studente_verificato_stessa_scuola).

create table public.classi (
  id uuid primary key default gen_random_uuid(),
  scuola_profilo_id uuid not null references public.scuole_profili (id) on delete cascade,
  anno integer not null check (anno between 1 and 5),
  sezione text not null,
  nome_visualizzato text,
  created_at timestamptz not null default now(),
  constraint classi_una_per_anno_sezione unique (scuola_profilo_id, anno, sezione)
);

create index classi_scuola_profilo_idx on public.classi (scuola_profilo_id);

create table public.classi_studenti (
  classe_id uuid not null references public.classi (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (classe_id, student_id)
);

comment on table public.classi_studenti is
  'Composizione di una classe. Solo studenti con stato_verifica=verificato e school_code coincidente con la scuola della classe (vedi check_studente_verificato_stessa_scuola): un referente o un tutor non può aggiungere uno studente non ancora verificato o di un''altra scuola.';

alter table public.classi enable row level security;
alter table public.classi_studenti enable row level security;

-- Lettura sempre aperta a referente e tutor (anche senza delega: niente
-- pagine che respingono in silenzio, un tutor senza puo_gestire_classi
-- deve comunque poter VEDERE le classi, solo non modificarle). Scrittura
-- (creazione classi/assegnazione studenti) delegabile via
-- puo_gestire_classi — il referente ha sempre tutto, vedi
-- current_ha_permesso_staff in 20260715110000.
create policy classi_select_propria_scuola
  on public.classi for select
  to authenticated
  using (scuola_profilo_id = public.current_scuola_profilo_id());

create policy classi_insert_propria_scuola
  on public.classi for insert
  to authenticated
  with check (
    public.current_ha_permesso_staff('gestione_classi')
    and scuola_profilo_id = public.current_scuola_profilo_id()
  );

create policy classi_update_propria_scuola
  on public.classi for update
  to authenticated
  using (public.current_ha_permesso_staff('gestione_classi') and scuola_profilo_id = public.current_scuola_profilo_id())
  with check (public.current_ha_permesso_staff('gestione_classi') and scuola_profilo_id = public.current_scuola_profilo_id());

create policy classi_delete_propria_scuola
  on public.classi for delete
  to authenticated
  using (public.current_ha_permesso_staff('gestione_classi') and scuola_profilo_id = public.current_scuola_profilo_id());

create policy classi_admin_tutto
  on public.classi for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- classi_studenti: select per lo staff scuola (via classe) e per lo
-- studente stesso (per sapere in che classe è, mostrato nel proprio
-- profilo se servisse in futuro — nessuna UI oggi, ma la policy non costa
-- nulla ed evita di doverla aggiungere più avanti con la stessa cautela).
create policy classi_studenti_select_scuola
  on public.classi_studenti for select
  to authenticated
  using (
    exists (
      select 1 from public.classi c
      where c.id = classi_studenti.classe_id and c.scuola_profilo_id = public.current_scuola_profilo_id()
    )
  );

create policy classi_studenti_select_own
  on public.classi_studenti for select
  to authenticated
  using (student_id = auth.uid());

create policy classi_studenti_insert_scuola
  on public.classi_studenti for insert
  to authenticated
  with check (
    public.current_ha_permesso_staff('gestione_classi')
    and exists (
      select 1 from public.classi c
      where c.id = classi_studenti.classe_id and c.scuola_profilo_id = public.current_scuola_profilo_id()
    )
  );

create policy classi_studenti_delete_scuola
  on public.classi_studenti for delete
  to authenticated
  using (
    public.current_ha_permesso_staff('gestione_classi')
    and exists (
      select 1 from public.classi c
      where c.id = classi_studenti.classe_id and c.scuola_profilo_id = public.current_scuola_profilo_id()
    )
  );

create policy classi_studenti_admin_tutto
  on public.classi_studenti for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Vincolo: solo studenti verificati della stessa scuola della classe.
create or replace function public.check_studente_verificato_stessa_scuola()
returns trigger
language plpgsql
as $$
declare
  v_scuola_classe text;
begin
  select scuola_id into v_scuola_classe
  from public.scuole_profili sp
  join public.classi c on c.scuola_profilo_id = sp.id
  where c.id = new.classe_id;

  if not exists (
    select 1 from public.student_profiles sp
    where sp.user_id = new.student_id
      and sp.stato_verifica = 'verificato'
      and sp.school_code = v_scuola_classe
  ) then
    raise exception 'studente_non_verificato_o_scuola_diversa';
  end if;

  return new;
end;
$$;

create trigger check_studente_verificato_stessa_scuola
before insert on public.classi_studenti
for each row execute function public.check_studente_verificato_stessa_scuola();
