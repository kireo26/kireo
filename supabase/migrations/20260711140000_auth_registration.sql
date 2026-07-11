-- Funzioni di supporto per il flusso di registrazione (autenticazione +
-- creazione profilo) e vincolo di età minima.

-- Difesa in profondità: età minima 14 anni (soglia consenso GDPR Italia),
-- già bloccata lato client prima di qualunque chiamata a Supabase Auth.
alter table public.profiles
  add constraint profiles_eta_minima
  check (data_nascita is null or data_nascita <= (current_date - interval '14 years'));

-- Validazione di un codice classe SENZA consumarlo: chiamabile anche da
-- utente anonimo, usata dal form di registrazione per dare un riscontro
-- immediato prima dell'invio (class_codes non è altrimenti leggibile da chi
-- non è ancora docente/referente della scuola, per via delle RLS esistenti).
create or replace function public.check_class_code(p_codice text)
returns table (valido boolean, school_code text, classe text, messaggio text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.class_codes%rowtype;
  v_school_code text;
begin
  select * into v_row from public.class_codes where codice = p_codice;

  if not found then
    return query select false, null::text, null::text, 'Codice non trovato.';
    return;
  end if;

  if not v_row.attivo then
    return query select false, null::text, null::text, 'Codice non più attivo.';
    return;
  end if;

  if v_row.usi_correnti >= v_row.max_usi then
    return query select false, null::text, null::text, 'Codice esaurito.';
    return;
  end if;

  select c.school_code into v_school_code from public.conventions c where c.id = v_row.convention_id;

  return query select true, v_school_code, v_row.classe, 'Codice valido.'::text;
end;
$$;

grant execute on function public.check_class_code(text) to anon, authenticated;

-- Redime un codice classe: rilegge la riga con lock, rivalida e incrementa
-- usi_correnti in modo atomico. Usata solo da finalize_registration, mai
-- direttamente dal client.
create or replace function public.redeem_class_code(p_codice text)
returns table (school_code text, classe text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.class_codes%rowtype;
  v_school_code text;
begin
  if auth.uid() is null then
    raise exception 'non_autenticato';
  end if;

  select * into v_row from public.class_codes where codice = p_codice for update;

  if not found then
    raise exception 'codice_non_valido';
  end if;

  if not v_row.attivo then
    raise exception 'codice_non_attivo';
  end if;

  if v_row.usi_correnti >= v_row.max_usi then
    raise exception 'codice_esaurito';
  end if;

  update public.class_codes set usi_correnti = usi_correnti + 1 where codice = p_codice;

  select c.school_code into v_school_code from public.conventions c where c.id = v_row.convention_id;

  return query select v_school_code, v_row.classe;
end;
$$;

grant execute on function public.redeem_class_code(text) to authenticated;

-- Finalizza la registrazione appena dopo la conferma email: crea profiles +
-- student_profiles/teacher_profiles in un'unica transazione atomica.
-- SECURITY INVOKER (non definer): gli INSERT restano soggetti alle RLS
-- esistenti su profiles/student_profiles/teacher_profiles — compreso il
-- blocco che impedisce l'auto-registrazione come referente_scuola. Solo la
-- chiamata interna a redeem_class_code (quando serve) è privilegiata.
create or replace function public.finalize_registration(
  p_ruolo public.profile_role,
  p_nome text,
  p_cognome text,
  p_data_nascita date,
  p_school_code text default null,
  p_classe text default null,
  p_anno_diploma integer default null,
  p_materia text default null,
  p_is_referente boolean default false,
  p_codice_classe text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_school_code text := p_school_code;
  v_classe text := p_classe;
  v_redeem record;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    -- Già finalizzato (es. link email aperto due volte): non rifare nulla.
    return;
  end if;

  if p_ruolo = 'studente' and p_codice_classe is not null then
    select * into v_redeem from public.redeem_class_code(p_codice_classe);
    v_school_code := v_redeem.school_code;
    v_classe := v_redeem.classe;
  end if;

  insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
  values (v_uid, p_ruolo, p_nome, p_cognome, p_data_nascita);

  if p_ruolo = 'studente' then
    insert into public.student_profiles (user_id, school_code, classe, anno_diploma)
    values (v_uid, v_school_code, v_classe, p_anno_diploma);
  elsif p_ruolo in ('docente', 'referente_scuola') then
    insert into public.teacher_profiles (user_id, school_code, materia, is_referente_orientamento)
    values (v_uid, v_school_code, p_materia, coalesce(p_is_referente, false));
  end if;
end;
$$;

grant execute on function public.finalize_registration(
  public.profile_role, text, text, date, text, text, integer, text, boolean, text
) to authenticated;
