-- IL VIDEO NON SI VEDE, E CHI TRASMETTE DEVE SAPERLO (Mario, 18/10, la diretta
-- fallita).
--
-- Stasera per un'ora la pagina dello studente ha mostrato «La diretta non si
-- vede qui — Lo stiamo segnalando a chi lo trasmette», e a chi trasmetteva non
-- è arrivato niente: la console dell'ente non diceva nulla, e Mario se n'è
-- accorto solo perché guardava anche il telefono. Il prodotto SAPEVA — il
-- player di ogni studente aveva sollevato l'errore — e lo ha scritto in faccia
-- allo studente senza dirlo a nessun altro. Quella frase era falsa.
--
-- Questa migrazione rende vera la frase:
--   • `player_live_stato`: una riga per (evento, studente) il cui player ha
--     sollevato un errore bloccante. Si RINNOVA ogni minuto finché il video
--     resta rotto, e si CANCELLA quando il player si riprende. Quindi il conto
--     dice chi NON STA VEDENDO adesso, non chi non ha visto una volta.
--   • `segnala_player_live`: l'unica strada per scriverla (SECURITY DEFINER,
--     nessuna policy di scrittura). Iscritto e dentro la finestra della
--     diretta, come `ping_presenza_live` — uno studente non può segnalare un
--     evento che non lo riguarda.
--   • `conteggio_player_rotti_live`: il numero per la console. Solo
--     l'organizzatore o l'admin; MAI righe individuali, mai user_id — stesso
--     principio di `conteggio_presenti_live`.
--   • una riga in `guasti` alla PRIMA segnalazione di un evento (e poi una
--     all'ora al massimo): una diretta rotta è un guasto, e stasera non ha
--     lasciato nessuna traccia da nessuna parte — la ricostruzione l'hanno
--     fatta due persone in chat.
--
-- Nessun dato trasformato.

create table if not exists public.player_live_stato (
  evento_id uuid not null references public.eventi (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  esito text not null
    constraint player_live_stato_esito check (esito in ('incorporamento_disattivato', 'non_disponibile')),
  segnalato_il timestamptz not null default now(),
  primary key (evento_id, user_id)
);

alter table public.player_live_stato enable row level security;

comment on table public.player_live_stato is
  'Chi in questo momento NON vede il video di una diretta: una riga per (evento, studente), rinnovata ogni minuto dal player finché l''errore dura e cancellata quando il player si riprende. Nessuna policy: scrittura solo via segnala_player_live (iscritto, dentro la finestra), lettura solo aggregata via conteggio_player_rotti_live (organizzatore o admin). Mai righe individuali per l''ente.';

create or replace function public.segnala_player_live(p_evento_id uuid, p_esito text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_titolo text;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;

  if not exists (
    select 1 from public.iscrizioni_eventi
    where evento_id = p_evento_id and student_id = v_uid
  ) then
    raise exception 'non_iscritto';
  end if;

  -- `p_esito` nullo vuol dire «il player si è ripreso»: la riga si toglie, e il
  -- conto della console scende da solo. Fuori dalla finestra si ammette solo
  -- questo (togliere una segnalazione non fa danni a nessuno).
  if p_esito is null then
    delete from public.player_live_stato where evento_id = p_evento_id and user_id = v_uid;
    return;
  end if;

  if not public.evento_in_finestra_diretta(p_evento_id) then
    raise exception 'fuori_finestra_diretta';
  end if;

  -- LA RIGA IN `guasti`, al massimo una all'ora per evento: la prima
  -- segnalazione è il fatto, le successive sono lo stesso fatto che continua.
  -- Dentro un blocco best-effort, come ogni scrittura di guasto: la
  -- segnalazione alla console non deve dipendere dal registro dei guasti.
  if not exists (
    select 1 from public.player_live_stato
    where evento_id = p_evento_id and segnalato_il > now() - interval '1 hour'
  ) then
    begin
      select titolo into v_titolo from public.eventi where id = p_evento_id;
      perform public.registra_guasto(
        p_processo => 'live/player',
        p_specie => 'video_diretta',
        p_motivo => p_esito,
        p_dettaglio => format('evento %s («%s»): il player di uno studente non riproduce il video', p_evento_id, coalesce(v_titolo, '?')),
        p_di_prova => public.e_profilo_di_prova(v_uid)
      );
    exception when others then
      raise warning 'segnala_player_live: guasto non registrato (%)', sqlerrm;
    end;
  end if;

  insert into public.player_live_stato (evento_id, user_id, esito, segnalato_il)
  values (p_evento_id, v_uid, p_esito, now())
  on conflict (evento_id, user_id) do update
    set esito = excluded.esito, segnalato_il = excluded.segnalato_il;
end;
$$;

revoke all on function public.segnala_player_live(uuid, text) from public, anon;
grant execute on function public.segnala_player_live(uuid, text) to authenticated;

-- IL NUMERO PER LA CONSOLE. Conta solo le segnalazioni RINNOVATE negli ultimi
-- tre minuti: il player le rinnova ogni sessanta secondi, quindi una riga più
-- vecchia è di qualcuno che ha chiuso la pagina — e contarlo vorrebbe dire
-- dire al moderatore che qualcuno non sta vedendo mentre quel qualcuno non c'è
-- più.
create or replace function public.conteggio_player_rotti_live(p_evento_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore uuid;
begin
  select organizzatore_id into v_organizzatore from public.eventi where id = p_evento_id;

  -- Rami affermativi con `else raise`: un'identità NULL non entra in nessuno
  -- dei due rami positivi, quindi è NULL-safe per costruzione.
  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore is not null and v_organizzatore = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  return (
    select count(*)::integer from public.player_live_stato
    where evento_id = p_evento_id and segnalato_il > now() - interval '3 minutes'
  );
end;
$$;

revoke all on function public.conteggio_player_rotti_live(uuid) from public, anon;
grant execute on function public.conteggio_player_rotti_live(uuid) to authenticated;
