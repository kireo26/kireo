-- SPOSTARE LA FINESTRA DI UNA DIRETTA DAL PRODOTTO (Mario, 18/10).
--
-- Stasera la finestra della diretta è stata spostata due volte in SQL, perché
-- `eventi_update_propria_non_revisionato` si chiude appena l'evento è
-- approvato e un form di modifica non esiste né per l'ente né per l'admin. Un
-- ente vero che deve rimandare un webinar di venti minuti non aveva NESSUNA
-- strada — e noi l'abbiamo avuta solo perché Mario ha l'accesso al database.
--
-- UNA FUNZIONE E NON UNA POLICY, perché la regola è su DUE colonne e non sulla
-- riga: aprire all'ente l'update di un evento approvato gli lascerebbe
-- riscrivere anche titolo, ore PCTO e video dopo la revisione KIREO.
-- `sposta_finestra_evento` tocca SOLO `data_inizio` e `data_fine`.
--
-- QUANDO NO: a diretta CHIUSA. La chiusura ha già certificato presenze e
-- scritto ore contro QUELLA finestra (la copertura si calcola sulla durata
-- programmata): spostarla dopo renderebbe la ricevuta incoerente con la
-- finestra che la produce.
--
-- QUELLO CHE NON FA, dichiarato: non avvisa gli iscritti. Le pagine leggono la
-- finestra a ogni caricamento (e la pagina live si ricalcola da sola), ma chi
-- si era segnato l'orario non lo sa — è un pezzo che manca, non una scelta.

create or replace function public.sposta_finestra_evento(
  p_evento_id uuid,
  p_data_inizio timestamptz,
  p_data_fine timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizzatore uuid;
  v_chiusa timestamptz;
begin
  select organizzatore_id, diretta_chiusa_il into v_organizzatore, v_chiusa
  from public.eventi where id = p_evento_id;

  if not found then
    raise exception 'evento_non_trovato';
  end if;

  -- Rami affermativi con `else raise`: NULL-safe per costruzione.
  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore is not null and v_organizzatore = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  if v_chiusa is not null then
    raise exception 'diretta_gia_chiusa';
  end if;

  if p_data_inizio is null or p_data_fine is null then
    raise exception 'date_mancanti';
  end if;

  if p_data_fine <= p_data_inizio then
    raise exception 'fine_prima_di_inizio';
  end if;

  update public.eventi
  set data_inizio = p_data_inizio, data_fine = p_data_fine
  where id = p_evento_id;
end;
$$;

revoke all on function public.sposta_finestra_evento(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.sposta_finestra_evento(uuid, timestamptz, timestamptz) to authenticated;
