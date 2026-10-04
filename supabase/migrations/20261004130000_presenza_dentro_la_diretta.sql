-- IL BATTITO CONTAVA PRIMA CHE LA DIRETTA ESISTESSE.
--
-- Il 4/10, prima diretta vera del progetto. Iscrizione alle 19:08:24, primo
-- ping alle 19:08:31, evento programmato 19:15 → 19:20, quattro ping in
-- tutto. Alle 19:20:15 il sistema ha certificato la presenza.
--
-- IL CONTO, ESEGUITO E NON DEDOTTO: `ping_attesi_evento` restituisce la
-- durata dell'evento in minuti (un ping atteso al minuto), quindi 5 per un
-- evento di cinque minuti; `chiudi_diretta_evento` certifica a
-- `least(1.0, ping_totali / ping_attesi) >= 0.75`, cioè a 3,75 → quattro
-- ping. Quattro ping sono esattamente quelli che c'erano, e stavano TUTTI
-- prima dell'inizio. La soglia è stata raggiunta senza un solo ping dentro
-- la diretta.
--
-- NON È UNA SOGLIA TROPPO BASSA: è il NUMERATORE raccolto su una finestra
-- più larga del DENOMINATORE. I ping si raccoglievano su
-- `evento_in_finestra_diretta` — da `data_inizio - 15 minuti` a `data_fine`,
-- venti minuti per questo evento — e si contavano contro i cinque minuti
-- programmati. Quattro volte il necessario senza vedere un secondo di
-- diretta.
--
-- DA DOVE VIENE, ed è la specie di casa: `statoDiretta` (lib/live.ts) dice
-- `in_corso` da quindici minuti prima, e il suo commento dichiara di servire
-- «solo per decidere COSA MOSTRARE» — che è giusto, perché chi arriva cinque
-- minuti prima deve vedere il player comparire da sé. Ma `PannelloLive`
-- usava lo stesso `stato === "in_corso"` per accendere l'heartbeat. **Uno
-- specchio scritto per una domanda, consumato per un'altra** — e il commento
-- che ne dichiarava lo scopo è precisamente la cosa che lo faceva sembrare
-- sicuro.
--
-- LA CURA È UNA FUNZIONE NUOVA, NON UNA FINESTRA ALLARGATA O STRETTA.
-- `evento_in_finestra_diretta` NON SI TOCCA, e non per prudenza: il suo
-- altro chiamante vivo è la policy di insert su `domande_live`, e una
-- domanda scritta dieci minuti prima dell'inizio è legittima (se un domani
-- si vorrà stringere anche quella è una decisione a sé, non una conseguenza
-- di questa). Quella funzione risponde a «la pagina della diretta è viva»;
-- questa risponde a «la diretta sta andando», che è un'altra domanda.
--
-- I PING GIÀ REGISTRATI NON SI SCONTANO, e le certificazioni già fatte
-- restano: `presenze_live` tiene un contatore solo (`ping_totali`), quindi i
-- ping del pre-roll già raccolti sono indistinguibili da quelli della
-- diretta — rifarne il conto a posteriori sarebbe inventare una ripartizione
-- che il dato non contiene. Si smette in avanti, come per il video che non
-- si vede (lib/sondaYoutube.ts).
--
-- ⚠️ IL CASO SIMMETRICO RESTA APERTO, ED È UNA DOMANDA SUL DENOMINATORE.
-- `chiudi_diretta_evento` si rifiuta di girare prima di `data_fine`, quindi
-- l'ente non può chiudere in anticipo dal bottone — ma può smettere di
-- trasmettere, e allora chi ha seguito tutta la diretta VERA ha una
-- copertura calcolata sulla durata PROGRAMMATA e può restare sotto soglia.
-- Oggi la durata programmata è la sola che conosciamo: la vera la si
-- saprebbe solo se la chiusura lasciasse una traccia sull'evento, che è un
-- lavoro a sé (il §6 del 4/10). Non si inventa qui.

-- La finestra STRETTA: la diretta sta andando. Sorella di
-- `evento_in_finestra_diretta`, SECURITY INVOKER per la stessa ragione (si
-- appoggia alla RLS di lettura pubblica su `eventi`, che espone i soli
-- approvati: nessun bisogno di bypassare niente per una lettura che il
-- chiamante può già fare). Lo stesso ripiego sulla durata quando `data_fine`
-- manca, così le due finestre non possono divergere sulla fine.
create or replace function public.evento_in_diretta(p_evento_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = p_evento_id
      and e.stato = 'approvato'
      and now() >= e.data_inizio
      and now() < coalesce(e.data_fine, e.data_inizio + interval '3 hours')
  );
$$;

comment on function public.evento_in_diretta(uuid) is
  'La diretta sta andando: da data_inizio (non 15 minuti prima) a data_fine. Usata da ping_presenza_live perché la presenza si conta sulla diretta, non sulla finestra in cui la pagina è viva — vedi la migration 20261004130000 per il conto che l''ha resa necessaria. Per «la pagina della diretta è viva» resta evento_in_finestra_diretta.';

-- Corpo ripreso tale e quale da 20260726110000_diretta_presenze_domande.sql:
-- l'unica differenza è la funzione della guardia (riga `if not
-- public.evento_in_diretta(...)`). L'eccezione conserva il nome
-- `evento_non_in_corso`, che il route e il client già trattano come esito
-- atteso e non come guasto — e che adesso è anche più preciso di prima.
create or replace function public.ping_presenza_live(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'non_autenticato';
  end if;

  if not exists (
    select 1 from public.iscrizioni_eventi
    where evento_id = p_evento_id and student_id = v_user_id
  ) then
    raise exception 'non_iscritto';
  end if;

  if not public.evento_in_diretta(p_evento_id) then
    raise exception 'evento_non_in_corso';
  end if;

  insert into public.presenze_live (evento_id, user_id)
  values (p_evento_id, v_user_id)
  on conflict (evento_id, user_id) do update
  set ultimo_ping = now(), ping_totali = public.presenze_live.ping_totali + 1;
end;
$$;

-- `create or replace` conserva i privilegi (verificato il 26/09), quindi il
-- revoke di 20260926110000_chiudi_definer_scrittura.sql resta in piedi da
-- sé. Ripetuto qui perché il file sia autosufficiente: una revoca è
-- idempotente, e chi applica questa migration su un database che non ha
-- ancora quella non deve indovinare.
revoke all on function public.ping_presenza_live(uuid) from public, anon;
grant execute on function public.ping_presenza_live(uuid) to authenticated;
