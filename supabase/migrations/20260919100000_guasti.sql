-- KIREO — i guasti ce li scriviamo noi.
--
-- PERCHÉ. Fino al 18/09 un guasto del motore viveva in un solo posto: i log di
-- runtime di Vercel. Tre cose, tutte vere insieme:
--   1. non li leggevamo — il filtro di `npm run banco log` conosceva i guasti
--      della generazione AI e non quelli delle scritture, quindi una tappa
--      fermata da un `update` che non atterra passava senza essere vista;
--   2. anche leggendoli, la conservazione è di poche ore: il 13/09 le righe del
--      `marketing > quartiere` erano già sparite quando siamo andati a
--      cercarle, e il gesto che le ha cancellate è stato il redeploy con cui
--      stavamo riparando;
--   3. il codice SA già di aver fallito — `segnalaFallito()` lo conta per la
--      mail. Non stiamo aggiungendo una diagnosi: stiamo smettendo di buttare
--      via una cosa che abbiamo già in mano.
-- Un guasto che vive solo nei log di un fornitore è un guasto che non
-- possediamo.
--
-- LA COLONNA CHE CONTA È `specie`. `revisione_esito` sapeva dire «non
-- riuscita» ma non «non riuscita COSA», e per quello il guasto del feedback
-- finale è vissuto settimane: una revisione mancante è una tappa da rigiocare,
-- un finale mancante è la pagina di chiusura di un intero progetto, e i due si
-- riparano in modi diversi. Qui `specie` nomina l'artefatto che NON è arrivato.
--
-- NESSUN CHECK SU `specie`, ed è una scelta contro l'abitudine di casa.
-- Ogni scrittura qui è best-effort: se l'insert viene RIFIUTATO, il guasto
-- sparisce in silenzio — cioè il difetto che questa tabella esiste per
-- chiudere, ricreato dalla guardia che avrebbe dovuto proteggerla. Un CHECK
-- troppo stretto sbaglia esattamente nella direzione comoda. L'insieme chiuso
-- sta nel tipo TypeScript (`SpecieGuasto` in lib/guasti/registra.ts), dove un
-- nome inventato lo ferma il compilatore prima del deploy e aggiungerne uno
-- non richiede una migrazione.

create table if not exists public.guasti (
  id uuid primary key default gen_random_uuid(),
  avvenuto_il timestamptz not null default now(),

  -- QUALE PROCESSO: 'cron/workshop-motore', 'escape/finalizza',
  -- 'workshop/elaborato/consegna'… Testo libero per la stessa ragione di
  -- `specie`, e perché i chiamanti di `chiamaJson` sono quattro e cresceranno.
  processo text not null,

  -- COSA NON È ARRIVATO (vedi sopra).
  specie text not null,

  -- PERCHÉ: il `motivo` di chiamaJson (chiamata | estrazione | troncata |
  -- forma_non_valida) oppure il messaggio dell'errore Postgres.
  motivo text,

  -- Il testo dell'errore, quando ce n'è uno da leggere.
  dettaglio text,

  -- SU QUALE RIGA, quando esiste. NESSUNA FOREIGN KEY, di proposito: una
  -- cascata da `workshop_iscrizioni` cancellerebbe la prova insieme
  -- all'iscrizione — e `npm run banco azzera-percorsi` cancella iscrizioni a
  -- ogni passata del robot. Un guasto su una riga che non c'è più resta un
  -- fatto. Stesso principio del codice meccanografico in `richieste_contatto`.
  iscrizione_id uuid,
  fase_id text,

  -- Lo passa il CHIAMANTE, mai dedotto per via transitiva. È la lezione del
  -- 31/08 (`guardia_lingua_giorno`): la colonna c'era, la chiave primaria pure,
  -- e nessuno la scriveva — quindi ogni riga finiva nel secchio «produzione» e
  -- il robot del banco risultava come studenti veri. Una separazione non
  -- scritta è peggio di una non costruita, perché sembra fatta.
  di_prova boolean not null default false
);

comment on table public.guasti is
  'Guasti che il codice conosce già: una riga per ogni cosa che non è successa per qualcuno. Sostituisce la dipendenza dai log di runtime di Vercel, che durano poche ore e che il filtro del banco non leggeva. Scrittura solo via registra_guasto().';

create index if not exists guasti_avvenuto_il_idx on public.guasti (avvenuto_il desc);
create index if not exists guasti_specie_idx on public.guasti (specie, avvenuto_il desc);

alter table public.guasti enable row level security;

-- Nessuna policy di scrittura: si scrive SOLO dalla funzione qui sotto (stesso
-- principio di ogni altra scrittura function-only del progetto). In lettura
-- solo admin; il banco legge con la service-role, che la RLS non la vede.
drop policy if exists guasti_select_admin on public.guasti;
create policy guasti_select_admin on public.guasti
  for select to authenticated
  using (public.current_ruolo() = 'admin');

-- ── la funzione ────────────────────────────────────────────────────────────
-- CHI PUÒ CHIAMARLA: solo `service_role`, e nessun altro.
--
-- Il chiamante è sempre `lib/guasti/registra.ts`, che usa il client
-- service-role — dal cron, dal finale di Escape e dalle consegne workshop.
-- Le ultime due girano dentro la sessione di uno studente, ma la SESSIONE non
-- è il CLIENT: la riga la scrive comunque la service-role. La prima stesura
-- di questo commento confondeva le due cose e concedeva l'esecuzione anche ad
-- `authenticated` — un grant che nessun chiamante usa e che avrebbe lasciato a
-- qualunque studente collegato la possibilità di scrivere righe arbitrarie
-- qui. Non esporrebbe niente (in lettura si arriva solo da admin), ma
-- **farebbe mentire la diagnostica**, che è precisamente la cosa che questa
-- tabella esiste per impedire.
--
-- SECURITY DEFINER resta, e non è ridondante per abitudine: la tabella non ha
-- NESSUNA policy di insert, quindi la scrittura non deve dipendere dalla RLS
-- di chi chiama. Oggi `service_role` la RLS la scavalca comunque; domani, se
-- un ruolo diverso ricevesse il grant, la funzione continuerebbe a essere
-- corretta invece di cominciare a fallire in silenzio.
create or replace function public.registra_guasto(
  p_processo text,
  p_specie text,
  p_motivo text default null,
  p_dettaglio text default null,
  p_iscrizione_id uuid default null,
  p_fase_id text default null,
  p_di_prova boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.guasti (processo, specie, motivo, dettaglio, iscrizione_id, fase_id, di_prova)
  values (
    p_processo,
    p_specie,
    p_motivo,
    -- Un messaggio d'errore lunghissimo (uno stack, un body HTML) non serve a
    -- nessuno e gonfia la tabella: si tiene l'inizio, che è dove sta la causa.
    left(p_dettaglio, 2000),
    p_iscrizione_id,
    p_fase_id,
    coalesce(p_di_prova, false)
  );
end;
$$;

comment on function public.registra_guasto(text, text, text, text, uuid, text, boolean) is
  'Scrive una riga di guasto. Chiamata da lib/guasti/registra.ts, sempre best-effort: se fallisce, il flusso che la invoca prosegue lo stesso.';

-- I DUE RUOLI SI NOMINANO, e non è pedanteria: `from public` NON BASTA.
-- [verificato da Mario sul DB live, 19/09] Con il solo `revoke … from public`,
-- questa stessa funzione risultava eseguibile da `anon` e `authenticated`.
-- Quei permessi non arrivano da PUBLIC: li concedono i DEFAULT PRIVILEGES di
-- Supabase, che danno EXECUTE esplicitamente a quei due ruoli su OGNI funzione
-- nuova dello schema `public`. Un `revoke` da PUBLIC non tocca un grant
-- esplicito a un ruolo — sono due cose diverse, e la prima sembra coprire la
-- seconda.
--
-- È la forma di difetto che ci insegue: una riga che DICHIARA di chiudere una
-- porta e ne chiude un'altra. E qui era peggio del solito, perché il `revoke`
-- scritto sopra il `grant` si legge come la riga che mette tutto a posto.
revoke all on function public.registra_guasto(text, text, text, text, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.registra_guasto(text, text, text, text, uuid, text, boolean) to service_role;

-- ── QUELLO CHE QUESTA TABELLA NON RISOLVE, e va saputo prima di fidarsene ───
-- Se il codice NON PARTE, nessuna riga viene scritta: un crash a freddo, un
-- modulo che non si carica, una variabile d'ambiente che ferma tutto prima del
-- primo `await`. La tabella resterà vuota — e una tabella vuota si legge come
-- «tutto bene» esattamente quando le cose vanno peggio. È la stessa cecità del
-- 18/09 con un nome migliore.
--
-- Per quella classe il guardiano resta un altro, e non è qui: `npm run
-- test:log5xx`, che pretende un `console.error` nel ramo che produce ogni 5xx.
-- Questa tabella non lo sostituisce e non deve sembrare che lo faccia.
--
-- E chi legge questi guasti deve poter distinguere «zero guasti» da «non ho
-- guardato»: `npm run banco guasti` lo fa, e dice sempre quale delle due sta
-- rispondendo.
--
-- Nessuna pulizia automatica: la tabella cresce solo quando qualcosa si rompe,
-- quindi una riga in più è sempre una notizia. Se un giorno crescesse davvero,
-- il problema da guardare non è la tabella.
