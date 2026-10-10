// «Scarica i miei dati»: cosa il file contiene, e cosa dice quando non lo
// contiene.
//
// IL DIFETTO CHE HA FATTO SCRIVERE QUESTO FILE (5/10/2026, misurato facendo
// girare il codice vero contro un finto PostgREST). L'export interrogava
// cinque tabelle, di cui UNA non esiste da luglio — `webinar_registrations`,
// sostituita da `eventi`/`iscrizioni_eventi`, la cui migrazione fu rimossa
// dal repo prima di essere applicata. PostgREST rispondeva 404 PGRST205,
// l'errore veniva scartato, e `?? []` lo trasformava in un array vuoto.
//
// Quindi il file non era incompleto: AFFERMAVA UNA COSA FALSA. Dentro c'era
//
//     "prenotazioniWebinar": []
//
// che si legge «zero prenotazioni», non «non lo so» — `zero ≠ non ho
// guardato`, la regola di casa, scritta dentro un file che uno studente si
// porta via, nel punto esatto in cui ci chiede cosa abbiamo su di lui. E
// accanto c'era `"attivita": []`, che è un vuoto VERO: nel file i due erano
// indistinguibili.
//
// E il fatto che quella query fosse morta da tre mesi senza che nessuno se ne
// accorgesse vuol dire che quel bottone non l'ha mai premuto nessuno. Non
// c'era niente che potesse vederla fallire: nessun controllo sull'errore, e
// `registra_guasto` è eseguibile solo da `postgres` e `service_role` — questo
// codice gira nel browser, quindi non può lasciare una traccia nemmeno
// volendo. La cecità la chiude `npm run test:export`, che confronta queste
// liste con la cascata da `profiles`: dal 10/10/2026 una tabella che sparisce
// dal repo, o che nasce sotto la cascata, diventa rossa in repo invece che
// dopo tre mesi per caso.
//
// LA FORMA DEL FILE, decisa il 10/10/2026:
//   • una sezione che non siamo riusciti a ottenere NON compare. Non `[]`
//     (che è una bugia), non un oggetto segnaposto (che è rumore in mezzo ai
//     dati): assente, e nominata in cima;
//   • l'intestazione c'è SEMPRE, anche quando è tutto a posto, con
//     `completo: true` e `nonSiamoRiusciti: []`. Due ragioni: chi apre il
//     file due volte in momenti diversi vede la stessa struttura e nota la
//     differenza, e un campo che compare solo quando le cose vanno male è un
//     campo che nessuno impara a cercare;
//   • se non si è ottenuto NIENTE, non si scarica niente: un file che
//     contiene solo `esportatoIl` si apre e sembra «non ho niente su KIREO».
//
// ⚠️ L'unica cosa che NON è sempre presente è `avviso`, e la ragione è che il
// suo testo è un'affermazione sull'incompletezza: tenerlo su un file completo
// vorrebbe dire scriverci una frase diversa, cioè inventare una voce che
// nessuno ha scritto. `completo` e `nonSiamoRiusciti`, che sono i due campi
// che si imparano a cercare, ci sono sempre.

/** Una sezione del file: una tabella, la colonna con cui si filtra, il nome che prende nel file. */
export type SezioneExport = {
  /** La chiave nel JSON scaricato. */
  chiave: string;
  /** La tabella interrogata. `npm run test:export` la confronta con la cascata. */
  tabella: string;
  /** La colonna su cui si filtra per lo studente che sta scaricando. */
  colonna: string;
  /** Le colonne da leggere. */
  select: string;
  /** true per una riga sola (`maybeSingle`), false per un elenco. */
  singola: boolean;
};

// Le sezioni sono DATI e non query sparse nel componente, perché è questo che
// rende possibile la guardia: un elenco si confronta con la cascata, cinque
// chiamate dentro una funzione no.
export const SEZIONI_EXPORT: SezioneExport[] = [
  { chiave: "profilo", tabella: "profiles", colonna: "id", select: "*", singola: true },
  { chiave: "scuola", tabella: "student_profiles", colonna: "user_id", select: "*", singola: true },
  { chiave: "areeInteresse", tabella: "student_area_interests", colonna: "user_id", select: "area_slug, created_at", singola: false },
  { chiave: "attivita", tabella: "student_activities", colonna: "student_id", select: "*", singola: false },
];

/**
 * Le quattro nature in cui si divide quello che abbiamo su uno studente. La
 * decisione su cosa l'export debba contenere si prende su queste, non su un
 * elenco di nomi di tabella.
 *
 * ⚠️ `nostro` è la quinta, e non era prevista: sono le cose che gli abbiamo
 * MANDATO noi — una notifica, una comunicazione della sua scuola. Non è
 * qualcosa che ha scritto, né fatto, né una nostra deduzione su di lui, né un
 * dato di un terzo. Va decisa insieme alle altre quattro.
 */
export type NaturaDato = "scritto" | "fatto" | "dedotto" | "terzo" | "nostro";

/**
 * Le tabelle che discendono da uno studente e che l'export OGGI NON DÀ.
 *
 * Non sono esclusioni: sono un debito dichiarato, in attesa della decisione
 * su cosa il file debba contenere. La `natura` è la ragione per tabella — e
 * insieme sono l'inventario su cui quella decisione si prende.
 */
export const ATTESE: { tabella: string; natura: NaturaDato; cosa: string }[] = [
  // ── scritto da lui
  { tabella: "consegne_evento", natura: "scritto", cosa: "la risposta alla domanda finale di una diretta" },
  { tabella: "domande_live", natura: "scritto", cosa: "le domande fatte durante una diretta" },
  { tabella: "workshop_elaborati", natura: "scritto", cosa: "l'elaborato a tappe (più il giudizio finale e la fiducia, che sono dedotti)" },
  { tabella: "step_response", natura: "scritto", cosa: "le risposte alle stanze di una missione, aperte e strutturate" },
  { tabella: "test_response", natura: "scritto", cosa: "le risposte ai tre test" },
  { tabella: "journal_entry", natura: "scritto", cosa: "il diario di una missione" },
  { tabella: "portfolio_item", natura: "scritto", cosa: "l'artefatto salvato da una missione" },
  { tabella: "workshop_consegne", natura: "scritto", cosa: "i file consegnati col motore workshop v1" },
  { tabella: "workshop_chat_cliente", natura: "scritto", cosa: "le sue domande al cliente simulato (le risposte le scrive un modello)" },

  // ── fatto da lui
  { tabella: "activity_log", natura: "fatto", cosa: "dove ha messo piede, area per area" },
  { tabella: "iscrizioni_eventi", natura: "fatto", cosa: "a cosa si è iscritto (lo stato e la certificazione sono di un terzo)" },
  { tabella: "presenze_live", natura: "fatto", cosa: "i battiti di presenza di una diretta" },
  { tabella: "seguiti", natura: "fatto", cosa: "gli enti che segue" },
  { tabella: "manifestazioni_interesse", natura: "fatto", cosa: "gli enti a cui ha manifestato interesse" },
  { tabella: "assistente_conversazioni", natura: "fatto", cosa: "quante conversazioni ha aperto con l'assistente — mai il contenuto, che non si salva" },
  { tabella: "workshop_iscrizioni", natura: "fatto", cosa: "i ruoli di workshop presi, lasciati, completati" },
  { tabella: "test_attempt", natura: "fatto", cosa: "i tentativi dei tre test" },
  { tabella: "mission_attempt", natura: "fatto", cosa: "le missioni giocate" },
  { tabella: "recinto_enti", natura: "fatto", cosa: "le guide di un ente che ha scaricato" },
  { tabella: "newsletter_iscrizioni", natura: "fatto", cosa: "le newsletter di un ente a cui si è iscritto" },
  { tabella: "workshop_tutor_log", natura: "fatto", cosa: "quante volte ha chiesto aiuto al tutor — mai il contenuto" },

  // ── dedotto da noi: la categoria che pesa, perché è quello che pensiamo di lui
  { tabella: "evidence", natura: "dedotto", cosa: "le prove, ognuna con la sua motivazione leggibile — scritta apposta per poter essere letta da lui" },
  { tabella: "area_signal", natura: "dedotto", cosa: "i quattro punteggi per area, la confidence e lo status" },
  { tabella: "style_signal", natura: "dedotto", cosa: "il profilo di stile dei quattro assi" },
  { tabella: "workshop_fasi_stato", natura: "dedotto", cosa: "la revisione di ogni tappa e la reazione del cliente" },

  // ── coinvolge un terzo
  { tabella: "conversazioni_enti", natura: "terzo", cosa: "le conversazioni con un ente" },
  { tabella: "messaggi_enti", natura: "terzo", cosa: "i messaggi scambiati con un ente — metà li ha scritti l'ente" },
  { tabella: "workshop_messaggi", natura: "terzo", cosa: "i messaggi con i compagni di progetto: l'altro è un altro minorenne" },
  { tabella: "messaggi_scuola_destinatari", natura: "terzo", cosa: "le comunicazioni ricevute dalla scuola — il corpo è della scuola" },
  { tabella: "classi_studenti", natura: "terzo", cosa: "la classe a cui la scuola lo ha assegnato" },

  // ── mandato da noi
  { tabella: "notifiche_studenti", natura: "nostro", cosa: "le notifiche che gli abbiamo mandato" },
];

/**
 * Le tabelle sotto la cascata di `profiles` che NON sono righe di uno
 * studente: non entrano in questo export per costruzione, non per una
 * decisione in sospeso.
 *
 * ⚠️ Le prime tre sono righe di una persona che ha gli stessi diritti di uno
 * studente e per cui «Scarica i miei dati» NON ESISTE — nessuna pagina di
 * `/docente`, `/ente` o `/scuola` ne ha uno, né ha un «elimina il mio
 * account»: l'unico posto in tutto il prodotto è questo. È una domanda a sé,
 * e più grande di questa.
 */
export const FUORI: { tabella: string; perche: string }[] = [
  { tabella: "teacher_profiles", perche: "è la riga di un docente (o di un referente scuola), non di uno studente — e l'area docente non ha un proprio export" },
  { tabella: "newsletter_docenti", perche: "è l'iscrizione alla newsletter di un docente" },
  { tabella: "attestati", perche: "è l'attestato di partecipazione di un docente a un webinar" },
  { tabella: "institution_profiles", perche: "è il collegamento fra una persona e l'ente per cui lavora" },
  { tabella: "school_staff", perche: "è la riga di un referente o di un tutor dentro il proprio istituto" },
];

// ── I due testi. Sono voce, e li ha scritti Mario.

export const TESTO_AVVISO_INCOMPLETO =
  "Questo file non è completo. Le parti elencate qui sopra non siamo riusciti a recuperarle: non vuol dire che siano vuote, vuol dire che non lo sappiamo. Le altre parti del file sono complete. Riprova più tardi, e se succede ancora scrivici da Contatti: te le mandiamo a mano.";

export const TESTO_NESSUN_FILE =
  "Non siamo riusciti a preparare il file. Non è colpa tua e non è il tuo collegamento. Non abbiamo scaricato niente di parziale apposta: un file a metà ti direbbe che abbiamo meno dati di quelli che abbiamo davvero. Riprova fra qualche minuto; se succede ancora, scrivici da Contatti e te li mandiamo a mano.";

/** L'esito di una sezione: i dati, oppure il fatto che non li abbiamo ottenuti. */
export type EsitoSezione = { ottenuta: true; dati: unknown } | { ottenuta: false; motivo: string };

export type Esportazione =
  | { file: string; completo: boolean; nonSiamoRiusciti: string[] }
  | { file: null; completo: false; nonSiamoRiusciti: string[] };

/**
 * Compone il file dagli esiti delle sezioni. Puro: nessuna rete, nessun DOM —
 * così la forma del file si può provare senza un browser e senza un database.
 *
 * `esiti` è nell'ordine di `SEZIONI_EXPORT`.
 */
export function assemblaEsportazione(esiti: EsitoSezione[], adesso: Date = new Date()): Esportazione {
  const nonSiamoRiusciti = SEZIONI_EXPORT.filter((_, i) => !esiti[i]?.ottenuta).map((s) => s.chiave);

  // Niente ottenuto: nessun file. Un file con la sola intestazione si apre e
  // sembra «non ho niente su KIREO», che è la bugia di partenza con un'altra
  // faccia.
  if (nonSiamoRiusciti.length === SEZIONI_EXPORT.length) {
    return { file: null, completo: false, nonSiamoRiusciti };
  }

  const completo = nonSiamoRiusciti.length === 0;

  const contenuto: Record<string, unknown> = {
    esportatoIl: adesso.toISOString(),
    completo,
    nonSiamoRiusciti,
  };
  if (!completo) contenuto.avviso = TESTO_AVVISO_INCOMPLETO;

  // La sezione non ottenuta NON compare: né `[]`, né un segnaposto.
  SEZIONI_EXPORT.forEach((s, i) => {
    const esito = esiti[i];
    if (esito?.ottenuta) contenuto[s.chiave] = esito.dati;
  });

  return { file: JSON.stringify(contenuto, null, 2), completo, nonSiamoRiusciti };
}
