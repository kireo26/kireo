-- «PER EVENTO»: TRE NUMERI, OGNUNO DICE COSA CONTA (Mario, 27/10).
--
-- Fino a oggi la riga di un evento diceva «N iscritti · N partecipati», e
-- «partecipati» contava le presenze CERTIFICATE: per un ente «ha partecipato»
-- vuol dire «c'era», quindi chi si era collegato ed era rimasto sotto la soglia
-- spariva dal numero che l'ente legge come «quanti c'erano». Mancava proprio
-- il numero che l'ente vuole.
--
-- La vista guadagna `presenti` (in fondo: `create or replace view` aggiunge
-- colonne solo alla fine): studenti DISTINTI con almeno un battito sulla
-- diretta (`presenze_live`), cioè chi si è collegato, qualunque cosa sia
-- successo dopo. È NULL per un evento che non è una diretta: lì la presenza
-- non la misuriamo noi (la registra la scuola), e uno zero direbbe «non c'era
-- nessuno».
--
-- `partecipati` resta col suo nome nella vista (il codice di prima lo legge, e
-- rinominare una colonna di una vista vuol dire drop e create, cioè una
-- finestra in cui la pagina vecchia si rompe): cambia il nome A SCHERMO, che è
-- quello che l'ente legge. Il commento della vista dice cosa conta.
--
-- Una sottoquery scalare, non un secondo left join: un join su
-- `presenze_live` moltiplicherebbe le righe e gonfierebbe iscritti e
-- certificati lasciandoli plausibili (il difetto del 28/09).
--
-- E FUORI BOZZE E RIFIUTATI (Mario): «Per evento» racconta come sono andati
-- gli incontri, e un evento che non è mai stato pubblicato non è andato in
-- nessun modo. Restano approvati e in approvazione.
--
-- SI APPLICA PRIMA DEL DEPLOY: il codice nuovo legge `presenti`; quello di
-- prima non la nomina, e funziona uguale.
--
-- COME SI VERIFICA APPLICATA: `presenti` è fra le colonne di
-- `stats_eventi_istituzione` in `information_schema.columns` (la crea solo
-- questa migrazione).

create or replace view public.stats_eventi_istituzione as
select
  e.organizzatore_id as istituzione_id,
  e.id as evento_id,
  e.titolo,
  e.data_inizio,
  count(ie.id) as iscritti,
  count(*) filter (where ie.stato = 'partecipato') as partecipati,
  (e.domanda_consegna is not null) as domanda_posta,
  (select count(*) from public.consegne_evento ce where ce.evento_id = e.id) as risposte,
  case when e.tipo = 'webinar' then
    (select count(distinct pl.user_id) from public.presenze_live pl where pl.evento_id = e.id)
  end as presenti
from public.eventi e
left join public.iscrizioni_eventi ie on ie.evento_id = e.id
where (e.organizzatore_id = public.current_istituzione_id() or public.current_ruolo() = 'admin')
  and e.stato not in ('bozza', 'rifiutato')
group by e.organizzatore_id, e.id, e.titolo, e.data_inizio, e.domanda_consegna, e.tipo;

comment on view public.stats_eventi_istituzione is
  '20261103100000: per evento pubblicato (non bozze né rifiutati), solo per l''organizzatore (o admin). iscritti = ogni iscrizione, in qualunque stato; presenti = studenti distinti collegati alla diretta (NULL se non è una diretta); partecipati = presenze CERTIFICATE (soglia raggiunta o certificate a mano), mai più di iscritti — a schermo «con presenza certificata»; risposte = consegne_evento, con domanda_posta che dice se quel numero ha un senso.';

-- Il nome nel database resta `partecipati` (vedi sopra): il commento sulla
-- colonna è per chi lo legge senza contesto, perché il nome dice «c'era» e il
-- numero no.
comment on column public.stats_eventi_istituzione.partecipati is
  '⚠️ NON «chi c''era»: le presenze CERTIFICATE (soglia raggiunta alla chiusura della diretta, o certificate da una scuola, dall''ente o da KIREO). Chi si è collegato è `presenti`. A schermo: «Con presenza certificata».';
