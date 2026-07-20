-- Area scuola — fondamenta: scuole_profili (stato di attivazione, distinto
-- dalla semplice anagrafica schools MIM di sola lettura, e dal meccanismo
-- conventions/class_codes già esistente e non toccato da questa migration)
-- e school_staff (collegamento utente <-> scuola per referente/tutor).
-- Stesso principio già usato per le istituzioni formative: registrazione
-- self-service, attivazione manuale KIREO a sbloccare le funzioni.

create type public.scuola_profilo_stato as enum ('richiesta', 'convenzionata', 'attiva', 'sospesa');

create table public.scuole_profili (
  id uuid primary key default gen_random_uuid(),
  scuola_id text not null unique references public.schools (codice_meccanografico),
  stato public.scuola_profilo_stato not null default 'richiesta',
  convenzione_firmata_il date,
  note_admin text,
  created_at timestamptz not null default now()
);

comment on table public.scuole_profili is
  'Stato di attivazione di una scuola sull''area riservata. Attivazione a due stadi: convenzione_firmata_il valorizzata -> stato convenzionata, poi stato attiva sblocca le funzioni. scuola_id è text perché referenzia schools.codice_meccanografico (chiave testuale del dataset MIM), non un uuid.';

create type public.school_staff_ruolo as enum ('referente', 'tutor');

-- user_id nullable: una riga con ruolo_staff='tutor' e user_id null è un
-- invito non ancora riscattato (vedi redeem_invito_staff sotto) — evita una
-- tabella "inviti" separata, riusando school_staff per entrambi gli stati
-- (in attesa / attivo). Un referente non è mai in questo stato "in attesa":
-- si crea sempre già con user_id valorizzato (self-registrazione).
create table public.school_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  scuola_profilo_id uuid not null references public.scuole_profili (id) on delete cascade,
  ruolo_staff public.school_staff_ruolo not null,
  attivo boolean not null default true,
  codice_invito text unique,
  nome_invitato text,
  email_invitato text,
  creato_da uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint school_staff_referente_ha_utente check (ruolo_staff = 'tutor' or user_id is not null),
  constraint school_staff_invito_solo_tutor check (user_id is not null or ruolo_staff = 'tutor')
);

comment on table public.school_staff is
  'Collega un utente (referente o tutor) alla scuola che rappresenta. Un tutor invitato ma non ancora registrato ha user_id null e un codice_invito da riscattare (redeem_invito_staff).';

-- Un solo referente attivo per scuola.
create unique index school_staff_un_referente_attivo_idx
  on public.school_staff (scuola_profilo_id)
  where ruolo_staff = 'referente' and attivo = true and user_id is not null;

create index school_staff_scuola_profilo_idx on public.school_staff (scuola_profilo_id);
create index school_staff_user_id_idx on public.school_staff (user_id);

alter table public.scuole_profili enable row level security;
alter table public.school_staff enable row level security;

-- Scuola dello staff corrente, per le policy RLS dell'intera area scuola —
-- SECURITY DEFINER sullo stesso principio di current_istituzione_id: legge
-- school_staff bypassando le sue stesse RLS (evita ricorsione), restituisce
-- solo un id, mai dati sensibili.
create or replace function public.current_scuola_profilo_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select scuola_profilo_id from public.school_staff
  where user_id = auth.uid() and attivo = true
  limit 1;
$$;

-- Ruolo dello staff corrente ('referente'/'tutor'): solo il referente
-- verifica studenti, crea/disattiva staff, vede lo stato di attivazione.
create or replace function public.current_ruolo_staff()
returns public.school_staff_ruolo
language sql
stable
security definer
set search_path = public
as $$
  select ruolo_staff from public.school_staff
  where user_id = auth.uid() and attivo = true
  limit 1;
$$;

-- Codice meccanografico (schools.codice_meccanografico) della scuola dello
-- staff corrente: student_profiles.school_code è testuale (stesso dominio
-- del dataset MIM), mentre current_scuola_profilo_id() è l'uuid interno di
-- scuole_profili — questo helper fa la traduzione una volta sola invece di
-- ripetere la sotto-query in ogni policy che confronta i due.
create or replace function public.current_scuola_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select scuola_id from public.scuole_profili where id = public.current_scuola_profilo_id();
$$;

grant execute on function public.current_scuola_profilo_id() to authenticated;
grant execute on function public.current_ruolo_staff() to authenticated;
grant execute on function public.current_scuola_id() to authenticated;

-- ============ scuole_profili ============
-- Referente/tutor si autenticano PRIMA di avere un school_staff (durante la
-- registrazione, vedi finalize_registration_scuola sotto): current_scuola_
-- profilo_id() non può coprire la lettura della riga appena creata in
-- quella stessa chiamata (stesso ordinamento circolare del bug istituzioni:
-- vedi 20260713190000_fix_finalize_registration_istituzione.sql). Per
-- questo finalize_registration_scuola è SECURITY DEFINER — non per
-- bypassare un controllo di sicurezza, ma perché deve trovare-o-creare una
-- riga condivisa prima che esista qualunque collegamento privato
-- dell'utente che la chiama.
create policy scuole_profili_select_propria
  on public.scuole_profili for select
  to authenticated
  using (id = public.current_scuola_profilo_id());

create policy scuole_profili_admin_tutto
  on public.scuole_profili for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- ============ school_staff ============
create policy school_staff_select_propria_scuola
  on public.school_staff for select
  to authenticated
  using (scuola_profilo_id = public.current_scuola_profilo_id());

create policy school_staff_admin_tutto
  on public.school_staff for all
  to authenticated
  using (public.current_ruolo() = 'admin')
  with check (public.current_ruolo() = 'admin');

-- Solo il referente crea inviti tutor (righe con user_id null): niente
-- insert self-service per righe con user_id valorizzato, quella scrittura
-- passa sempre da finalize_registration_scuola/redeem_invito_staff
-- (SECURITY DEFINER), mai da un insert diretto lato client.
create policy school_staff_insert_invito_referente
  on public.school_staff for insert
  to authenticated
  with check (
    public.current_ruolo_staff() = 'referente'
    and scuola_profilo_id = public.current_scuola_profilo_id()
    and ruolo_staff = 'tutor'
    and user_id is null
  );

-- Il referente disattiva (o riattiva) i tutor della propria scuola; non può
-- toccare la propria riga di referente da qui (nessun self-service per
-- sganciarsi/promuoversi), né quella di altri referenti.
create policy school_staff_update_tutor_referente
  on public.school_staff for update
  to authenticated
  using (
    public.current_ruolo_staff() = 'referente'
    and scuola_profilo_id = public.current_scuola_profilo_id()
    and ruolo_staff = 'tutor'
  )
  with check (
    public.current_ruolo_staff() = 'referente'
    and scuola_profilo_id = public.current_scuola_profilo_id()
    and ruolo_staff = 'tutor'
  );

-- ============ profiles: anti-autoescalation aggiornata ============
-- (20260710180300, poi 20260713110000): referente_scuola diventa self-
-- service come istituzione — l'account si crea al signup, solo scuole_
-- profili.stato governa cosa sblocca. tutor_scuola è tecnicamente self-
-- insertabile per lo stesso motivo (il ruolo da solo non apre nessuna
-- porta: ogni policy dell'area scuola controlla school_staff.attivo, non
-- profiles.ruolo), ma nella pratica il profilo tutor si crea SOLO tramite
-- redeem_invito_staff, che valida un codice invito prima di scrivere.
-- L'unico ruolo che resta vietato in self-service è admin.
drop policy profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and ruolo <> 'admin');

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and ruolo <> 'admin');

-- ============ finalizzazione registrazione referente ============
-- Crea (o riusa, se un altro referente l'ha già richiesta) la riga scuole_
-- profili per la scuola scelta, il profilo con ruolo referente_scuola, e il
-- collegamento school_staff (ruolo_staff='referente', attivo=true). "Un
-- solo referente attivo per scuola" resta garantito dall'indice unico
-- parziale sopra: un secondo referente che tenta di registrarsi per la
-- stessa scuola fa fallire l'intera chiamata (23505), senza scritture
-- parziali (un'unica transazione PL/pgSQL).
create or replace function public.finalize_registration_scuola(
  p_scuola_id text,
  p_nome text,
  p_cognome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_scuola_profilo_id uuid;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    return; -- già finalizzato (es. link email aperto due volte)
  end if;

  select id into v_scuola_profilo_id from public.scuole_profili where scuola_id = p_scuola_id;

  if v_scuola_profilo_id is null then
    v_scuola_profilo_id := gen_random_uuid();
    insert into public.scuole_profili (id, scuola_id, stato)
    values (v_scuola_profilo_id, p_scuola_id, 'richiesta');
  end if;

  insert into public.profiles (id, ruolo, nome, cognome)
  values (v_uid, 'referente_scuola', p_nome, p_cognome);

  insert into public.school_staff (user_id, scuola_profilo_id, ruolo_staff, attivo, creato_da)
  values (v_uid, v_scuola_profilo_id, 'referente', true, v_uid);
end;
$$;

grant execute on function public.finalize_registration_scuola(text, text, text) to authenticated;

-- ============ invito/riscatto tutor ============
-- Genera un codice invito (righe school_staff con user_id null): usa lo
-- stesso principio di leggerezza di class_codes, ma con un codice
-- single-use invece di un contatore max_usi. SECURITY DEFINER: il referente
-- non ha (né deve avere) privilegi diretti per generare un codice
-- imprevedibile lato client — meglio centralizzarlo qui.
create or replace function public.crea_invito_tutor(p_nome text, p_email text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_codice text;
begin
  -- IS DISTINCT FROM invece di <>: current_ruolo_staff() è null per chi
  -- non è staff di nessuna scuola, e "null <> 'referente'" vale null (non
  -- true) in SQL — un IF con condizione null non entra nel ramo, quindi
  -- <> da solo lascerebbe passare chiunque non sia staff. Stesso motivo
  -- per ogni controllo equivalente più sotto in questo file e negli altri
  -- migration di quest'area (bug trovato testando esplicitamente questo
  -- pattern, come richiesto).
  if public.current_ruolo_staff() is distinct from 'referente' then
    raise exception 'non_autorizzato';
  end if;

  -- Costruito da gen_random_uuid() invece di gen_random_bytes(): niente
  -- dipendenza dall'estensione pgcrypto, gen_random_uuid() è nel core di
  -- Postgres dalla 13 (stessa funzione già usata per ogni id di questo
  -- schema).
  v_codice := 'TUTOR-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 8));

  insert into public.school_staff (scuola_profilo_id, ruolo_staff, user_id, codice_invito, nome_invitato, email_invitato, creato_da)
  values (public.current_scuola_profilo_id(), 'tutor', null, v_codice, p_nome, p_email, auth.uid());

  return v_codice;
end;
$$;

grant execute on function public.crea_invito_tutor(text, text) to authenticated;

-- Verifica pubblica di un codice invito (per la pagina di riscatto, prima
-- del signup): non espone dati della scuola oltre al nome, sullo stesso
-- principio di check_class_code.
create or replace function public.verifica_invito_tutor(p_codice text)
returns table (valido boolean, nome_scuola text)
language sql
stable
security definer
set search_path = public
as $$
  select
    (ss.id is not null) as valido,
    s.denominazione as nome_scuola
  from (select 1) as uno
  left join public.school_staff ss on ss.codice_invito = p_codice and ss.user_id is null and ss.ruolo_staff = 'tutor'
  left join public.scuole_profili sp on sp.id = ss.scuola_profilo_id
  left join public.schools s on s.codice_meccanografico = sp.scuola_id;
$$;

grant execute on function public.verifica_invito_tutor(text) to anon, authenticated;

-- Riscatto del codice invito: crea il profilo tutor e reclama la riga
-- school_staff in attesa. SECURITY DEFINER per lo stesso motivo di
-- finalize_registration_scuola (deve leggere/aggiornare una riga non
-- ancora collegata all'utente che chiama).
create or replace function public.redeem_invito_staff(
  p_codice text,
  p_nome text,
  p_cognome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_staff_id uuid;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    return; -- già finalizzato (es. link email aperto due volte)
  end if;

  select id into v_staff_id
  from public.school_staff
  where codice_invito = p_codice and user_id is null and ruolo_staff = 'tutor';

  if v_staff_id is null then
    raise exception 'codice_non_valido';
  end if;

  insert into public.profiles (id, ruolo, nome, cognome)
  values (v_uid, 'tutor_scuola', p_nome, p_cognome);

  update public.school_staff
  set user_id = v_uid, attivo = true
  where id = v_staff_id;
end;
$$;

grant execute on function public.redeem_invito_staff(text, text, text) to authenticated;
