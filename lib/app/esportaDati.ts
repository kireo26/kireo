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
//     `tutteLePartiRichiesteOttenute: true` e `nonSiamoRiusciti: []`. Due
//     ragioni: chi apre il file due volte in momenti diversi vede la stessa
//     struttura e nota la differenza, e un campo che compare solo quando le
//     cose vanno male è un campo che nessuno impara a cercare;
//   • se non si è ottenuto NIENTE, non si scarica niente: un file che
//     contiene solo `esportatoIl` si apre e sembra «non ho niente su KIREO».
//
// ⚠️ IL CAMPO SI CHIAMAVA `completo`, E IL NOME ERA UNA PROMESSA PIÙ GRANDE
// DELLA COSA CHE AFFERMA (10/10/2026). Risponde a «tutte le query che ho
// fatto sono riuscite?»; chi legge risponde a «questo è tutto quello che
// avete su di me?» — e la seconda è la domanda per cui quel bottone esiste.
// Con quattro sezioni su trentacinque tabelle, `completo: true` era la specie
// di casa dentro la cura della specie di casa. Il nome nuovo è brutto e dice
// esattamente quello che afferma: le parti che QUESTO file chiede, non tutto
// quello che abbiamo.
//
// E il nome da solo non basta, perché nessuno legge un nome di campo come una
// limitazione: il file DICE al ragazzo cosa contiene e cosa non contiene
// ancora (`cosaContiene`, sempre presente). Una cosa scritta che dice il
// debito si cancella quando il debito finisce; una che lo tace resta falsa per
// sempre.
//
// ⚠️ ED È UN OGGETTO CON DUE ELENCHI, NON UNA FRASE (10/10/2026). Una frase
// unica si legge come esaustiva nei due versi: elencare quello che NON c'è fa
// credere che tutto il resto ci sia. La prima stesura diceva «Non contiene
// ancora le missioni, i workshop, le iscrizioni agli eventi, le presenze e i
// messaggi», e nominava 16 delle 31 tabelle del debito — quindi affermava che
// i tre test e i quattro punteggi che pensiamo di lui fossero dentro. Due
// elenchi, e il secondo copre tutte e trentuno.
//
// ⚠️ L'unica cosa che NON è sempre presente è `avviso`, e la ragione è che il
// suo testo è un'affermazione sull'incompletezza: tenerlo su un file completo
// vorrebbe dire scriverci una frase diversa, cioè inventare una voce che
// nessuno ha scritto. `tutteLePartiRichiesteOttenute` e `nonSiamoRiusciti`,
// che sono i due campi che si imparano a cercare, ci sono sempre.

import { EMAIL_PUBBLICA } from "@/lib/site";

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
  /**
   * Come questa sezione si chiama nel primo elenco di `cosaContiene`, con le
   * parole di chi legge e non il nome della tabella.
   *
   * Sta QUI e non in un elenco accanto, così `inQuestoFile` si DERIVA: una
   * quinta sezione non si può aggiungere senza scrivere come si chiama, e i
   * due non possono dire cose diverse.
   */
  voce: string;
};

// Le sezioni sono DATI e non query sparse nel componente, perché è questo che
// rende possibile la guardia: un elenco si confronta con la cascata, cinque
// chiamate dentro una funzione no.
export const SEZIONI_EXPORT: SezioneExport[] = [
  {
    chiave: "profilo",
    tabella: "profiles",
    colonna: "id",
    select: "*",
    singola: true,
    voce: "I tuoi dati di profilo: nome, cognome, e quello che hai scritto nel tuo profilo",
  },
  {
    chiave: "scuola",
    tabella: "student_profiles",
    colonna: "user_id",
    select: "*",
    singola: true,
    // ⚠️ Non «il tuo profilo»: questa tabella è la SCUOLA e la CLASSE. La
    // prima stesura della riga del debito le chiamava col nome di `profiles`,
    // e due sezioni diverse con lo stesso nome sono due cose che chi legge non
    // può distinguere.
    voce: "La tua scuola, la tua classe e lo stato della verifica scolastica",
  },
  {
    chiave: "areeInteresse",
    tabella: "student_area_interests",
    colonna: "user_id",
    select: "area_slug, created_at",
    singola: false,
    voce: "Le aree di orientamento che hai scelto",
  },
  {
    chiave: "attivita",
    tabella: "student_activities",
    colonna: "student_id",
    select: "*",
    singola: false,
    // ⚠️ LA VOCE DICHIARA DI ESSERE VUOTA, E DEVE. Nessun codice scrive
    // `student_activities` — solo `select`, verificato — quindi questa sezione
    // è `[]` per tutti. Una sezione sempre vuota non va TOLTA (è una tabella
    // vera, e il giorno che la scuola comincerà a scriverla si riempie da sé),
    // ma non può comparire in un elenco di «cosa contiene» senza dirlo: un
    // ragazzo leggerebbe «le tue attività», aprirebbe, troverebbe `[]` e
    // concluderebbe di non aver fatto niente — mentre nella sua pagina «Le mie
    // attività» quelle attività le vede, perché quella pagina legge
    // `activity_log`, che in questo file non c'è. È `zero ≠ non ho guardato`
    // con l'aggravante del nome preso in prestito.
    //
    // `npm run test:export` tiene insieme le due metà: che la voce lo dica, e
    // che nessuno scriva quella tabella. Il giorno che qualcuno la scrive, il
    // controllo dice che questa frase è diventata falsa.
    voce: "Le attività con ore certificate registrate dalla scuola (oggi questa parte è vuota per tutti: quella strada non è ancora in uso)",
  },
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
 * Le voci del SECONDO elenco di `cosaContiene`: quello che il file non
 * contiene ancora, dette al ragazzo.
 *
 * ⚠️ PERCHÉ DUE ELENCHI E NON UNA FRASE (10/10/2026). Una frase unica si legge
 * come esaustiva, e lo fa nei due versi: elencare quello che NON c'è fa
 * credere che tutto il resto ci sia. Con quattro sezioni su trentacinque
 * tabelle, dire soltanto «non contiene ancora le missioni, i workshop…»
 * affermava che il resto — i test, i punteggi che pensiamo di lui, le
 * notifiche — fosse dentro. Quindi: due elenchi, e il secondo deve coprire
 * tutte e trentuno le tabelle del debito.
 *
 * L'`id` esiste perché `ATTESE.nominataDa` possa puntarci senza ricopiare la
 * frase: il testo vive in un posto solo, e un id sbagliato è rosso invece di
 * essere una copia che diverge.
 *
 * ⚠️ IL LIMITE, dichiarato: il controllo tiene fermo che ogni `nominataDa`
 * punti a una voce che esiste e che ogni voce copra almeno una tabella. Che il
 * TESTO di una voce nomini davvero la cosa — se qualcuno riscrive la voce dei
 * workshop togliendo «consegne», `workshop_consegne` resta agganciata a una
 * voce che non la nomina più — è semantico, e nessuna guardia lessicale lo
 * vede. Si trova leggendo.
 */
export const VOCI_DEBITO = [
  { id: "test_missioni", testo: "I test e le missioni che hai fatto, con le risposte che hai dato" },
  // Staccata dai test di proposito: è la categoria che pesa, ed è l'unica di
  // tutte che un ragazzo ha il diritto di vedere e non immaginerebbe mai che
  // esista. Quando entrerà nel file, entrerà con la `motivazione` leggibile
  // che è stata scritta apposta per poter essere letta da lui.
  { id: "dedotto", testo: "Quello che KIREO ha dedotto da quelle risposte: i punteggi e le ipotesi sulle aree" },
  { id: "conto_attivita", testo: "Il conto delle attività che hai fatto in ogni area" },
  { id: "workshop", testo: "I workshop: iscrizioni, elaborati, consegne, chat e messaggi" },
  { id: "eventi", testo: "Gli eventi: le iscrizioni, le presenze, le domande in diretta e le risposte alla domanda finale" },
  { id: "enti", testo: "Gli enti: chi segui, a chi hai manifestato interesse, i messaggi che vi siete scritti" },
  { id: "classi_attestati", testo: "Le classi a cui la scuola ti ha assegnato e gli attestati" },
  { id: "notifiche", testo: "Le notifiche che ti abbiamo mandato e le comunicazioni della scuola" },
  { id: "assistente_newsletter", testo: "Quante volte hai usato l'assistente, e le iscrizioni alla newsletter" },
] as const;

export type IdVoceDebito = (typeof VOCI_DEBITO)[number]["id"];

/**
 * Le tabelle che discendono da uno studente e che l'export OGGI NON DÀ.
 *
 * Non sono esclusioni: sono un debito dichiarato, in attesa della decisione
 * su cosa il file debba contenere. La `natura` è la ragione per tabella — e
 * insieme sono l'inventario su cui quella decisione si prende.
 *
 * `nominataDa` è l'`id` della voce di `VOCI_DEBITO` sotto cui il ragazzo la
 * troverebbe, oppure `null` se nessuna la nomina. Dove due voci andrebbero
 * bene si sceglie quella dove uno andrebbe a cercare; dove le PAROLE di una
 * voce escludono la cosa (la voce dei punteggi dice «sulle aree», e lo stile
 * non è un'area) si mette `null` e si conta fra le scoperte, perché il senso
 * del cricchetto è che quello che manca non possa mancare in silenzio.
 */
export const ATTESE: { tabella: string; natura: NaturaDato; nominataDa: IdVoceDebito | null; cosa: string }[] = [
  // ── scritto da lui
  { tabella: "consegne_evento", natura: "scritto", nominataDa: "eventi", cosa: "la risposta alla domanda finale di una diretta" },
  { tabella: "domande_live", natura: "scritto", nominataDa: "eventi", cosa: "le domande fatte durante una diretta" },
  { tabella: "workshop_elaborati", natura: "scritto", nominataDa: "workshop", cosa: "l'elaborato a tappe (più il giudizio finale e la fiducia, che sono dedotti)" },
  { tabella: "step_response", natura: "scritto", nominataDa: "test_missioni", cosa: "le risposte alle stanze di una missione, aperte e strutturate" },
  { tabella: "test_response", natura: "scritto", nominataDa: "test_missioni", cosa: "le risposte ai tre test" },
  // La voce dice «con le risposte che hai dato», e un diario e un artefatto
  // non sono risposte: stanno dentro il suo PERIMETRO («le missioni che hai
  // fatto») ma non fra le cose che enumera. Segnalato a Mario.
  { tabella: "journal_entry", natura: "scritto", nominataDa: "test_missioni", cosa: "il diario di una missione" },
  { tabella: "portfolio_item", natura: "scritto", nominataDa: "test_missioni", cosa: "l'artefatto salvato da una missione" },
  { tabella: "workshop_consegne", natura: "scritto", nominataDa: "workshop", cosa: "i file consegnati col motore workshop v1" },
  { tabella: "workshop_chat_cliente", natura: "scritto", nominataDa: "workshop", cosa: "le sue domande al cliente simulato (le risposte le scrive un modello)" },

  // ── fatto da lui
  { tabella: "activity_log", natura: "fatto", nominataDa: "conto_attivita", cosa: "dove ha messo piede, area per area" },
  { tabella: "iscrizioni_eventi", natura: "fatto", nominataDa: "eventi", cosa: "a cosa si è iscritto (lo stato e la certificazione sono di un terzo)" },
  { tabella: "presenze_live", natura: "fatto", nominataDa: "eventi", cosa: "i battiti di presenza di una diretta" },
  { tabella: "seguiti", natura: "fatto", nominataDa: "enti", cosa: "gli enti che segue" },
  { tabella: "manifestazioni_interesse", natura: "fatto", nominataDa: "enti", cosa: "gli enti a cui ha manifestato interesse" },
  { tabella: "assistente_conversazioni", natura: "fatto", nominataDa: "assistente_newsletter", cosa: "quante conversazioni ha aperto con l'assistente — mai il contenuto, che non si salva" },
  { tabella: "workshop_iscrizioni", natura: "fatto", nominataDa: "workshop", cosa: "i ruoli di workshop presi, lasciati, completati" },
  { tabella: "test_attempt", natura: "fatto", nominataDa: "test_missioni", cosa: "i tentativi dei tre test" },
  { tabella: "mission_attempt", natura: "fatto", nominataDa: "test_missioni", cosa: "le missioni giocate" },
  // ⚠️ SCOPERTA. La voce degli enti enumera chi segui, a chi hai manifestato
  // interesse e i messaggi: una guida scaricata da un ente non è nessuna delle
  // tre, e nessun'altra voce la tocca.
  { tabella: "recinto_enti", natura: "fatto", nominataDa: null, cosa: "le guide di un ente che ha scaricato" },
  { tabella: "newsletter_iscrizioni", natura: "fatto", nominataDa: "assistente_newsletter", cosa: "le newsletter di un ente a cui si è iscritto" },
  // La voce dei workshop enumera «chat», che in quel contesto è la chat col
  // cliente: il conto delle richieste al tutor sta nel perimetro e non fra le
  // cose nominate. Segnalato.
  { tabella: "workshop_tutor_log", natura: "fatto", nominataDa: "workshop", cosa: "quante volte ha chiesto aiuto al tutor — mai il contenuto" },

  // ── dedotto da noi: la categoria che pesa, perché è quello che pensiamo di lui
  { tabella: "evidence", natura: "dedotto", nominataDa: "dedotto", cosa: "le prove, ognuna con la sua motivazione leggibile — scritta apposta per poter essere letta da lui" },
  { tabella: "area_signal", natura: "dedotto", nominataDa: "dedotto", cosa: "i quattro punteggi per area, la confidence e lo status" },
  // ⚠️ SCOPERTA, e di quelle che contano: la voce si limita con le proprie
  // parole («le ipotesi sulle aree»), e lo stile non è un'area — sono i
  // quattro assi di COME lavora. Un ragazzo che legge quella voce non impara
  // che abbiamo anche un profilo del suo modo di lavorare.
  { tabella: "style_signal", natura: "dedotto", nominataDa: null, cosa: "il profilo di stile dei quattro assi" },
  // Dentro il perimetro dei workshop, ma la voce non nomina la revisione di
  // tappa né la reazione del cliente. Segnalato.
  { tabella: "workshop_fasi_stato", natura: "dedotto", nominataDa: "workshop", cosa: "la revisione di ogni tappa e la reazione del cliente" },

  // ── coinvolge un terzo
  { tabella: "conversazioni_enti", natura: "terzo", nominataDa: "enti", cosa: "le conversazioni con un ente" },
  { tabella: "messaggi_enti", natura: "terzo", nominataDa: "enti", cosa: "i messaggi scambiati con un ente — metà li ha scritti l'ente" },
  { tabella: "workshop_messaggi", natura: "terzo", nominataDa: "workshop", cosa: "i messaggi con i compagni di progetto: l'altro è un altro minorenne" },
  { tabella: "messaggi_scuola_destinatari", natura: "terzo", nominataDa: "notifiche", cosa: "le comunicazioni ricevute dalla scuola — il corpo è della scuola" },
  { tabella: "classi_studenti", natura: "terzo", nominataDa: "classi_attestati", cosa: "la classe a cui la scuola lo ha assegnato" },

  // ── mandato da noi
  { tabella: "notifiche_studenti", natura: "nostro", nominataDa: "notifiche", cosa: "le notifiche che gli abbiamo mandato" },
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

// ── I tre testi. Sono voce, e li ha scritti Mario.

/**
 * I due elenchi, SEMPRE presenti nel file — anche quando tutte le parti
 * richieste sono arrivate, perché il debito non è un guasto: è quello che
 * l'export non copre ancora.
 *
 * ⚠️ TUTTI E DUE SONO DERIVATI, e non è un vezzo: sono i due elenchi che
 * invecchierebbero. Il primo viene dalle `voce` di `SEZIONI_EXPORT`, il
 * secondo dai `testo` di `VOCI_DEBITO` — quindi non può esistere una sezione
 * nel file che il primo elenco non nomina, né una voce del secondo che non
 * esista fra i dati. Una lista scritta a mano accanto a quella vera è la
 * copia che nessuno rilegge.
 */
export const COSA_CONTIENE = {
  inQuestoFile: SEZIONI_EXPORT.map((s) => s.voce),
  nonAncoraInQuestoFile: VOCI_DEBITO.map((v) => v.testo),
  nota: `Stiamo completando l'esportazione. Se ti serve subito qualcosa del secondo elenco, scrivici a ${EMAIL_PUBBLICA} e te lo mandiamo.`,
};

export const TESTO_AVVISO_INCOMPLETO =
  "Questo file non è completo. Le parti elencate qui sopra non siamo riusciti a recuperarle: non vuol dire che siano vuote, vuol dire che non lo sappiamo. Le altre parti del file sono complete. Riprova più tardi, e se succede ancora scrivici da Contatti: te le mandiamo a mano.";

export const TESTO_NESSUN_FILE =
  "Non siamo riusciti a preparare il file. Non è colpa tua e non è il tuo collegamento. Non abbiamo scaricato niente di parziale apposta: un file a metà ti direbbe che abbiamo meno dati di quelli che abbiamo davvero. Riprova fra qualche minuto; se succede ancora, scrivici da Contatti e te li mandiamo a mano.";

/** L'esito di una sezione: i dati, oppure il fatto che non li abbiamo ottenuti. */
export type EsitoSezione = { ottenuta: true; dati: unknown } | { ottenuta: false; motivo: string };

export type Esportazione =
  | { file: string; tutteLePartiRichiesteOttenute: boolean; nonSiamoRiusciti: string[] }
  | { file: null; tutteLePartiRichiesteOttenute: false; nonSiamoRiusciti: string[] };

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
    return { file: null, tutteLePartiRichiesteOttenute: false, nonSiamoRiusciti };
  }

  const tutteLePartiRichiesteOttenute = nonSiamoRiusciti.length === 0;

  const contenuto: Record<string, unknown> = {
    esportatoIl: adesso.toISOString(),
    // I due elenchi vengono prima dei due campi sull'esito, perché rispondono
    // alla domanda che il ragazzo si sta facendo aprendo il file; i due campi
    // rispondono a una domanda nostra.
    cosaContiene: COSA_CONTIENE,
    tutteLePartiRichiesteOttenute,
    nonSiamoRiusciti,
  };
  if (!tutteLePartiRichiesteOttenute) contenuto.avviso = TESTO_AVVISO_INCOMPLETO;

  // La sezione non ottenuta NON compare: né `[]`, né un segnaposto.
  SEZIONI_EXPORT.forEach((s, i) => {
    const esito = esiti[i];
    if (esito?.ottenuta) contenuto[s.chiave] = esito.dati;
  });

  return { file: JSON.stringify(contenuto, null, 2), tutteLePartiRichiesteOttenute, nonSiamoRiusciti };
}
