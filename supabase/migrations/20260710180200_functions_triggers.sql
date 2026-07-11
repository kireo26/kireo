-- Funzioni di supporto: timestamp automatici, coerenza ruolo <-> tabella
-- di estensione, helper per le policy RLS (SECURITY DEFINER per evitare
-- ricorsione tra le policy di tabelle che si controllano a vicenda).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.schools for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.student_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.teacher_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.conventions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.class_codes for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.activities for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.student_activities for each row execute function public.set_updated_at();

-- Uno student_profiles deve appartenere a un profilo con ruolo 'studente'.
create or replace function public.check_ruolo_studente()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.profiles where id = new.user_id and ruolo = 'studente'
  ) then
    raise exception 'user_id % deve avere ruolo studente per avere uno student_profiles', new.user_id;
  end if;
  return new;
end;
$$;

create trigger check_ruolo_studente
before insert or update on public.student_profiles
for each row execute function public.check_ruolo_studente();

-- teacher_profiles ospita sia il ruolo docente sia referente_scuola.
create or replace function public.check_ruolo_docente_o_referente()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.user_id and ruolo in ('docente', 'referente_scuola')
  ) then
    raise exception 'user_id % deve avere ruolo docente o referente_scuola per avere un teacher_profiles', new.user_id;
  end if;
  return new;
end;
$$;

create trigger check_ruolo_docente_o_referente
before insert or update on public.teacher_profiles
for each row execute function public.check_ruolo_docente_o_referente();

-- Ruolo dell'utente corrente, per le policy RLS.
create or replace function public.current_ruolo()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$
  select ruolo from public.profiles where id = auth.uid();
$$;

-- Scuola dell'utente corrente (studente o docente/referente), per le
-- policy RLS che filtrano per scuola.
create or replace function public.current_school_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select school_code from public.student_profiles where user_id = auth.uid()
  union all
  select school_code from public.teacher_profiles where user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_ruolo() to authenticated;
grant execute on function public.current_school_code() to authenticated;
