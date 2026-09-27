-- KIREO — il terzo numero: quante risposte sono arrivate.
--
-- In `Statistiche → Per evento` l'ente vede due numeri, iscritti e partecipati.
-- Il terzo è la misura di ATTENZIONE — quello che distingue «la scheda era
-- aperta» da «ha seguito» — e va in fila con gli altri due, perché i tre insieme
-- raccontano una scala: chi si è iscritto, chi c'era, chi ha risposto.
--
-- DUE VINCOLI, e sono quelli della vista che si sta sostituendo:
--   1. passa da una vista AGGREGATA, non da una query che restituisce righe. Il
--      `comment` di questa vista dice «Nessun elenco di studenti» e quel confine
--      non si aggira per comodità di conteggio: qui si conta, non si elenca.
--   2. zero si scrive. Un ente che non vede il numero pensa che non lo
--      misuriamo — `zero ≠ non ho guardato` vale anche verso l'esterno.
--
-- PERCHÉ UNA SOTTOQUERY SCALARE E NON UN SECONDO `left join`. La vista raggruppa
-- su `eventi` con un `left join` su `iscrizioni_eventi` e conta con
-- `count(*) filter (…)`. Un secondo `left join` su `consegne_evento`
-- moltiplicherebbe le righe di quel prodotto e **gonfierebbe i due numeri che
-- esistono già** — un difetto che non si vede, perché i numeri restano
-- plausibili. La sottoquery scalare non tocca il raggruppamento.
--
-- SICUREZZA: invariata, ed è la ragione per cui la riga nuova sta QUI. Questa
-- vista NON usa `security_invoker`, quindi gira coi privilegi del proprietario e
-- può contare righe di `consegne_evento` che appartengono agli studenti (la loro
-- RLS è «solo le proprie») — esattamente come già fa per `iscrizioni_eventi`. La
-- `WHERE` finale decide chi vede cosa. Mai una riga individuale nella `SELECT`:
-- il testo di una risposta non esce da KIREO, e da qui non è nemmeno
-- raggiungibile (si conta `id`, non si legge `testo`).
--
-- `create or replace view` accetta colonne nuove solo IN CODA: `domanda_posta` e
-- `risposte` sono le ultime due, l'ordine delle altre non cambia.
--
-- DUE COLONNE E NON UNA, perché sono due fatti diversi e si leggono in modi
-- opposti: `risposte = 0` su un evento in cui una domanda è stata posta vuol dire
-- «nessuno ha risposto»; su un evento senza domanda vorrebbe dire «non è stato
-- chiesto niente», e stampato come uno zero somiglierebbe a un fallimento che non
-- c'è stato. La pagina mostra il terzo numero solo dove una domanda esiste.

create or replace view public.stats_eventi_istituzione as
select
  e.organizzatore_id as istituzione_id,
  e.id as evento_id,
  e.titolo,
  e.data_inizio,
  count(*) filter (where ie.stato = 'iscritto') as iscritti,
  count(*) filter (where ie.stato = 'partecipato') as partecipati,
  (e.domanda_consegna is not null) as domanda_posta,
  (select count(*) from public.consegne_evento ce where ce.evento_id = e.id) as risposte
from public.eventi e
left join public.iscrizioni_eventi ie on ie.evento_id = e.id
where e.organizzatore_id = public.current_istituzione_id() or public.current_ruolo() = 'admin'
group by e.organizzatore_id, e.id, e.titolo, e.data_inizio, e.domanda_consegna;

comment on view public.stats_eventi_istituzione is
  'Iscritti/partecipati/risposte per evento, solo per l''istituzione organizzatrice (o admin). Nessun elenco di studenti, e nessun testo: `risposte` è un conteggio di consegne_evento, `domanda_posta` dice se quel numero ha un senso (senza domanda è sempre zero).';
