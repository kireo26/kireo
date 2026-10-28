-- CHI PUÒ CONDIVIDERE IL PROFILO CON UN ENTE E SCRIVERGLI: UNO STUDENTE CON
-- UNA DATA DI NASCITA (28/10). Cura di un difetto aperto da 20261109100000.
--
-- Il cancello dei 18 anni, tolto ieri, faceva per caso anche un altro lavoro:
-- `current_e_maggiorenne()` tratta una data assente come «minorenne», quindi
-- fermava chi la data non ce l'ha — gli account di prima che il campo fosse
-- obbligatorio, e quasi tutti i docenti e gli account d'ente, che una data non
-- la danno. Tolta l'età, il controllo restava `student_id = auth.uid()`, cioè
-- «chiunque, per sé»: misurato sulla replica il 28/10, uno studente senza data,
-- un docente e un account d'ente condividevano «il proprio profilo» con un ente
-- e aprivano una conversazione da «studente». È la specie «una protezione che
-- nessuno ha scelto può essere tolta da chiunque non sappia che c'è», e la
-- cura è scegliere quella protezione e scriverla.
--
-- La regola, in un posto solo: `puo_contattare_enti()` è vera per un profilo
-- con ruolo `studente` e una data di nascita. L'età minima non si ricontrolla
-- qui: la tiene già `profiles_eta_minima` (14 anni, 20260711140000), e una data
-- che c'è è una data che quel vincolo ha accettato. Una data assente non vale
-- come «abbastanza grande»: vale come «non lo sappiamo», e chi non lo sappiamo
-- non contatta un ente finché non ce lo dice (il modulo in /app glielo chiede).
--
-- Due errori distinti, perché la pagina dice due cose diverse:
-- `solo_studenti` e `data_nascita_mancante`.

create or replace function public.puo_contattare_enti()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.ruolo = 'studente' and p.data_nascita is not null
       from public.profiles p where p.id = auth.uid()),
    false);
$$;

create or replace function public.pretendi_contatto_enti()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ruolo public.profile_role;
  v_nascita date;
begin
  select ruolo, data_nascita into v_ruolo, v_nascita from public.profiles where id = auth.uid();
  if v_ruolo is distinct from 'studente' then
    raise exception 'solo_studenti';
  end if;
  if v_nascita is null then
    raise exception 'data_nascita_mancante';
  end if;
end;
$$;

revoke all on function public.puo_contattare_enti() from public, anon;
grant execute on function public.puo_contattare_enti() to authenticated;
revoke all on function public.pretendi_contatto_enti() from public, anon;
grant execute on function public.pretendi_contatto_enti() to authenticated;

drop policy if exists manifestazioni_interesse_insert_own on public.manifestazioni_interesse;
create policy manifestazioni_interesse_insert_own
  on public.manifestazioni_interesse for insert
  to authenticated
  with check (student_id = auth.uid() and public.puo_contattare_enti());

create or replace function public.apri_conversazione_ente(p_istituzione_id uuid, p_corpo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conteggio_oggi integer;
  v_conversazione_id uuid;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;
  perform public.pretendi_contatto_enti();
  if not exists (select 1 from public.istituzioni where id = p_istituzione_id and stato = 'attiva') then
    raise exception 'ente_non_disponibile';
  end if;

  select count(*) into v_conteggio_oggi
  from public.conversazioni_enti
  where student_id = v_uid
    and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;

  if v_conteggio_oggi >= 5 then
    raise exception 'troppe_conversazioni_oggi';
  end if;

  insert into public.conversazioni_enti (student_id, istituzione_id)
  values (v_uid, p_istituzione_id)
  returning id into v_conversazione_id;

  insert into public.messaggi_enti (conversazione_id, mittente, corpo)
  values (v_conversazione_id, 'studente', p_corpo);

  return v_conversazione_id;
end;
$$;

create or replace function public.invia_messaggio_ente(p_conversazione_id uuid, p_corpo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_istituzione_id uuid;
  v_stato public.conversazione_ente_stato;
  v_mittente public.messaggio_ente_mittente;
  v_conteggio_oggi integer;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  select student_id, istituzione_id, stato into v_student_id, v_istituzione_id, v_stato
  from public.conversazioni_enti where id = p_conversazione_id;

  if v_student_id is null then
    raise exception 'conversazione_non_trovata';
  end if;

  if v_uid = v_student_id then
    perform public.pretendi_contatto_enti();
    v_mittente := 'studente';
  elsif v_istituzione_id = public.current_istituzione_id() then
    if not exists (
      select 1 from public.istituzioni i
      join public.piani p on p.id = i.piano_id
      where i.id = v_istituzione_id and p.nome <> 'free'
    ) then
      raise exception 'piano_non_abilitato';
    end if;
    v_mittente := 'ente';
  else
    raise exception 'non_autorizzato';
  end if;

  if v_stato <> 'aperta' then
    raise exception 'conversazione_non_scrivibile';
  end if;

  select count(*) into v_conteggio_oggi
  from public.messaggi_enti
  where conversazione_id = p_conversazione_id
    and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;

  if v_conteggio_oggi >= 20 then
    raise exception 'troppi_messaggi_oggi';
  end if;

  insert into public.messaggi_enti (conversazione_id, mittente, corpo)
  values (p_conversazione_id, v_mittente, p_corpo);
end;
$$;


comment on function public.puo_contattare_enti() is
  '20261109110000: vera per chi può condividere il profilo con un ente e scrivergli, cioè uno studente con una data di nascita (l''età minima la tiene profiles_eta_minima). Una data assente vale «non lo sappiamo», non «abbastanza grande».';

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'manifestazioni_interesse'
                   and policyname = 'manifestazioni_interesse_insert_own' and with_check like '%puo_contattare_enti%') then
    raise exception 'la policy di insert non guarda chi può contattare un ente';
  end if;
  if pg_get_functiondef('public.apri_conversazione_ente(uuid, text)'::regprocedure) not like '%pretendi_contatto_enti%'
     or pg_get_functiondef('public.invia_messaggio_ente(uuid, text)'::regprocedure) not like '%pretendi_contatto_enti%' then
    raise exception 'una funzione dei messaggi non guarda chi può contattare un ente';
  end if;
end $$;
