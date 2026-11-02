-- La cancellazione dell'account, con le regole decise da Mario il 01/11.
--
-- (a) L'ACCOUNT SPARISCE, IL NOME RESTA SULLE CERTIFICAZIONI. Chi ha firmato
--     qualcosa (una presenza certificata, uno studente verificato, un invito,
--     un messaggio, una decisione: le 15 colonne di `npm run test:responsabilita`)
--     fino a oggi non poteva cancellarsi: le chiavi `NO ACTION` verso `profiles`
--     bloccavano. Ora il suo profilo diventa una LAPIDE: restano `nome`,
--     `cognome`, `ruolo` e `cancellato_il`; spariscono l'accesso (la riga di
--     `auth.users`, quindi email e password), la data di nascita, il telefono,
--     il consenso, e ogni riga sua che la cascata avrebbe cancellato (la riga
--     nello staff compresa). *Resta il nome, non la persona.*
--     Chi non ha firmato niente si cancella come prima, per intero.
-- (b) IL REFERENTE NON SE NE VA SENZA UN SUCCESSORE: `passa_referente` lo fa
--     diventare tutor e fa diventare referente un tutor attivo, nello stesso
--     gesto. Un tutor si cancella quando vuole.
-- (c) Gli account d'ente e di admin non si cancellano da qui: per l'ente non è
--     deciso cosa succede all'istituzione senza nessuno dentro (decisione di
--     Mario), e un admin che si cancella toglie l'accesso a KIREO.
--
-- LA LAPIDE HA BISOGNO DI UNA COSA SOLA: che cancellare l'utente non cancelli
-- sempre il profilo. Fino a oggi `profiles.id` puntava ad `auth.users` in
-- cascata; la chiave esce, e al suo posto un trigger su `auth.users` cancella
-- il profilo SE non è una lapide. Ogni altra strada (il cruscotto di Supabase,
-- un `delete` dal SQL Editor) si comporta come prima: il profilo se ne va, e
-- se ha firmato qualcosa la cancellazione si ferma, come oggi.
-- ⚠️ Il trigger si crea PRIMA che la chiave esca: se Supabase non lascia
-- creare un trigger su `auth.users`, la migrazione si ferma con la chiave
-- ancora al suo posto.
--
-- Da applicare PRIMA del deploy: la pagina dell'account chiama
-- `stato_cancellazione_account` e `passa_referente`. Con questa applicata il
-- codice di prima funziona: `delete_own_account` ha lo stesso nome, e chi la
-- chiamava ignorava la risposta.

-- 1. La colonna della lapide. Il client non la scrive (nessuna concessione).
alter table public.profiles add column if not exists cancellato_il timestamptz;
comment on column public.profiles.cancellato_il is
  '20261202100000: non null = l''account è stato cancellato e resta il nome sulle firme. Lo scrive solo delete_own_account.';

-- 2. Il trigger su auth.users, poi via la chiave.
create or replace function public.cancella_profilo_con_l_utente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id and cancellato_il is null;
  return old;
end;
$$;
revoke all on function public.cancella_profilo_con_l_utente() from public, anon, authenticated;

drop trigger if exists cancella_profilo_con_l_utente on auth.users;
create trigger cancella_profilo_con_l_utente
  after delete on auth.users
  for each row execute function public.cancella_profilo_con_l_utente();

alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 3. La regola, in un posto solo: la legge la pagina e la applica la cancellazione.
create or replace function public.stato_cancellazione_account(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ruolo public.profile_role;
  v_tutor int;
  v_firme boolean := false;
  v_c boolean;
  r record;
begin
  select ruolo into v_ruolo from public.profiles where id = p_uid and cancellato_il is null;
  if v_ruolo is null then
    return jsonb_build_object('puo', false, 'motivo', 'profilo_mancante');
  end if;
  if v_ruolo in ('admin', 'istituzione') then
    return jsonb_build_object('ruolo', v_ruolo, 'puo', false, 'motivo', 'ruolo_non_previsto');
  end if;

  if exists (select 1 from public.school_staff where user_id = p_uid and ruolo_staff = 'referente' and attivo) then
    select count(*) into v_tutor
    from public.school_staff me
    join public.school_staff t on t.scuola_profilo_id = me.scuola_profilo_id
    where me.user_id = p_uid and me.ruolo_staff = 'referente' and me.attivo
      and t.ruolo_staff = 'tutor' and t.attivo and t.user_id is not null and t.user_id <> p_uid;
    return jsonb_build_object('ruolo', v_ruolo, 'puo', false, 'motivo', 'referente_senza_successore', 'tutor_attivi', v_tutor);
  end if;

  -- Ha firmato qualcosa? Le chiavi che bloccano, lette dal catalogo: una
  -- colonna di responsabilità nuova entra da sola. La propria riga nello staff
  -- non conta: se ne va con l'account.
  for r in
    select c.conrelid::regclass as tabella, a.attname as colonna
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype in ('a', 'r') and array_length(c.conkey, 1) = 1
  loop
    execute format('select exists (select 1 from %s where %I = $1%s)', r.tabella, r.colonna,
      case when r.tabella = 'public.school_staff'::regclass then ' and user_id is distinct from $1' else '' end)
      into v_c using p_uid;
    if v_c then v_firme := true; exit; end if;
  end loop;

  return jsonb_build_object('ruolo', v_ruolo, 'puo', true, 'motivo', null, 'resta_il_nome', v_firme);
end;
$$;
revoke all on function public.stato_cancellazione_account(uuid) from public, anon, authenticated;

create or replace function public.stato_cancellazione_mio_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'non_autenticato'; end if;
  return public.stato_cancellazione_account(auth.uid());
end;
$$;
revoke all on function public.stato_cancellazione_mio_account() from public, anon;
grant execute on function public.stato_cancellazione_mio_account() to authenticated;

-- 4. La cancellazione.
drop function if exists public.delete_own_account();
create function public.delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_stato jsonb;
  v_cte text := '';
  v_n int := 0;
  r record;
begin
  if v_uid is null then raise exception 'non_autenticato'; end if;
  v_stato := public.stato_cancellazione_account(v_uid);
  if not coalesce((v_stato ->> 'puo')::boolean, false) then
    raise exception '%', v_stato ->> 'motivo';
  end if;

  -- Prima la strada di sempre: l'utente se ne va, il trigger porta via il
  -- profilo, la cascata il resto. Se una firma lo trattiene, si torna indietro.
  begin
    delete from auth.users where id = v_uid;
    return jsonb_build_object('esito', 'cancellato');
  exception when foreign_key_violation then
    null;
  end;

  -- La lapide. Le righe che la cascata avrebbe cancellato si cancellano in
  -- UNA istruzione sola (una CTE per tabella): una chiave fra due di queste
  -- tabelle si controlla alla fine dell'istruzione, come nella cascata vera.
  for r in
    select c.conrelid::regclass as tabella, a.attname as colonna
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype = 'c' and array_length(c.conkey, 1) = 1
      and c.conrelid <> 'public.profiles'::regclass
  loop
    v_n := v_n + 1;
    v_cte := v_cte || case when v_n > 1 then ', ' else '' end
      || format('d%s as (delete from %s where %I = $1 returning 1)', v_n, r.tabella, r.colonna);
  end loop;
  if v_n > 0 then
    execute 'with ' || v_cte || ' select 1' using v_uid;
  end if;

  update public.profiles
  set cancellato_il = now(), data_nascita = null, telefono = null,
      comunicazioni_kireo = null, comunicazioni_kireo_il = null
  where id = v_uid;

  delete from auth.users where id = v_uid;
  return jsonb_build_object('esito', 'cancellato_resta_il_nome');
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
comment on function public.delete_own_account() is
  '20261202100000: chi ha firmato qualcosa lascia una lapide con il nome; il referente non se ne va senza un successore.';

-- 5. Il passaggio della scuola.
create or replace function public.passa_referente(p_staff_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mio public.school_staff;
  v_altro public.school_staff;
  v_n int;
begin
  if v_uid is null then raise exception 'non_autenticato'; end if;
  select * into v_mio from public.school_staff
  where user_id = v_uid and ruolo_staff = 'referente' and attivo
  for update;
  if not found then raise exception 'non_referente'; end if;

  select * into v_altro from public.school_staff
  where id = p_staff_id and scuola_profilo_id = v_mio.scuola_profilo_id
    and ruolo_staff = 'tutor' and attivo and user_id is not null and user_id <> v_uid
  for update;
  if not found then raise exception 'tutor_non_valido'; end if;

  -- Prima chi lascia, poi chi entra: la scuola ha un referente attivo solo.
  -- Chi lascia resta tutor senza deleghe: le decide il nuovo referente.
  update public.school_staff
  set ruolo_staff = 'tutor', puo_verificare_studenti = false, puo_gestire_classi = false,
      puo_certificare_presenze = false, puo_inviare_comunicazioni = false
  where id = v_mio.id;
  update public.school_staff set ruolo_staff = 'referente' where id = v_altro.id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'passaggio_non_riuscito'; end if;

  update public.profiles set ruolo = 'tutor_scuola' where id = v_uid;
  update public.profiles set ruolo = 'referente_scuola' where id = v_altro.user_id;

  return jsonb_build_object('nuovo_referente', v_altro.user_id);
end;
$$;
revoke all on function public.passa_referente(uuid) from public, anon;
grant execute on function public.passa_referente(uuid) to authenticated;
comment on function public.passa_referente(uuid) is
  '20261202100000: il referente passa la scuola a un tutor attivo e diventa tutor senza deleghe.';

-- 6. Si rilegge.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_id_fkey' and conrelid = 'public.profiles'::regclass) then
    raise exception 'profiles_id_fkey c''è ancora';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'cancella_profilo_con_l_utente' and tgrelid = 'auth.users'::regclass) then
    raise exception 'manca il trigger su auth.users';
  end if;
  if obj_description('public.delete_own_account()'::regprocedure) not like '20261202100000:%' then
    raise exception 'delete_own_account non è quella di 20261202100000';
  end if;
  if has_function_privilege('anon', 'public.stato_cancellazione_account(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.stato_cancellazione_account(uuid)', 'execute') then
    raise exception 'stato_cancellazione_account è eseguibile dal client';
  end if;
end $$;
