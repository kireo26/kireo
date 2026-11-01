-- 20261201100000 — IL CODICE D'INVITO DEL TUTOR, E UN TETTO AI TENTATIVI (A: prima del deploy)
--
-- Il passo 5.1 del capitolo della scuola (Mario, 01/11). Tre buchi, misurati
-- leggendo le definizioni vive:
--
--   1. IL CODICE LO SCEGLIEVA CHI INSERISCE. `crea_invito_tutor` non era
--      definer: scriveva `school_staff` con i privilegi del referente, quindi
--      la colonna `codice_invito` era concessa al client e un referente che
--      inseriva la riga a mano poteva scegliersi il codice («SCELTO»). Ora la
--      funzione è definer e il client non inserisce più in `school_staff`: il
--      codice lo scrive solo lei.
--   2. IL CODICE ERA CORTO: 8 caratteri esadecimali, 32 bit. Ora 16 (64 bit),
--      in quattro gruppi (`TUTOR-ABCD-EF01-2345-6789`). Gli inviti di prima
--      restano validi: in produzione ce n'è uno non riscattato.
--   3. NIENTE CONTAVA I TENTATIVI, e c'erano due porte:
--      - `verifica_invito_tutor`, eseguibile da chiunque, anche senza account
--        (il default di `public`), che diceva «valido» e il NOME DELLA SCUOLA
--        a ogni codice giusto: un oracolo senza tetto;
--      - `redeem_invito_staff`, che un account senza profilo poteva chiamare
--        quante volte voleva.
--      Le sostituiscono `controlla_codice_invito` (solo il server: la route
--      `/api/scuola/invito/verifica` le passa un'impronta della rete di chi
--      chiede) e `riscatta_invito_tutor` (l'account), con lo stesso conto. Le
--      due di prima escono in C (`20261201110000`), DOPO il deploy: il codice
--      di prima le chiama.
--
-- PERCHÉ LE NUOVE NON SOLLEVANO SUL CODICE SBAGLIATO: un `raise` annulla la
-- transazione, e con lei la riga del tentativo. Un tetto che conta solo i
-- tentativi riusciti non conta niente. Quindi rispondono un esito.
--
-- IL TETTO (scelto, non misurato): 10 codici sbagliati in un'ora dalla stessa
-- rete per la verifica, 5 in un'ora dallo stesso account per il riscatto. Un
-- referente distratto non li raggiunge; uno script sì. Le righe hanno una vita
-- di un giorno e si potano a ogni chiamata: non sono un registro, sono un conto.
-- ⚠️ Il residuo, dichiarato: chi ha molte reti moltiplica il tetto. Con 64 bit
-- non serve a niente, ed è la ragione per cui il codice lungo viene prima.

create table if not exists public.tentativi_codice_invito (
  id bigint generated always as identity primary key,
  -- 'rete:<sha256>' per la verifica, 'account:<uuid>' per il riscatto. Testo,
  -- non una chiave verso profiles: la riga muore in un giorno, e non è un dato
  -- di nessuno da esportare.
  chiave text not null,
  riuscito boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists tentativi_codice_invito_chiave_idx on public.tentativi_codice_invito (chiave, created_at);
alter table public.tentativi_codice_invito enable row level security;
-- Nessuna policy e nessun privilegio: la leggono e la scrivono solo le due
-- funzioni qui sotto.
revoke all on public.tentativi_codice_invito from anon, authenticated;

comment on table public.tentativi_codice_invito is
  '20261201100000: il conto dei codici d''invito provati, per il tetto. Vita di un giorno.';

-- Il codice nuovo: 16 caratteri esadecimali in quattro gruppi.
create or replace function public.genera_codice_invito_tutor()
returns text
language sql
volatile
set search_path = public
as $$
  select 'TUTOR-' || substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4) || '-' || substr(h, 13, 4)
  from (select upper(replace(gen_random_uuid()::text, '-', '')) as h) x;
$$;
revoke all on function public.genera_codice_invito_tutor() from public, anon, authenticated;

create or replace function public.crea_invito_tutor(p_nome text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codice text;
begin
  -- IS DISTINCT FROM: current_ruolo_staff() è null per chi non è staff, e
  -- «null <> 'referente'» non entra nel ramo (20260715110000).
  if public.current_ruolo_staff() is distinct from 'referente' then
    raise exception 'non_autorizzato';
  end if;

  -- 20261201100000: definer, e il codice lo scrive solo questa funzione.
  v_codice := public.genera_codice_invito_tutor();

  insert into public.school_staff (scuola_profilo_id, ruolo_staff, user_id, codice_invito, nome_invitato, email_invitato, creato_da)
  values (public.current_scuola_profilo_id(), 'tutor', null, v_codice, p_nome, p_email, auth.uid());

  return v_codice;
end;
$$;
revoke all on function public.crea_invito_tutor(text, text) from public, anon;
grant execute on function public.crea_invito_tutor(text, text) to authenticated;

-- Il client non inserisce più in school_staff: l'unico che lo faceva era
-- crea_invito_tutor, che ora è definer. Registro delle colonne 181 → 174.
revoke insert on public.school_staff from authenticated;
revoke insert (scuola_profilo_id, ruolo_staff, user_id, codice_invito, nome_invitato, email_invitato, creato_da)
  on public.school_staff from authenticated;

-- Quanti codici sbagliati ha provato questa chiave nell'ultima ora.
create or replace function public.tentativi_invito_sbagliati(p_chiave text)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer from public.tentativi_codice_invito
  where chiave = p_chiave and not riuscito and created_at > now() - interval '1 hour';
$$;
revoke all on function public.tentativi_invito_sbagliati(text) from public, anon, authenticated;

-- La verifica della pagina /scuola/invito, per conto di chi non ha un account.
-- La chiama solo la route, con la service role, e un'impronta della rete.
create or replace function public.controlla_codice_invito(p_codice text, p_impronta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chiave text;
  v_scuola text;
  v_trovato boolean;
begin
  if p_impronta is null or length(p_impronta) < 16 then
    raise exception 'impronta_mancante';
  end if;
  v_chiave := 'rete:' || p_impronta;

  delete from public.tentativi_codice_invito where created_at < now() - interval '1 day';

  if public.tentativi_invito_sbagliati(v_chiave) >= 10 then
    return jsonb_build_object('esito', 'troppi_tentativi');
  end if;

  select true, s.denominazione into v_trovato, v_scuola
  from public.school_staff ss
  left join public.scuole_profili sp on sp.id = ss.scuola_profilo_id
  left join public.schools s on s.codice_meccanografico = sp.scuola_id
  where ss.codice_invito = p_codice and ss.user_id is null and ss.ruolo_staff = 'tutor';

  insert into public.tentativi_codice_invito (chiave, riuscito) values (v_chiave, coalesce(v_trovato, false));

  if v_trovato then
    return jsonb_build_object('esito', 'valido', 'nome_scuola', v_scuola);
  end if;
  return jsonb_build_object('esito', 'non_valido');
end;
$$;
revoke all on function public.controlla_codice_invito(text, text) from public, anon, authenticated;
grant execute on function public.controlla_codice_invito(text, text) to service_role;

-- Il riscatto, alla conferma dell'email: come redeem_invito_staff, ma conta i
-- tentativi e risponde un esito invece di sollevare sul codice sbagliato.
create or replace function public.riscatta_invito_tutor(p_codice text, p_nome text, p_cognome text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_chiave text;
  v_staff_id uuid;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    return jsonb_build_object('esito', 'gia_finalizzato');
  end if;

  v_chiave := 'account:' || v_uid::text;
  delete from public.tentativi_codice_invito where created_at < now() - interval '1 day';

  if public.tentativi_invito_sbagliati(v_chiave) >= 5 then
    return jsonb_build_object('esito', 'troppi_tentativi');
  end if;

  select id into v_staff_id
  from public.school_staff
  where codice_invito = p_codice and user_id is null and ruolo_staff = 'tutor';

  insert into public.tentativi_codice_invito (chiave, riuscito) values (v_chiave, v_staff_id is not null);

  if v_staff_id is null then
    return jsonb_build_object('esito', 'codice_non_valido');
  end if;

  insert into public.profiles (id, ruolo, nome, cognome)
  values (v_uid, 'tutor_scuola', p_nome, p_cognome);

  update public.school_staff
  set user_id = v_uid, attivo = true
  where id = v_staff_id;

  return jsonb_build_object('esito', 'riscattato');
end;
$$;
revoke all on function public.riscatta_invito_tutor(text, text, text) from public, anon;
grant execute on function public.riscatta_invito_tutor(text, text, text) to authenticated;

-- Si rilegge da sé.
do $$
begin
  if has_table_privilege('authenticated', 'public.school_staff', 'INSERT')
     or has_column_privilege('authenticated', 'public.school_staff', 'codice_invito', 'INSERT') then
    raise exception 'il client inserisce ancora in school_staff';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.crea_invito_tutor(text, text)'::regprocedure) then
    raise exception 'crea_invito_tutor non è definer';
  end if;
  if has_function_privilege('anon', 'public.controlla_codice_invito(text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.controlla_codice_invito(text, text)', 'execute') then
    raise exception 'controlla_codice_invito è raggiungibile dal client';
  end if;
  if has_function_privilege('anon', 'public.riscatta_invito_tutor(text, text, text)', 'execute') then
    raise exception 'riscatta_invito_tutor è raggiungibile senza account';
  end if;
  if has_table_privilege('authenticated', 'public.tentativi_codice_invito', 'SELECT') then
    raise exception 'il client legge tentativi_codice_invito';
  end if;
end $$;
