-- Aree di orientamento di interesse scelte dallo studente in registrazione
-- (max 3, facoltativo). Le 18 aree sono contenuto statico in data/aree.ts,
-- non una tabella: lo slug è vincolato qui con un CHECK invece che una FK,
-- va tenuto in sync a mano se le aree cambiano (vedi commento sotto).

create table public.student_area_interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  area_slug text not null check (
    area_slug in (
      'informatica-digitale',
      'salute-professioni-sanitarie',
      'ristorazione-turismo',
      'meccanica-meccatronica',
      'agrifood-ambiente',
      'arte-design-moda',
      'musica-spettacolo',
      'energia-sostenibilita',
      'edilizia-architettura',
      'economia-management',
      'giurisprudenza-pa',
      'mobilita-sostenibile',
      'scienze-educazione',
      'comunicazione-media',
      'scienze-ricerca',
      'sicurezza-difesa',
      'lingue-relazioni-internazionali',
      'studi-umanistici-beni-culturali'
    )
  ),
  created_at timestamptz not null default now(),
  primary key (user_id, area_slug)
);

comment on table public.student_area_interests is
  'Aree di orientamento (data/aree.ts) che uno studente ha indicato come di interesse in registrazione, max 3 per utente (limite applicativo, non un vincolo DB). Se l''elenco delle aree cambia, aggiornare il CHECK su area_slug in una nuova migration.';

alter table public.student_area_interests enable row level security;

-- Lo studente legge e scrive solo le proprie aree.
create policy student_area_interests_select_own
  on public.student_area_interests for select
  to authenticated
  using (user_id = auth.uid());

create policy student_area_interests_insert_own
  on public.student_area_interests for insert
  to authenticated
  with check (user_id = auth.uid());

-- Permette allo studente di cambiare le aree in futuro (delete + re-insert),
-- coerente con la promessa "potrai sempre cambiarle" nel form.
create policy student_area_interests_delete_own
  on public.student_area_interests for delete
  to authenticated
  using (user_id = auth.uid());

-- Docente/referente leggono in aggregato le aree degli studenti della
-- propria scuola (statistiche future), stesso pattern di
-- profiles_select_school_students / student_profiles_select_school.
create policy student_area_interests_select_school
  on public.student_area_interests for select
  to authenticated
  using (
    public.current_ruolo() in ('docente', 'referente_scuola')
    and exists (
      select 1 from public.student_profiles sp
      where sp.user_id = student_area_interests.user_id
        and sp.school_code = public.current_school_code()
    )
  );

-- finalize_registration: aggiunto parametro facoltativo per le aree scelte
-- in registrazione. CREATE OR REPLACE con un nuovo parametro DEFAULT in
-- coda è una modifica additiva ammessa da Postgres sulla stessa funzione
-- (stesso OID, stessi grant esistenti restano validi) — non serve un nuovo
-- GRANT né toccare le migration già applicate.
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
  p_codice_classe text default null,
  p_aree_interesse text[] default null
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

    -- Cap difensivo a 3 anche lato DB (il limite primario è nel form): al
    -- più le prime 3 voci dell'array, duplicati ignorati.
    if p_aree_interesse is not null then
      insert into public.student_area_interests (user_id, area_slug)
      select distinct v_uid, slug
      from unnest(p_aree_interesse[1:3]) as slug
      on conflict do nothing;
    end if;
  elsif p_ruolo in ('docente', 'referente_scuola') then
    insert into public.teacher_profiles (user_id, school_code, materia, is_referente_orientamento)
    values (v_uid, v_school_code, p_materia, coalesce(p_is_referente, false));
  end if;
end;
$$;
