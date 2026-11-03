-- La lapide tiene l'indirizzo, e prima del clic si dice cosa resta (Mario, 03/11).
--
-- 20261202100000 (applicata il 02/11) aveva fatto la lapide con nome, cognome e
-- ruolo, e aveva lasciato andare l'indirizzo con la riga di `auth.users`. La
-- decisione di Mario del 03/11: *la chiave della lapide è l'indirizzo email, non
-- il nome* — in produzione ci sono due profili «Giulia Casazza», e un nome non
-- identifica nessuno. Quindi:
--
-- (a) ZERO FIRME: si cancella tutto, e l'indirizzo torna libero (come prima).
-- (b) ALMENO UNA FIRMA: resta per sempre, e con lei l'indirizzo. Chi ha firmato
--     anche una cosa sola e si cancella NON potrà più registrarsi con quello
--     (conseguenza accettata da Mario). La registrazione lo rifiuta con una frase
--     sua, non con «email già in uso».
-- (c) PRIMA DEL CLIC SI DICE IL NUMERO: `stato_cancellazione_account` conta le
--     firme colonna per colonna, su tutte le chiavi `NO ACTION`/`RESTRICT` verso
--     `profiles` lette dal catalogo (la sedicesima entra da sola), e la pagina le
--     nomina. Un testo fisso dirà sempre la cosa sbagliata a qualcuno: il 02/11 a
--     una referente con dieci verifiche ha detto «le presenze che hai certificato».
-- (d) LA CANCELLAZIONE CONTROLLA QUELLO CHE LA PERSONA HA LETTO:
--     `delete_own_account(p_resta_il_nome_visto)` rifiuta con `stato_cambiato` se
--     fra la lettura e il clic una firma è comparsa o sparita. Chi ha letto
--     «l'indirizzo tornerà libero» non deve ritrovarsi con una lapide.
--
-- PERCHÉ UNA TABELLA E NON UNA COLONNA DI `profiles`: i privilegi valgono per
-- ruolo, e su `profiles` ci sono policy che mostrano righe ad altri (l'ente nelle
-- conversazioni, l'admin). Una colonna con l'indirizzo sarebbe letta ovunque una
-- policy mostri la riga. `indirizzi_delle_lapidi` non la legge nessun client:
-- solo le funzioni qui sotto e il SQL Editor.
--
-- ⚠️ LA LAPIDE DEL 02/11 (Giulia Casazza, 9fd1c239…) NON HA L'INDIRIZZO: la riga
-- di `auth.users` non c'è più, e da qui non si ricostruisce. Se Mario lo sa, lo
-- scrive a mano dal SQL Editor (vedi CLAUDE.md).
--
-- L'ORDINE: questa PRIMA del deploy (la pagina nuova chiama la firma a un
-- argomento e legge `firme`, la registrazione chiama la route che legge la
-- tabella). Con questa applicata il codice di prima funziona: la firma senza
-- argomenti resta, e salva l'indirizzo anche lei. La toglie 20261203110000, DOPO
-- il deploy.

-- 1. La tabella degli indirizzi. Cascata su `profiles`: una lapide non si
--    cancella, ma se un giorno qualcuno la toglie dal SQL Editor l'indirizzo va
--    con lei invece di restare a riservare un account che non esiste.
create table if not exists public.indirizzi_delle_lapidi (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email <> ''),
  cancellato_il timestamptz not null default now()
);
create unique index if not exists indirizzi_delle_lapidi_email_idx on public.indirizzi_delle_lapidi (email);
alter table public.indirizzi_delle_lapidi enable row level security;
revoke all on table public.indirizzi_delle_lapidi from public, anon, authenticated;
comment on table public.indirizzi_delle_lapidi is
  '20261203100000: l''indirizzo di un account cancellato che ha lasciato firme. Non lo legge nessun client; la registrazione lo consulta e lo rifiuta.';

-- 2. Il controllo, in un posto solo: lo usano il trigger e la route della registrazione.
create or replace function public.indirizzo_di_un_account_cancellato(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.indirizzi_delle_lapidi where email = lower(btrim(coalesce(p_email, ''))));
$$;
revoke all on function public.indirizzo_di_un_account_cancellato(text) from public, anon, authenticated;
grant execute on function public.indirizzo_di_un_account_cancellato(text) to service_role;

-- 3. La regola sul posto: nessuna strada crea un utente con quell'indirizzo, e
--    nessuna strada lo dà a un utente che c'è. La route della registrazione lo
--    dice prima con la frase giusta; questo trigger è la rete che fa rumore.
create or replace function public.blocca_indirizzo_di_una_lapide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and public.indirizzo_di_un_account_cancellato(new.email) then
    raise exception 'indirizzo_di_un_account_cancellato';
  end if;
  return new;
end;
$$;
revoke all on function public.blocca_indirizzo_di_una_lapide() from public, anon, authenticated;

drop trigger if exists blocca_indirizzo_di_una_lapide on auth.users;
create trigger blocca_indirizzo_di_una_lapide
  before insert or update of email on auth.users
  for each row execute function public.blocca_indirizzo_di_una_lapide();

-- 4. Le firme, contate. Tutte le colonne del catalogo, anche quelle a zero: chi
--    legge può confrontare la lunghezza con il catalogo, e la pagina mostra solo
--    quelle con qualcosa dentro. La propria riga nello staff non conta: se ne va
--    con l'account.
create or replace function public.firme_di_un_account(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb := '[]'::jsonb;
  v_n bigint;
  r record;
begin
  for r in
    select c.conrelid::regclass as tabella, c.conrelid::regclass::text as nome_tabella, a.attname as colonna
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype in ('a', 'r') and array_length(c.conkey, 1) = 1
    order by 2, 3
  loop
    execute format('select count(*) from %s where %I = $1%s', r.tabella, r.colonna,
      case when r.tabella = 'public.school_staff'::regclass then ' and user_id is distinct from $1' else '' end)
      into v_n using p_uid;
    v := v || jsonb_build_object('tabella', replace(r.nome_tabella, 'public.', ''), 'colonna', r.colonna, 'n', v_n);
  end loop;
  return v;
end;
$$;
revoke all on function public.firme_di_un_account(uuid) from public, anon, authenticated;

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
  v_firme jsonb;
  v_totale bigint;
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

  v_firme := public.firme_di_un_account(p_uid);
  select coalesce(sum((f ->> 'n')::bigint), 0) into v_totale from jsonb_array_elements(v_firme) f;
  return jsonb_build_object('ruolo', v_ruolo, 'puo', true, 'motivo', null,
    'resta_il_nome', v_totale > 0, 'firme', v_firme);
end;
$$;
revoke all on function public.stato_cancellazione_account(uuid) from public, anon, authenticated;

-- 5. La cancellazione, in un corpo solo: le due firme pubbliche lo chiamano.
create or replace function public.cancella_account(p_uid uuid, p_resta_il_nome_visto boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stato jsonb;
  v_email text;
  v_cte text := '';
  v_n int := 0;
  r record;
begin
  v_stato := public.stato_cancellazione_account(p_uid);
  if not coalesce((v_stato ->> 'puo')::boolean, false) then
    raise exception '%', v_stato ->> 'motivo';
  end if;
  -- Il controllo di quello che la persona ha letto. NULL = la firma di prima,
  -- che non lo sa (resta fino a 20261203110000).
  if p_resta_il_nome_visto is not null and p_resta_il_nome_visto <> (v_stato ->> 'resta_il_nome')::boolean then
    raise exception 'stato_cambiato';
  end if;

  if not (v_stato ->> 'resta_il_nome')::boolean then
    delete from auth.users where id = p_uid;
    return jsonb_build_object('esito', 'cancellato');
  end if;

  select lower(btrim(email)) into v_email from auth.users where id = p_uid;
  if v_email is null or v_email = '' then
    raise exception 'indirizzo_mancante';
  end if;

  -- La lapide. Le righe che la cascata avrebbe cancellato, in UNA istruzione
  -- (una CTE per tabella): una chiave fra due di queste tabelle si controlla
  -- alla fine dell'istruzione, come nella cascata vera.
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
    execute 'with ' || v_cte || ' select 1' using p_uid;
  end if;

  update public.profiles
  set cancellato_il = now(), data_nascita = null, telefono = null,
      comunicazioni_kireo = null, comunicazioni_kireo_il = null
  where id = p_uid;
  -- Dopo la CTE: la tabella è in cascata su profiles, e la CTE l'avrebbe vuotata.
  insert into public.indirizzi_delle_lapidi (profile_id, email) values (p_uid, v_email);

  delete from auth.users where id = p_uid;
  return jsonb_build_object('esito', 'cancellato_resta_il_nome');
end;
$$;
revoke all on function public.cancella_account(uuid, boolean) from public, anon, authenticated;

create or replace function public.delete_own_account(p_resta_il_nome_visto boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'non_autenticato'; end if;
  if p_resta_il_nome_visto is null then raise exception 'stato_visto_mancante'; end if;
  return public.cancella_account(auth.uid(), p_resta_il_nome_visto);
end;
$$;
revoke all on function public.delete_own_account(boolean) from public, anon;
grant execute on function public.delete_own_account(boolean) to authenticated;
comment on function public.delete_own_account(boolean) is
  '20261203100000: la cancellazione controlla quello che la persona ha letto; chi ha firmato lascia la lapide con l''indirizzo.';

-- La firma di prima, per il codice ancora in produzione fino al deploy: stesso
-- corpo, senza il controllo. La toglie 20261203110000.
create or replace function public.delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'non_autenticato'; end if;
  return public.cancella_account(auth.uid(), null);
end;
$$;
comment on function public.delete_own_account() is
  '20261203100000: la firma di prima, senza il controllo di quello che la persona ha letto. Esce con 20261203110000.';

-- 6. Si rilegge.
do $$
begin
  if to_regclass('public.indirizzi_delle_lapidi') is null then raise exception 'manca indirizzi_delle_lapidi'; end if;
  if has_table_privilege('authenticated', 'public.indirizzi_delle_lapidi', 'SELECT')
     or has_table_privilege('anon', 'public.indirizzi_delle_lapidi', 'SELECT') then
    raise exception 'indirizzi_delle_lapidi è leggibile dal client';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'blocca_indirizzo_di_una_lapide' and tgrelid = 'auth.users'::regclass) then
    raise exception 'manca il trigger sulla registrazione';
  end if;
  if has_function_privilege('anon', 'public.indirizzo_di_un_account_cancellato(text)', 'execute')
     or has_function_privilege('authenticated', 'public.indirizzo_di_un_account_cancellato(text)', 'execute') then
    raise exception 'il controllo dell''indirizzo è eseguibile dal client';
  end if;
  if obj_description('public.delete_own_account(boolean)'::regprocedure) not like '20261203100000:%' then
    raise exception 'delete_own_account(boolean) non è quella di 20261203100000';
  end if;
end $$;
