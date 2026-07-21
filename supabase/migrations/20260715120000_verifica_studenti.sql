-- Verifica studenti: la scuola conferma che uno studente che si è
-- autodichiarato appartenente a lei è davvero un suo studente. Estende il
-- collegamento studente-scuola già esistente (student_profiles.school_code,
-- popolato in registrazione o via codice classe) invece di crearne uno
-- nuovo.

create type public.stato_verifica_studente as enum ('dichiarato', 'verificato', 'rifiutato');

alter table public.student_profiles
  add column stato_verifica public.stato_verifica_studente not null default 'dichiarato',
  add column verificato_da uuid references public.profiles (id),
  add column verificato_il timestamptz;

-- school_code e classe diventano nullable: uno studente rifiutato "torna
-- senza scuola" (vedi verifica_studente sotto, che azzera entrambi)
-- finché non ridichiara una scuola diversa.
alter table public.student_profiles alter column school_code drop not null;
alter table public.student_profiles alter column classe drop not null;

comment on column public.student_profiles.stato_verifica is
  'dichiarato: in attesa di verifica dalla scuola indicata. verificato: confermato dalla scuola, DEFINITIVO — nessun cambio scuola self-service dopo (vedi trigger blocco_cambio_scuola_verificato), la scuola stessa non può sganciare uno studente verificato (nessuna azione self-service lo permette). rifiutato: la scuola ha smentito l''appartenenza, lo studente torna senza scuola (school_code azzerato dalla funzione verifica_studente) e può ridichiararne una diversa.';

-- Blocca il cambio di school_code/classe una volta che lo studente è
-- verificato (self-service o da altre policy che scrivono student_
-- profiles): "verificato è definitivo" vale per chiunque scriva con i
-- propri privilegi di sessione, tranne un admin in casi eccezionali. Se lo
-- studente NON è (ancora) verificato e cambia school_code SENZA che la
-- stessa scrittura tocchi già stato_verifica esplicitamente (caso: un
-- self-service qualunque, es. ProfiloForm, che aggiorna solo school_code/
-- classe), la verifica torna "dichiarato" da capo — una nuova scuola
-- richiede una nuova verifica. La condizione "new.stato_verifica =
-- old.stato_verifica" è cruciale: senza di essa, questo stesso trigger
-- sovrascriverebbe silenziosamente un rifiuto esplicito appena scritto da
-- verifica_studente (che nella stessa UPDATE imposta sia stato_verifica=
-- 'rifiutato' sia school_code=null) — bug trovato testando esplicitamente
-- questo percorso, come richiesto.
create or replace function public.blocco_cambio_scuola_verificato()
returns trigger
language plpgsql
as $$
begin
  if old.stato_verifica = 'verificato' and public.current_ruolo() is distinct from 'admin' then
    if new.school_code is distinct from old.school_code or new.classe is distinct from old.classe then
      raise exception 'scuola_verificata_non_modificabile';
    end if;
  end if;

  if old.stato_verifica <> 'verificato'
     and new.school_code is distinct from old.school_code
     and new.stato_verifica = old.stato_verifica
  then
    new.stato_verifica := 'dichiarato';
    new.verificato_da := null;
    new.verificato_il := null;
  end if;

  return new;
end;
$$;

create trigger blocco_cambio_scuola_verificato
before update on public.student_profiles
for each row execute function public.blocco_cambio_scuola_verificato();

-- Verifica/rifiuto di uno studente: il referente sempre, il tutor solo se
-- delegato (school_staff.puo_verificare_studenti, vedi
-- current_ha_permesso_staff in 20260715110000) della scuola che lo
-- studente ha dichiarato, e solo su uno studente ancora "dichiarato" (uno
-- studente verificato non può essere sganciato da qui: "la scuola non può
-- sganciare"). SECURITY DEFINER: deve poter leggere/scrivere lo
-- student_profiles di un altro utente, cosa che nessuna policy self-service
-- permette (e non deve permettere).
create or replace function public.verifica_studente(p_student_id uuid, p_esito public.stato_verifica_studente)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scuola_id text;
  v_school_code text;
begin
  if not public.current_ha_permesso_staff('verifica_studenti') then
    raise exception 'non_autorizzato';
  end if;

  if p_esito not in ('verificato', 'rifiutato') then
    raise exception 'esito_non_valido';
  end if;

  v_scuola_id := public.current_scuola_id();

  select school_code into v_school_code
  from public.student_profiles
  where user_id = p_student_id and stato_verifica = 'dichiarato';

  if v_school_code is null or v_school_code <> v_scuola_id then
    raise exception 'studente_non_trovato';
  end if;

  if p_esito = 'verificato' then
    update public.student_profiles
    set stato_verifica = 'verificato', verificato_da = auth.uid(), verificato_il = now()
    where user_id = p_student_id;
  else
    update public.student_profiles
    set stato_verifica = 'rifiutato', verificato_da = auth.uid(), verificato_il = now(), school_code = null, classe = null
    where user_id = p_student_id;
  end if;
end;
$$;

grant execute on function public.verifica_studente(uuid, public.stato_verifica_studente) to authenticated;

-- ============ RLS: la scuola vede i propri studenti dichiarati/verificati
-- ============
-- Referente E tutor leggono gli studenti della propria scuola (nome,
-- classe, stato verifica) — MAI dati di profilazione: questa policy copre
-- solo student_profiles (school_code/classe/verifica), non activity_log né
-- score_aree, che restano visibili solo allo studente stesso (nessuna
-- policy nuova le tocca).
create policy student_profiles_select_scuola
  on public.student_profiles for select
  to authenticated
  using (
    public.current_ruolo_staff() in ('referente', 'tutor')
    and school_code = public.current_scuola_id()
  );

-- Anche il profilo anagrafico base (nome/cognome) dello studente, per le
-- stesse liste — stesso pattern già esistente per docente/referente_scuola
-- "legacy" (profiles_select_school_students), qui ristretto alla nuova
-- appartenenza scuola_profili invece che a school_code diretto sul docente.
create policy profiles_select_scuola_studenti
  on public.profiles for select
  to authenticated
  using (
    public.current_ruolo_staff() in ('referente', 'tutor')
    and ruolo = 'studente'
    and exists (
      select 1 from public.student_profiles sp
      where sp.user_id = profiles.id
        and sp.school_code = public.current_scuola_id()
    )
  );
