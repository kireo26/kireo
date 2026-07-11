-- Row Level Security su tutte le tabelle dell'area privata.
-- Nessuna tabella profili/attività è accessibile in modo anonimo.

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.student_profiles enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.conventions enable row level security;
alter table public.class_codes enable row level security;
alter table public.activities enable row level security;
alter table public.student_activities enable row level security;

-- ============ schools: lettura pubblica (serve ai menu), scrittura solo
-- service_role (nessuna policy di insert/update/delete: la service_role
-- bypassa comunque RLS) ============
create policy schools_select_public
  on public.schools for select
  to anon, authenticated
  using (true);

-- ============ profiles ============
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Docente/referente leggono i profili degli studenti della propria scuola:
-- base per le statistiche aggregate lato docente.
create policy profiles_select_school_students
  on public.profiles for select
  to authenticated
  using (
    public.current_ruolo() in ('docente', 'referente_scuola')
    and ruolo = 'studente'
    and exists (
      select 1 from public.student_profiles sp
      where sp.user_id = profiles.id
        and sp.school_code = public.current_school_code()
    )
  );

-- Un utente crea solo il proprio profilo, e mai con ruolo referente_scuola:
-- quell'account lo crea sempre KIREO dopo la convenzione, non è mai
-- self-service.
create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and ruolo <> 'referente_scuola');

-- Un utente aggiorna solo il proprio profilo, senza potersi promuovere a
-- referente_scuola.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and ruolo <> 'referente_scuola');

-- ============ student_profiles ============
create policy student_profiles_select_own
  on public.student_profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy student_profiles_select_school
  on public.student_profiles for select
  to authenticated
  using (
    public.current_ruolo() in ('docente', 'referente_scuola')
    and school_code = public.current_school_code()
  );

create policy student_profiles_insert_own
  on public.student_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy student_profiles_update_own
  on public.student_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============ teacher_profiles ============
create policy teacher_profiles_select_own
  on public.teacher_profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy teacher_profiles_insert_own
  on public.teacher_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy teacher_profiles_update_own
  on public.teacher_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============ conventions ============
-- Sola lettura, per la propria scuola: la gestione delle convenzioni resta
-- in mano a KIREO (service_role), non è self-service per nessun ruolo.
create policy conventions_select_school
  on public.conventions for select
  to authenticated
  using (
    public.current_ruolo() in ('docente', 'referente_scuola')
    and school_code = public.current_school_code()
  );

-- ============ class_codes ============
-- Docente e referente vedono i codici classe della propria scuola.
create policy class_codes_select_school
  on public.class_codes for select
  to authenticated
  using (
    public.current_ruolo() in ('docente', 'referente_scuola')
    and exists (
      select 1 from public.conventions c
      where c.id = class_codes.convention_id
        and c.school_code = public.current_school_code()
    )
  );

-- Solo il referente gestisce (crea/modifica/elimina) i codici classe della
-- propria scuola; il docente ha solo lettura (policy sopra).
create policy class_codes_insert_referente
  on public.class_codes for insert
  to authenticated
  with check (
    public.current_ruolo() = 'referente_scuola'
    and exists (
      select 1 from public.conventions c
      where c.id = class_codes.convention_id
        and c.school_code = public.current_school_code()
    )
  );

create policy class_codes_update_referente
  on public.class_codes for update
  to authenticated
  using (
    public.current_ruolo() = 'referente_scuola'
    and exists (
      select 1 from public.conventions c
      where c.id = class_codes.convention_id
        and c.school_code = public.current_school_code()
    )
  )
  with check (
    public.current_ruolo() = 'referente_scuola'
    and exists (
      select 1 from public.conventions c
      where c.id = class_codes.convention_id
        and c.school_code = public.current_school_code()
    )
  );

create policy class_codes_delete_referente
  on public.class_codes for delete
  to authenticated
  using (
    public.current_ruolo() = 'referente_scuola'
    and exists (
      select 1 from public.conventions c
      where c.id = class_codes.convention_id
        and c.school_code = public.current_school_code()
    )
  );

-- ============ activities ============
-- Catalogo attività leggibile da chiunque sia autenticato (mai in modo
-- anonimo); scrittura riservata a KIREO (service_role).
create policy activities_select_authenticated
  on public.activities for select
  to authenticated
  using (true);

-- ============ student_activities ============
create policy student_activities_select_own
  on public.student_activities for select
  to authenticated
  using (student_id = auth.uid());

create policy student_activities_select_school
  on public.student_activities for select
  to authenticated
  using (
    public.current_ruolo() in ('docente', 'referente_scuola')
    and exists (
      select 1 from public.student_profiles sp
      where sp.user_id = student_activities.student_id
        and sp.school_code = public.current_school_code()
    )
  );

create policy student_activities_insert_own
  on public.student_activities for insert
  to authenticated
  with check (student_id = auth.uid());

create policy student_activities_update_own
  on public.student_activities for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
