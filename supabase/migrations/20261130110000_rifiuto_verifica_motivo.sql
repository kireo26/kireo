-- Lo studente rifiutato riceve il motivo (01/11, passo 3 del capitolo della
-- scuola). B: le colonne, la funzione nuova, la notifica, il trigger.
--
-- COSA SUCCEDEVA PRIMA. `verifica_studente(…, 'rifiutato')` svuotava
-- `school_code` e `classe` e non diceva niente a nessuno: lo studente apriva
-- il profilo e trovava la scuola sparita, senza sapere né chi né perché.
--
-- COSA SUCCEDE ADESSO (Mario, 01/11):
--   • il rifiuto pretende un motivo da un elenco corto (`motivo_rifiuto_verifica`,
--     in A), mai un testo libero;
--   • lo studente riceve una notifica dentro KIREO (`verifica_rifiutata`, con
--     `riferimento_id` = il suo id: porta al suo profilo);
--   • il motivo resta anche sulla SUA riga, con il nome della scuola COPIATO
--     al momento del rifiuto. «Una notifica racconta un fatto, una riga nel
--     profilo descrive uno stato»: e siccome il rifiuto svuota il codice della
--     scuola, senza la copia la frase direbbe «una scuola non ti ha confermato»;
--   • la riga sparisce quando lo studente dichiara di nuovo una scuola: non è
--     una macchia, è lo stato di una pratica. Lo fa il trigger che già riporta a
--     «dichiarato» chi cambia scuola, nello stesso ramo.
--
-- LE COLONNE NON LE SCRIVE IL CLIENT. Dal rovesciamento del 28/10
-- (20261106100000) una colonna nuova non è concessa a nessuno finché qualcuno
-- non la dichiara nel registro: qui nessuno la dichiara. Le scrive solo
-- `verifica_studente` (definer) e le pulisce solo il trigger.
--
-- LA FIRMA CAMBIA, IN TRE TEMPI (la regola «mai un valore predefinito sui
-- parametri del controllo»): B aggiunge la versione a tre argomenti ACCANTO a
-- quella a due; poi il deploy; poi C (20261130120000) toglie quella a due. Un
-- valore predefinito sul motivo farebbe passare un rifiuto senza motivo e
-- senza dirlo. Nella finestra fra B e il deploy il codice di prima rifiuta
-- ancora con la firma a due, cioè come oggi: senza motivo e senza notifica.

alter table public.student_profiles
  add column rifiuto_motivo public.motivo_rifiuto_verifica,
  add column rifiuto_scuola_nome text,
  add column rifiuto_il timestamptz;

-- Tutte e tre o nessuna: un motivo senza la scuola direbbe «una scuola», una
-- scuola senza motivo direbbe un rifiuto senza ragione.
alter table public.student_profiles
  add constraint student_profiles_rifiuto_completo check (
    (rifiuto_motivo is null and rifiuto_scuola_nome is null and rifiuto_il is null)
    or (rifiuto_motivo is not null and rifiuto_scuola_nome is not null and rifiuto_il is not null)
  );

comment on column public.student_profiles.rifiuto_motivo is
  '20261130110000: il motivo dell''ultimo rifiuto della verifica, da un elenco chiuso. Lo scrive solo verifica_studente; lo pulisce il trigger quando lo studente dichiara di nuovo una scuola.';
comment on column public.student_profiles.rifiuto_scuola_nome is
  '20261130110000: il nome della scuola che ha rifiutato, COPIATO al rifiuto: school_code si svuota, e senza la copia lo studente leggerebbe «una scuola».';
comment on column public.student_profiles.rifiuto_il is
  '20261130110000: quando la scuola ha rifiutato.';

-- ── la funzione, a tre argomenti ────────────────────────────────────────────
create function public.verifica_studente(
  p_student_id uuid,
  p_esito public.stato_verifica_studente,
  p_motivo public.motivo_rifiuto_verifica
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scuola_id text;
  v_school_code text;
  v_nome_scuola text;
begin
  if not public.current_ha_permesso_staff('verifica_studenti') then
    raise exception 'non_autorizzato';
  end if;

  if p_esito not in ('verificato', 'rifiutato') then
    raise exception 'esito_non_valido';
  end if;

  -- Un rifiuto porta la sua ragione; una verifica non ne ha bisogno, e un
  -- motivo mandato con una verifica è un client confuso: si dice.
  if p_esito = 'rifiutato' and p_motivo is null then
    raise exception 'motivo_mancante';
  end if;
  if p_esito = 'verificato' and p_motivo is not null then
    raise exception 'motivo_solo_per_rifiuto';
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
    select denominazione into v_nome_scuola from public.schools where codice_meccanografico = v_school_code;

    update public.student_profiles
    set stato_verifica = 'rifiutato', verificato_da = auth.uid(), verificato_il = now(), school_code = null, classe = null,
        rifiuto_motivo = p_motivo, rifiuto_scuola_nome = coalesce(v_nome_scuola, v_school_code), rifiuto_il = now()
    where user_id = p_student_id;

    insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
    values (p_student_id, 'verifica_rifiutata', p_student_id);
  end if;
end;
$$;

revoke all on function public.verifica_studente(uuid, public.stato_verifica_studente, public.motivo_rifiuto_verifica) from public, anon;
grant execute on function public.verifica_studente(uuid, public.stato_verifica_studente, public.motivo_rifiuto_verifica) to authenticated;

-- ── il trigger: chi dichiara di nuovo una scuola non porta più il rifiuto ────
-- Identico a 20260715120000, più le tre colonne pulite nel secondo ramo.
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
    new.rifiuto_motivo := null;
    new.rifiuto_scuola_nome := null;
    new.rifiuto_il := null;
  end if;

  return new;
end;
$$;

-- ── si rilegge ───────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.verifica_studente(uuid, public.stato_verifica_studente, public.motivo_rifiuto_verifica)') is null then
    raise exception '20261130110000: verifica_studente a tre argomenti non c''è';
  end if;
  if has_function_privilege('anon', 'public.verifica_studente(uuid, public.stato_verifica_studente, public.motivo_rifiuto_verifica)', 'execute') then
    raise exception '20261130110000: un visitatore esegue verifica_studente';
  end if;
  if has_column_privilege('authenticated', 'public.student_profiles', 'rifiuto_motivo', 'UPDATE')
     or has_column_privilege('authenticated', 'public.student_profiles', 'rifiuto_motivo', 'INSERT') then
    raise exception '20261130110000: il client scrive il motivo del rifiuto';
  end if;
end $$;
