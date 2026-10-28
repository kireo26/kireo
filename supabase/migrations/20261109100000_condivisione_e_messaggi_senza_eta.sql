-- CONDIVIDERE IL PROFILO E SCRIVERE A UN ENTE TORNANO APERTI AI MINORENNI
-- (28/10, decisione di Mario).
--
-- Il blocco dei 18 anni su questi due gesti era nato il 27/07
-- (20260727100000, «la piattaforma è completa per i maggiorenni»), e nessuna
-- legge lo chiedeva: in Italia il consenso al trattamento nei servizi digitali
-- vale dai 14 anni (art. 8 GDPR, art. 2-quinquies del Codice privacy), e i 14
-- anni sono già il minimo per iscriversi (vincolo profiles_eta_minima,
-- 20260711140000, più i due form). Su una piattaforma di quarte e quinte il
-- blocco chiudeva i due gesti alla gran parte di chi ci sta.
--
-- Cosa NON cambia:
-- - le comunicazioni facoltative di KIREO e le newsletter degli enti restano
--   ai soli maggiorenni (consenso_dato_da_maggiorenne, 20261107110000). Lì il
--   limite è una PROMESSA DELLA NOSTRA INFORMATIVA (/privacy), non un divieto
--   di legge: se l'informativa cambia, cambia una riga;
-- - cosa vede l'ente di chi condivide: nome, cognome, scuola, aree. Mai email
--   o telefono, e il contatto resta dentro i messaggi di KIREO;
-- - i tetti: 5 conversazioni al giorno, 20 messaggi al giorno per
--   conversazione, l'ente che scrive solo con un piano a pagamento.
--
-- Le due funzioni sono quelle di 20260727160000 con il solo controllo
-- sull'età tolto (create or replace: i privilegi restano quelli di
-- 20260926110000). current_e_maggiorenne() resta: la leggono altri.

drop policy if exists manifestazioni_interesse_insert_own on public.manifestazioni_interesse;
create policy manifestazioni_interesse_insert_own
  on public.manifestazioni_interesse for insert
  to authenticated
  with check (student_id = auth.uid());

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


comment on function public.apri_conversazione_ente(uuid, text) is
  'Lo studente apre una conversazione con un ente attivo (5 al giorno). Dal 20261109100000 senza limite d''età: il minimo è quello dell''iscrizione, 14 anni.';
comment on function public.invia_messaggio_ente(uuid, text) is
  'Un messaggio in una conversazione aperta, dallo studente o dall''ente con un piano a pagamento (20 al giorno). Dal 20261109100000 senza limite d''età per lo studente.';

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'manifestazioni_interesse'
               and policyname = 'manifestazioni_interesse_insert_own' and with_check like '%maggiorenne%') then
    raise exception 'la policy di insert guarda ancora l''età';
  end if;
  if pg_get_functiondef('public.apri_conversazione_ente(uuid, text)'::regprocedure) like '%maggiorenne%'
     or pg_get_functiondef('public.invia_messaggio_ente(uuid, text)'::regprocedure) like '%maggiorenne%' then
    raise exception 'una funzione dei messaggi guarda ancora l''età';
  end if;
end $$;
