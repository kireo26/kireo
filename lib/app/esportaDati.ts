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
// accanto c'era `"attivita": []` (le ore registrate dalla scuola, uscite il
// 01/11), che era un vuoto VERO: nel file i due erano indistinguibili.
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
  /**
   * Per una tabella che non ha la colonna dello studente (le risposte di un
   * tentativo, le tappe di un'iscrizione, i messaggi di una conversazione):
   * prima si leggono gli `id` delle righe sue in `padre` (filtrate su
   * `colonnaPadre`), poi le righe di questa tabella con `colonna` in quegli id.
   * Il filtro è esplicito, non affidato alla RLS: una policy che un giorno
   * lasciasse leggere righe di altri non le porterebbe nel file.
   *
   * ⚠️ La chiave si chiama `padre` e non `tabella` apposta: `npm run
   * test:export` legge le tabelle dell'elenco cercando `tabella:`, e un padre
   * contato come sezione sarebbe un doppione.
   */
  via?: { padre: string; colonnaPadre: string };
  /** Filtri fissi in più: «solo i suoi messaggi» dove una tabella ha anche quelli dell'altro. */
  soloSe?: Record<string, string>;
  /**
   * Il nome della cosa a cui la riga si riferisce (il titolo di un evento, il
   * nome di un ente), letto accanto alla riga invece dell'identificativo, che
   * da solo non dice niente a chi legge. `chiave` è la colonna della sezione
   * che punta a `da`; nel file la cosa sta sotto `alias`.
   *
   * ⚠️ Si legge con i permessi dello studente: un evento non più approvato o un
   * ente non più attivo esce `null`, e la riga resta.
   */
  incorpora?: { alias: string; da: string; chiave: string; select: string }[];
};

/** La `select` che si manda davvero: le colonne della sezione, più le cose incorporate. */
export function selectCompleta(s: SezioneExport): string {
  const extra = (s.incorpora ?? []).map((i) => `${i.alias}:${i.da}!${i.chiave}(${i.select})`);
  return [s.select, ...extra].join(", ");
}

/**
 * La lettura di una sezione, con il client dello studente. Sta qui e non nel
 * componente perché le regole (il padre letto prima, «solo i suoi», un padre
 * non letto che non diventa un elenco vuoto) si provano con un client finto,
 * non rileggendo un file. Il componente ci aggiunge solo la traccia nel log.
 */
type ClientExport = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- il costruttore delle query di supabase-js è troppo generico per tiparlo qui
  from: (tabella: string) => any;
};
export async function leggiSezioneExport(
  client: ClientExport,
  s: SezioneExport,
  userId: string,
): Promise<{ esito: EsitoSezione; errore: unknown; dove: string }> {
  let ids: string[] | null = null;
  if (s.via) {
    const padre = await client.from(s.via.padre).select("id").eq(s.via.colonnaPadre, userId);
    if (padre.error || !Array.isArray(padre.data)) {
      return { esito: { ottenuta: false, motivo: padre.error?.code ?? "padre_non_letto" }, errore: padre.error ?? "padre senza dati", dove: s.via.padre };
    }
    const letti = padre.data.map((r: { id: string }) => r.id);
    ids = letti;
    // Un padre letto e vuoto è un vuoto vero: nessun tentativo, nessuna
    // risposta. Un padre non letto non arriva fin qui.
    if (letti.length === 0) return { esito: { ottenuta: true, dati: [] }, errore: null, dove: s.tabella };
  }
  let query = client.from(s.tabella).select(selectCompleta(s));
  query = ids ? query.in(s.colonna, ids) : query.eq(s.colonna, userId);
  for (const [colonna, valore] of Object.entries(s.soloSe ?? {})) query = query.eq(colonna, valore);
  const { data, error } = s.singola ? await query.maybeSingle() : await query;
  if (error) return { esito: { ottenuta: false, motivo: error.code ?? "errore" }, errore: error, dove: s.tabella };
  return { esito: { ottenuta: true, dati: data }, errore: null, dove: s.tabella };
}

// Le sezioni sono DATI e non query sparse nel componente, perché è questo che
// rende possibile la guardia: un elenco si confronta con la cascata, cinque
// chiamate dentro una funzione no.
export const SEZIONI_EXPORT: SezioneExport[] = [
  {
    chiave: "profilo",
    tabella: "profiles",
    colonna: "id",
    select: "ruolo, nome, cognome, data_nascita, telefono, comunicazioni_kireo, comunicazioni_kireo_il, created_at",
    singola: true,
    voce: "I tuoi dati di profilo: nome, cognome, e quello che hai scritto nel tuo profilo",
  },
  {
    chiave: "scuola",
    tabella: "student_profiles",
    colonna: "user_id",
    select: "school_code, classe, anno_diploma, stato_verifica, verificato_il, rifiuto_motivo, rifiuto_scuola_nome, rifiuto_il, created_at",
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
    // Dal 10/11 (20261211100000), nello stesso lotto della tabella: le guide di
    // KIREO che ha aperto, una riga per area e livello. È la riga da cui si
    // apre la guida dopo, e la riga è sua.
    chiave: "guideKireoAperte",
    tabella: "guide_kireo_aperte",
    colonna: "student_id",
    select: "area_slug, livello, aperta_il",
    singola: false,
    voce: "Le guide di KIREO che hai aperto: l'area, il livello e quando",
  },
  {
    // Dal 29/10 (Mario: «Includila»). Il titolo e l'ente sono quelli del
    // momento in cui l'ha scaricata (20261116100000): la riga resta anche se
    // l'ente ha cancellato o sostituito la guida.
    chiave: "guideEntiScaricate",
    tabella: "scaricamenti_guide_enti",
    colonna: "student_id",
    select: "titolo_guida, ente_nome, guida_caricata_il, created_at",
    singola: false,
    voce: "Le guide degli enti che hai scaricato: il titolo, l'ente e quando",
  },
  // Dal 30/10 (20261117110000), nello stesso lotto dell'invio: la regola è che
  // una tabella con dentro qualcosa che riguarda lo studente entra nel file
  // nello stesso commit. Dal 04/11 (20261207100000, Mario §6d) con il mittente:
  // l'ente e l'oggetto copiati sulla consegna quando nasce, come per le guide,
  // perché lo studente non legge `newsletter_enti` dal client.
  {
    chiave: "newsletterRicevute",
    tabella: "newsletter_consegne",
    colonna: "student_id",
    select: "ente_nome, oggetto, stato, inviata_il, created_at",
    singola: false,
    voce: "Le newsletter degli enti che ti abbiamo mandato: chi te l'ha mandata, l'oggetto, e quando e se è arrivata per email",
  },
  // Dal 30/10 (20261119110000), nello stesso lotto di «salva»: la copia che il
  // database ha fatto al momento del gesto, quindi anche dei post che non sono
  // più nel flusso.
  {
    chiave: "postSalvati",
    tabella: "post_salvati",
    colonna: "student_id",
    select: "ente_nome, tipo, corpo, immagine_url, link_esterno, allegato_nome, pubblicato_il, salvato_il",
    singola: false,
    voce: "I post degli enti che hai salvato: il testo, l'ente e quando",
  },
  // Dal 31/10 (20261124100000), nello stesso lotto di «salva»: l'identità
  // copiata al gesto. Dove si guarda oggi non sta nel file: è uno stato di
  // adesso, non una cosa sua.
  {
    chiave: "registrazioniSalvate",
    tabella: "registrazioni_salvate",
    colonna: "student_id",
    select: "titolo_evento, ente_nome, data_evento, video_id, salvata_il",
    singola: false,
    voce: "Le registrazioni delle dirette che hai salvato: il titolo, l'ente, la data e quando le hai salvate",
  },
  {
    chiave: "fileScaricati",
    tabella: "scaricamenti_allegati_post",
    colonna: "student_id",
    select: "ente_nome, allegato_nome, pubblicato_il, created_at",
    singola: false,
    voce: "I file dei post degli enti che hai scaricato: il nome, l'ente e quando",
  },
  // ── Dal 04/11 (Mario, 6b): le parti che sono sue. Fino a oggi il file gli
  // restituiva il contorno, e le sue parole stavano nell'elenco di quello che
  // mancava. Le voci di queste sezioni sono mie e provvisorie.
  {
    chiave: "test",
    tabella: "test_attempt",
    colonna: "student_id",
    select: "id, test_slug, stato, started_at, completed_at",
    singola: false,
    voce: "I test che hai fatto: quale, quando e se l'hai finito",
  },
  {
    chiave: "testRisposte",
    tabella: "test_response",
    colonna: "attempt_id",
    via: { padre: "test_attempt", colonnaPadre: "student_id" },
    select: "attempt_id, item_id, payload, created_at",
    singola: false,
    voce: "Le risposte che hai dato nei test, domanda per domanda",
  },
  {
    chiave: "missioni",
    tabella: "mission_attempt",
    colonna: "student_id",
    select: "id, mission_slug, stato, started_at, completed_at",
    singola: false,
    voce: "Le missioni che hai giocato: quale, quando e se l'hai finita",
  },
  {
    chiave: "missioniRisposte",
    tabella: "step_response",
    colonna: "attempt_id",
    via: { padre: "mission_attempt", colonnaPadre: "student_id" },
    select: "attempt_id, stanza, step_id, tipo, payload, created_at",
    singola: false,
    voce: "Le risposte che hai dato nelle missioni, stanza per stanza, comprese le proposte e le riflessioni che hai scritto",
  },
  {
    chiave: "diario",
    tabella: "journal_entry",
    colonna: "student_id",
    select: "attempt_id, testo, created_at",
    singola: false,
    voce: "Il diario che hai scritto nelle missioni",
  },
  {
    chiave: "portfolio",
    tabella: "portfolio_item",
    colonna: "student_id",
    select: "attempt_id, titolo, contenuto, created_at",
    singola: false,
    voce: "Le cose che hai salvato dalle missioni",
  },
  {
    chiave: "attivita",
    tabella: "activity_log",
    colonna: "student_id",
    select: "area_slug, tipo_attivita, livello, peso, created_at",
    singola: false,
    voce: "Il conto delle attività che hai fatto in ogni area",
  },
  {
    chiave: "workshop",
    tabella: "workshop_iscrizioni",
    colonna: "student_id",
    select: "id, stato, created_at",
    incorpora: [
      { alias: "workshop", da: "workshop", chiave: "workshop_id", select: "titolo" },
      { alias: "ruolo", da: "workshop_ruoli", chiave: "ruolo_id", select: "titolo" },
    ],
    singola: false,
    voce: "I workshop: i ruoli che hai preso, lasciato o completato",
  },
  {
    chiave: "workshopElaborati",
    tabella: "workshop_elaborati",
    colonna: "iscrizione_id",
    via: { padre: "workshop_iscrizioni", colonnaPadre: "student_id" },
    select: "iscrizione_id, contenuto, stato, updated_at, consegnato_at",
    singola: false,
    voce: "Gli elaborati dei workshop: quello che hai scritto, tappa per tappa",
  },
  {
    chiave: "workshopConsegne",
    tabella: "workshop_consegne",
    colonna: "iscrizione_id",
    via: { padre: "workshop_iscrizioni", colonnaPadre: "student_id" },
    select: "iscrizione_id, file_nome, file_tipo, file_dimensione, stato, created_at",
    singola: false,
    voce: "I file che hai consegnato nei workshop: il nome e quando",
  },
  {
    chiave: "workshopChatCliente",
    tabella: "workshop_chat_cliente",
    colonna: "iscrizione_id",
    via: { padre: "workshop_iscrizioni", colonnaPadre: "student_id" },
    select: "iscrizione_id, mittente, contenuto, created_at",
    singola: false,
    // Le risposte del cliente le scrive un modello, non una persona: stanno nel
    // file insieme alle sue domande, perché senza non si capiscono.
    voce: "Le conversazioni con il cliente dei workshop: le tue domande e le risposte del cliente",
  },
  {
    chiave: "workshopTutor",
    tabella: "workshop_tutor_log",
    colonna: "iscrizione_id",
    via: { padre: "workshop_iscrizioni", colonnaPadre: "student_id" },
    select: "iscrizione_id, sezione_id, modo, created_at",
    singola: false,
    voce: "Quando hai chiesto aiuto al tutor dei workshop (il testo della richiesta non lo conserviamo)",
  },
  {
    // ⚠️ Solo i SUOI messaggi (Mario, 6b): le parole dell'altro minorenne non
    // sono un suo dato, e una conversazione a metà è il prezzo normale. Il
    // filtro sta sulla colonna, non sulla RLS, che gli lascia leggere anche
    // quelli ricevuti.
    chiave: "workshopMessaggi",
    tabella: "workshop_messaggi",
    colonna: "mittente_id",
    select: "workshop_id, contenuto, created_at",
    singola: false,
    voce: "I messaggi che hai scritto ai compagni nei workshop (solo i tuoi: quelli dei compagni sono loro)",
  },
  {
    chiave: "eventiIscrizioni",
    tabella: "iscrizioni_eventi",
    colonna: "student_id",
    select: "stato, origine, certificata_da_tipo, certificata_il, ore_riconosciute, created_at",
    incorpora: [{ alias: "evento", da: "eventi", chiave: "evento_id", select: "titolo, data_inizio" }],
    singola: false,
    voce: "Gli eventi: le tue iscrizioni, le presenze certificate e le ore riconosciute",
  },
  {
    chiave: "eventiPresenze",
    tabella: "presenze_live",
    colonna: "user_id",
    select: "primo_ping, ultimo_ping, ping_totali",
    incorpora: [{ alias: "evento", da: "eventi", chiave: "evento_id", select: "titolo, data_inizio" }],
    singola: false,
    voce: "Le presenze misurate nelle dirette: il primo e l'ultimo collegamento, e i minuti contati",
  },
  {
    chiave: "eventiDomande",
    tabella: "domande_live",
    colonna: "user_id",
    select: "testo, creata_il, stato, stato_da_tipo, stato_il, letta_il",
    incorpora: [{ alias: "evento", da: "eventi", chiave: "evento_id", select: "titolo, data_inizio" }],
    singola: false,
    voce: "Le domande che hai fatto durante le dirette",
  },
  {
    chiave: "eventiConsegne",
    tabella: "consegne_evento",
    colonna: "student_id",
    select: "testo, valutata_il, created_at",
    incorpora: [{ alias: "evento", da: "eventi", chiave: "evento_id", select: "titolo, data_inizio" }],
    singola: false,
    voce: "Le risposte che hai dato alla domanda finale delle dirette",
  },
  {
    chiave: "entiSeguiti",
    tabella: "seguiti",
    colonna: "student_id",
    select: "created_at, chiuso_il",
    incorpora: [{ alias: "ente", da: "istituzioni", chiave: "istituzione_id", select: "nome" }],
    singola: false,
    voce: "Gli enti che segui, o che hai seguito, e da quando",
  },
  {
    chiave: "entiProfiloCondiviso",
    tabella: "manifestazioni_interesse",
    colonna: "student_id",
    select: "created_at, revocata_il, copre_attivita, copre_contenuti",
    incorpora: [{ alias: "ente", da: "istituzioni", chiave: "istituzione_id", select: "nome" }],
    singola: false,
    voce: "Gli enti con cui hai condiviso il profilo, e cosa copriva la condivisione",
  },
  {
    chiave: "entiIncontrati",
    tabella: "recinto_enti",
    colonna: "student_id",
    select: "origine, created_at",
    incorpora: [{ alias: "ente", da: "istituzioni", chiave: "istituzione_id", select: "nome" }],
    singola: false,
    voce: "Gli enti che hai incontrato con un evento, una guida o la newsletter",
  },
  {
    chiave: "entiNewsletter",
    tabella: "newsletter_iscrizioni",
    colonna: "student_id",
    select: "created_at",
    incorpora: [{ alias: "ente", da: "istituzioni", chiave: "istituzione_id", select: "nome" }],
    singola: false,
    voce: "Le tue iscrizioni alle newsletter degli enti",
  },
  {
    chiave: "entiConversazioni",
    tabella: "conversazioni_enti",
    colonna: "student_id",
    select: "id, stato, created_at",
    incorpora: [{ alias: "ente", da: "istituzioni", chiave: "istituzione_id", select: "nome" }],
    singola: false,
    voce: "Le conversazioni con gli enti",
  },
  {
    // Solo i suoi, come per i compagni: quello che ha scritto l'ente è dell'ente.
    chiave: "entiMessaggi",
    tabella: "messaggi_enti",
    colonna: "conversazione_id",
    via: { padre: "conversazioni_enti", colonnaPadre: "student_id" },
    soloSe: { mittente: "studente" },
    select: "conversazione_id, corpo, created_at",
    singola: false,
    voce: "I messaggi che hai scritto agli enti (solo i tuoi: le risposte sono dell'ente)",
  },
  {
    chiave: "assistenteConversazioni",
    tabella: "assistente_conversazioni",
    colonna: "student_id",
    select: "area_slug, created_at",
    singola: false,
    voce: "Le conversazioni che hai aperto con l'assistente (il testo non lo conserviamo)",
  },
  {
    chiave: "assistenteDomande",
    tabella: "assistente_richieste",
    colonna: "student_id",
    select: "created_at",
    singola: false,
    voce: "Quando hai fatto una domanda all'assistente (il testo non lo conserviamo)",
  },
  {
    // Il nome della classe la scuola lo tiene per sé (lo studente non legge
    // `classi`): nel file c'è l'identificativo e da quando.
    chiave: "classi",
    tabella: "classi_studenti",
    colonna: "student_id",
    select: "classe_id, created_at",
    singola: false,
    voce: "Le classi a cui la scuola ti ha assegnato, e da quando (il nome della classe lo tiene la scuola)",
  },
  {
    // L'oggetto e la data, non il corpo: è il testo della scuola, come per le
    // newsletter degli enti.
    chiave: "comunicazioniScuola",
    tabella: "messaggi_scuola_destinatari",
    colonna: "student_id",
    select: "letto_il",
    incorpora: [{ alias: "messaggio", da: "messaggi_scuola", chiave: "messaggio_id", select: "oggetto, created_at" }],
    singola: false,
    voce: "Le comunicazioni che hai ricevuto dalla tua scuola: l'oggetto, quando, e se le hai lette",
  },
  {
    chiave: "notifiche",
    tabella: "notifiche_studenti",
    colonna: "student_id",
    select: "tipo, letta, created_at",
    singola: false,
    voce: "Le notifiche che ti abbiamo mandato, e se le hai lette",
  },
];

/**
 * LE COLONNE CHE IL FILE NON DÀ, ognuna con la sua ragione (29/10, Mario).
 *
 * Fino al 29/10 tre sezioni chiedevano `select: "*"`, e il file portava
 * `verificato_da`: l'identificativo del referente della scuola che ha
 * verificato lo studente. *Il diritto a riavere i propri dati non include
 * quelli altrui.* E portava `di_prova` ed `esente_cancelli`, che sono
 * bandierine nostre e in gergo nostro. Da allora ogni sezione elenca le sue
 * colonne, e ogni colonna di una tabella esportata o sta nella `select` o sta
 * qui: `npm run test:export` legge le colonne dalle migrazioni e diventa rosso
 * su una colonna che non sta da nessuna delle due parti. Una colonna nuova
 * nasce rossa finché qualcuno non dice se è dello studente.
 *
 * La colonna su cui si filtra (`colonna` della sezione) è esclusa da sé: è
 * l'identificativo di chi scarica, e non dice niente a chi legge.
 */
export const COLONNE_ESCLUSE: Record<string, Record<string, string>> = {
  profiles: {
    updated_at: "tecnica: quando la riga è stata toccata l'ultima volta, non un fatto suo",
    di_prova: "nostra: dice come trattiamo l'account nei conteggi delle prove, non qualcosa su di lui",
    esente_cancelli: "nostra: dice se l'account salta i cancelli nelle prove, non qualcosa su di lui",
    cancellato_il: "nostra: segna la lapide di un account cancellato che aveva firmato qualcosa; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
    numero_anonimo: "nostra: il numero dell'etichetta di un account cancellato senza firme; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  student_profiles: {
    updated_at: "tecnica: quando la riga è stata toccata l'ultima volta",
    // ⚠️ Lo stato e la data della verifica ci sono («verificata dalla tua
    // scuola il …»): quello che esce è CHI, perché è un'altra persona.
    verificato_da: "di un'altra persona: l'identificativo del referente della scuola che ha verificato",
  },
  student_area_interests: {},
  newsletter_consegne: {
    id: "tecnica: l'identificativo interno della riga",
    newsletter_id: "tecnica: l'identificativo interno della newsletter dell'ente",
    tentativi: "tecnica: quante volte il motore ha provato a mandarla",
    tentata_il: "tecnica: quando il motore l'ha presa in un giro",
    tentata_giorno: "tecnica: il giorno del giro che l'ha presa",
    ultimo_errore: "tecnica: il messaggio d'errore del fornitore delle email, se l'invio è fallito",
  },
  post_salvati: {
    id: "tecnica: l'identificativo interno della riga",
    post_id: "tecnica: l'identificativo interno del post, che dopo una cancellazione non porta a niente; il testo copiato sta nel file",
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome copiato sta nel file",
  },
  registrazioni_salvate: {
    id: "tecnica: l'identificativo interno della riga",
    evento_id: "tecnica: l'identificativo interno dell'evento, che dopo una cancellazione non porta a niente; il titolo copiato sta nel file",
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome copiato sta nel file",
  },
  scaricamenti_allegati_post: {
    id: "tecnica: l'identificativo interno della riga",
    post_id: "tecnica: l'identificativo interno del post; il nome del file copiato sta nel file",
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome copiato sta nel file",
  },
  // ── Dal 04/11 (6b). Ragioni mie e provvisorie.
  test_attempt: {
    item_corrente: "tecnica: a che domanda era arrivato il test mentre lo facevi, un segnaposto per riprendere",
    updated_at: "tecnica: quando la riga è stata toccata l'ultima volta",
  },
  test_response: {
    id: "tecnica: l'identificativo interno della riga",
  },
  mission_attempt: {
    stanza_corrente: "tecnica: a che stanza era arrivata la missione, un segnaposto per riprendere",
    updated_at: "tecnica: quando la riga è stata toccata l'ultima volta",
    revisore_esito: "nostra: dice se il nostro revisore automatico è riuscito a leggere la proposta, un fatto del nostro sistema e non qualcosa che hai fatto",
  },
  step_response: {
    id: "tecnica: l'identificativo interno della riga",
  },
  journal_entry: {
    id: "tecnica: l'identificativo interno della riga",
    testo_rimosso_il: "nostra: segna quando il testo è stato tolto alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  portfolio_item: {
    id: "tecnica: l'identificativo interno della riga",
    testo_rimosso_il: "nostra: segna quando il testo è stato tolto alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  activity_log: {
    id: "tecnica: l'identificativo interno della riga",
  },
  workshop_iscrizioni: {
    workshop_id: "tecnica: l'identificativo interno del workshop; il titolo sta accanto, sotto `workshop`",
    ruolo_id: "tecnica: l'identificativo interno del ruolo; il titolo sta accanto, sotto `ruolo`",
  },
  workshop_elaborati: {
    id: "tecnica: l'identificativo interno della riga",
    fase_corrente: "tecnica: una colonna che nessuno scrive più dal motore a tappe",
    fasi_completate: "tecnica: una colonna che nessuno scrive più dal motore a tappe",
    feedback_ai: "dedotta da noi: è un giudizio di KIREO, ed entra nel file con la decisione su quello che abbiamo dedotto (il secondo elenco del file)",
    fiducia: "dedotta da noi: è un giudizio di KIREO, ed entra nel file con la decisione su quello che abbiamo dedotto (il secondo elenco del file)",
  },
  workshop_consegne: {
    id: "tecnica: l'identificativo interno della riga",
    file_percorso: "tecnica: dove sta il file nel nostro spazio, un indirizzo interno",
    feedback_ai: "dedotta da noi: è un giudizio di KIREO, ed entra nel file con la decisione su quello che abbiamo dedotto (il secondo elenco del file)",
  },
  workshop_chat_cliente: {
    id: "tecnica: l'identificativo interno della riga",
    testo_rimosso_il: "nostra: segna quando il testo è stato tolto alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  workshop_tutor_log: {
    id: "tecnica: l'identificativo interno della riga",
  },
  workshop_messaggi: {
    id: "tecnica: l'identificativo interno della riga",
    destinatario_id: "di un'altra persona: l'identificativo del compagno a cui hai scritto",
    letto: "di un'altra persona: se il compagno ha letto il messaggio",
    testo_rimosso_il: "nostra: segna quando il testo è stato tolto alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  iscrizioni_eventi: {
    id: "tecnica: l'identificativo interno della riga",
    evento_id: "tecnica: l'identificativo interno dell'evento; il titolo e la data stanno accanto, sotto `evento`",
    iscritto_da: "di un'altra persona: l'identificativo del referente che ti ha iscritto d'ufficio",
    certificata_da_user: "di un'altra persona: l'identificativo di chi ha certificato la presenza (chi l'ha fatto, come ruolo, è in `certificata_da_tipo`)",
    nome_alla_cancellazione: "nostra: il nome copiato alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
    cognome_alla_cancellazione: "nostra: il cognome copiato alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  presenze_live: {
    id: "tecnica: l'identificativo interno della riga",
    evento_id: "tecnica: l'identificativo interno dell'evento; il titolo e la data stanno accanto, sotto `evento`",
  },

  domande_live: {
    id: "tecnica: l'identificativo interno della riga",
    evento_id: "tecnica: l'identificativo interno dell'evento; il titolo e la data stanno accanto, sotto `evento`",
    testo_rimosso_il: "nostra: segna quando il testo è stato tolto alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  consegne_evento: {
    id: "tecnica: l'identificativo interno della riga",
    evento_id: "tecnica: l'identificativo interno dell'evento; il titolo e la data stanno accanto, sotto `evento`",
    letture_tentate: "tecnica: quante volte il nostro sistema ha provato a leggere la risposta",
    testo_rimosso_il: "nostra: segna quando il testo è stato tolto alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  seguiti: {
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome sta accanto, sotto `ente`",
  },
  manifestazioni_interesse: {
    id: "tecnica: l'identificativo interno della riga",
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome sta accanto, sotto `ente`",
  },
  recinto_enti: {
    id: "tecnica: l'identificativo interno della riga",
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome sta accanto, sotto `ente`",
  },
  newsletter_iscrizioni: {
    id: "tecnica: l'identificativo interno della riga",
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome sta accanto, sotto `ente`",
    codice_uscita: "nostra: la chiave del link per uscire dalla newsletter; nel file starebbe solo come un modo per disiscriverti",
  },
  conversazioni_enti: {
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome sta accanto, sotto `ente`",
  },
  messaggi_enti: {
    id: "tecnica: l'identificativo interno della riga",
    mittente: "tecnica: nel file ci sono solo i messaggi che hai scritto tu, quindi direbbe sempre «studente»",
    letta: "di un'altra persona: se l'ente ha letto il messaggio",
    testo_rimosso_il: "nostra: segna quando il testo è stato tolto alla cancellazione di un account; chi scarica i propri dati ha un account vivo, e qui è sempre vuota",
  },
  assistente_conversazioni: {
    id: "tecnica: l'identificativo interno della riga",
  },
  assistente_richieste: {
    id: "tecnica: l'identificativo interno della riga",
  },
  classi_studenti: {
  },
  messaggi_scuola_destinatari: {
    messaggio_id: "tecnica: l'identificativo interno della comunicazione; l'oggetto e la data stanno accanto, sotto `messaggio`",
  },
  notifiche_studenti: {
    id: "tecnica: l'identificativo interno della riga",
    riferimento_id: "tecnica: l'identificativo interno della cosa a cui la notifica rimandava",
  },
  guide_kireo_aperte: {
    da_activity_log: "nostra: dice se la riga l'abbiamo ricopiata dal registro di prima del 10/11 (20261211100000), cioè una nota sulla nostra conoscenza, non una cosa che hai fatto; e il client non la legge",
  },
  scaricamenti_guide_enti: {
    guida_id: "tecnica: l'identificativo interno della guida, che dopo una cancellazione non porta a niente; il titolo copiato sta nel file",
    istituzione_id: "tecnica: l'identificativo interno dell'ente; il nome copiato sta nel file",
  },
};

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
 * punti a una voce che esiste, che ogni voce copra almeno una tabella, che
 * nessuna tabella del debito resti senza voce, e che nessuna voce PROMETTA una
 * cosa classificata in `FUORI` (vedi `termine` là sotto). Che il TESTO di una
 * voce nomini davvero la cosa — se qualcuno riscrive la voce dei workshop
 * togliendo «consegne», `workshop_consegne` resta agganciata a una voce che
 * non la nomina più — è semantico, e nessuna guardia lessicale lo vede. Si
 * trova leggendo.
 *
 * ⚠️ E LEGGENDO SI È TROVATO, il 10/10/2026: delle nove voci della prima
 * stesura QUATTRO sbagliavano, e tutte e quattro per eccesso di fiducia nella
 * propria memoria del prodotto invece che nell'elenco qui sotto. Non
 * nominavano il diario e gli artefatti; dicevano «da quelle risposte» come se
 * le deduzioni venissero solo dai test, e tacevano lo stile; non distinguevano
 * le due chat dei workshop, né il tutor, né le revisioni di tappa; e la voce
 * delle classi nominava «gli attestati», che è la riga di un DOCENTE. Le nove
 * qui sotto sono la riscrittura di Mario, verbatim.
 *
 * Il senso di quell'errore è il motivo per cui `termine` esiste: **una voce
 * che enumera si chiude da sé, e tutto quello che resta fuori dall'elenco lo
 * esclude attivamente — non è una dimenticanza, è un'affermazione.** Quindi
 * una voce che nomina una cosa non sua non è imprecisa: promette.
 */
export const VOCI_DEBITO = [
  // Staccata dai test di proposito: è la categoria che pesa, ed è l'unica di
  // tutte che un ragazzo ha il diritto di vedere e non immaginerebbe mai che
  // esista. Quando entrerà nel file, entrerà con la `motivazione` leggibile
  // che è stata scritta apposta per poter essere letta da lui.
  //
  // «il ritratto del tuo modo di lavorare» è `style_signal`, ed è
  // deliberatamente inquietante: deve esserlo. Questo pezzo di testo è
  // letteralmente l'unico posto del prodotto in cui diciamo a uno studente che
  // quel ritratto esiste.
  { id: "dedotto", testo: "Quello che KIREO ha dedotto da quello che hai fatto: i punteggi e le ipotesi sulle aree, il ritratto del tuo modo di lavorare, e i giudizi sui tuoi workshop (le revisioni di ogni tappa, il giudizio finale e la fiducia)" },
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
 * voce escludono la cosa si mette `null` e si conta fra le scoperte, perché il
 * senso del cricchetto è che quello che manca non possa mancare in silenzio.
 *
 * Dal 10/10/2026 nessuna è `null`: le due che lo erano (`recinto_enti` e
 * `style_signal`) le ha prese la riscrittura delle voci, e il cricchetto è a
 * zero. Quindi oggi è un invariante — ogni tabella del debito ha la sua voce —
 * e il campo resta nullable per il caso che un giorno non si possa nominare,
 * perché allora quel `null` va scritto e contato invece di sembrare un
 * aggancio sbagliato.
 */
export const ATTESE: { tabella: string; natura: NaturaDato; nominataDa: IdVoceDebito | null; cosa: string }[] = [
  // ── scritto da lui
  // Nominate dalla voce dal 10/10/2026 («il diario che hai scritto e le cose
  // che hai salvato»): prima stavano dentro il suo perimetro e fuori da quello
  // che enumerava, cioè escluse dalle sue stesse parole.

  // ── fatto da lui
  // Era una delle due SCOPERTE del 10/10: la voce degli enti enumerava chi
  // segui, a chi hai manifestato interesse e i messaggi, e una guida scaricata
  // non è nessuna delle tre. Dal 10/10 la nominava («e le guide che hai
  // scaricato»); dal 29/10 le guide scaricate sono nel file
  // (`scaricamenti_guide_enti`), e la voce dice quello che il recinto è
  // davvero: con quali enti c'è stato un contatto, e da quale gesto. Testo mio
  // e provvisorio: la voce di prima era di Mario.
  // ⚠️ «le iscrizioni alla newsletter» è la newsletter DI UN ENTE, cioè una
  // riga sua. `newsletter_docenti` è in `FUORI` ed è un'altra cosa: per questo
  // la parola «newsletter» non può essere un `termine` di sorveglianza.

  // ── dedotto da noi: la categoria che pesa, perché è quello che pensiamo di lui
  { tabella: "evidence", natura: "dedotto", nominataDa: "dedotto", cosa: "le prove, ognuna con la sua motivazione leggibile — scritta apposta per poter essere letta da lui" },
  { tabella: "area_signal", natura: "dedotto", nominataDa: "dedotto", cosa: "i quattro punteggi per area, la confidence e lo status" },
  // Era la seconda SCOPERTA del 10/10, e quella che pesava: la voce si
  // limitava con le proprie parole («le ipotesi sulle aree») e lo stile non è
  // un'area — sono i quattro assi di COME lavora. Un ragazzo leggeva quella
  // voce e non imparava che esiste. Ora la nomina, e la nomina con le parole
  // giuste: «il ritratto del tuo modo di lavorare».
  { tabella: "style_signal", natura: "dedotto", nominataDa: "dedotto", cosa: "il profilo di stile dei quattro assi" },
  { tabella: "workshop_fasi_stato", natura: "dedotto", nominataDa: "dedotto", cosa: "la revisione di ogni tappa e la reazione del cliente" },

  // ── coinvolge un terzo

  // ── mandato da noi
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
 *
 * ── `termine`, e perché non è un vezzo ──
 *
 * Il 10/10/2026 la voce delle classi diceva «e gli attestati», e un attestato
 * è la riga di un DOCENTE. Non era un aggancio sbagliato — nessuna riga di
 * `ATTESE` puntava ad `attestati`, perché `attestati` sta qui — erano le
 * PAROLE: la voce prometteva a un ragazzo una cosa che avevamo già deciso non
 * essere sua. Nessuno dei controlli di allora poteva vederlo, perché
 * guardavano gli agganci e non il testo.
 *
 * `termine` è la stringa che, trovata dentro una voce di `cosaContiene`, è
 * quella promessa. `npm run test:export` la cerca in tutti e due gli elenchi.
 * Non controlla che le parole siano giuste: controlla che non promettano una
 * cosa classificata qui.
 *
 * ⚠️ `null` VUOL DIRE «questa non si sorveglia», e la ragione va scritta: la
 * parola che la nominerebbe compare legittimamente in una voce vera, quindi un
 * termine qui griderebbe su un testo giusto — e un controllo che grida su una
 * cosa giusta è un controllo che qualcuno disattiva. Il campo è obbligatorio
 * nel tipo apposta: una sesta riga non si può aggiungere senza decidere.
 */
export const FUORI: { tabella: string; perche: string; termine: string[] | null }[] = [
  {
    tabella: "player_live_stato",
    // Il 04/11 era una sezione del 6b, e la guardia sulla replica l'ha fermata:
    // la tabella non ha una policy di lettura, quindi lo studente avrebbe letto
    // zero righe per sempre, un «vuoto» che non è vero. E non serve aprirla:
    // la riga si cancella quando il player si riprende.
    perche: "è lo stato del player in questo momento (il video non parte adesso), e si cancella quando il video riparte: non conserva niente di quello che hai fatto",
    termine: null,
  },
  {
    tabella: "teacher_profiles",
    perche: "è la riga di un docente (o di un referente scuola), non di uno studente — e l'area docente non ha un proprio export",
    termine: ["docent"],
  },
  {
    tabella: "newsletter_docenti",
    perche: "è l'iscrizione alla newsletter di un docente",
    // ⚠️ NON «newsletter»: la voce dell'assistente dice «le iscrizioni alla
    // newsletter» e intende `newsletter_iscrizioni`, che è la newsletter di un
    // ENTE, cioè una riga sua. Quello che distingue questa è il docente.
    termine: ["docent"],
  },
  {
    tabella: "attestati",
    perche: "è l'attestato di partecipazione di un docente a un webinar",
    // La riga per cui questa guardia esiste. Sul lato studente non c'è niente
    // che si chiami attestato, quindi la parola è univoca.
    termine: ["attestat"],
  },
  {
    tabella: "institution_profiles",
    perche: "è il collegamento fra una persona e l'ente per cui lavora",
    // NON sorvegliabile: la parola che la nominerebbe è «ente», e la voce
    // degli enti si apre con «Gli enti: chi segui…». La frase che davvero la
    // promette sarebbe «l'ente per cui lavori», che nessuno scriverebbe in un
    // elenco rivolto a uno studente.
    termine: null,
  },
  {
    tabella: "school_staff",
    perche: "è la riga di un referente o di un tutor dentro il proprio istituto",
    // Solo «referente»: «tutor» compare legittimamente nella voce dei
    // workshop («quello che hai chiesto al tutor»), che è l'AI-tutor
    // dell'elaborato e non un tutor di scuola. Copertura parziale, dichiarata.
    termine: ["referente"],
  },
  {
    tabella: "codici_consenso_kireo",
    perche:
      "è una chiave nostra, il codice del link di disiscrizione nelle email (20261126100000): non è una cosa che lo studente ha fatto, e nel file starebbe solo come una chiave per ritirargli il consenso. Il consenso stesso, con la sua data, è nel file con il profilo",
    // NON sorvegliabile: nessuno scriverebbe «il codice del link» in un elenco
    // rivolto a uno studente.
    termine: null,
  },
  {
    tabella: "indirizzi_delle_lapidi",
    perche:
      "è l'indirizzo di un account GIÀ cancellato che ha lasciato firme (20261203100000): esiste solo quando l'account non c'è più, quindi nessuno studente vivo ha una riga qui da scaricare",
    // NON sorvegliabile: nessuna voce rivolta a uno studente parla di lapidi.
    termine: null,
  },
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
/**
 * Le voci del debito che coprono ancora almeno una tabella: il conto lo dà il
 * mondo (le righe di `ATTESE`), non l'elenco delle voci. 04/11 (Mario, 6a): una
 * voce che non copre più niente promette al ragazzo una cosa che non manca, e
 * il denominatore del file la conterebbe lo stesso. `npm run test:export`
 * tiene anche l'elenco pulito (ogni voce copre qualcosa), ma è questa la
 * strada che decide.
 */
export const VOCI_APERTE = VOCI_DEBITO.filter((v) => ATTESE.some((a) => a.nominataDa === v.id));

export const COSA_CONTIENE = {
  inQuestoFile: SEZIONI_EXPORT.map((s) => s.voce),
  nonAncoraInQuestoFile: VOCI_APERTE.map((v) => v.testo),
  // ⚠️ Fino al 03/11 qui c'era «scrivici a info@kireo.it e te lo mandiamo»: una
  // promessa senza una procedura dietro (chi risponde, con cosa, in quanto
  // tempo). Tolta (Mario): un'assenza dichiarata è meglio di una promessa che
  // nessuno sa mantenere. Mia e provvisoria.
  nota: "Le parti del secondo elenco non sono ancora in questo file: le stiamo aggiungendo.",
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
export function assemblaEsportazione(esiti: EsitoSezione[], email: string | null, adesso: Date = new Date()): Esportazione {
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
    // ⚠️ 04/11 (Mario, §6a): qui c'era `tutteLePartiRichiesteOttenute: true`,
    // vero rispetto a quello che il codice aveva chiesto, e letto come «ho
    // tutto» accanto a un elenco di parti che non ci sono. Un `true` assoluto
    // accanto a delle assenze è un allarme che si impara a ignorare: ora il
    // file dice quante parti su quante, e quante non sono ancora nel file.
    parti: {
      inQuestoFile: SEZIONI_EXPORT.length,
      ottenute: SEZIONI_EXPORT.length - nonSiamoRiusciti.length,
      nonOttenute: nonSiamoRiusciti,
      nonAncoraInQuestoFile: VOCI_APERTE.length,
    },
  };
  if (!tutteLePartiRichiesteOttenute) contenuto.avviso = TESTO_AVVISO_INCOMPLETO;

  // La sezione non ottenuta NON compare: né `[]`, né un segnaposto.
  SEZIONI_EXPORT.forEach((s, i) => {
    const esito = esiti[i];
    if (esito?.ottenuta) contenuto[s.chiave] = esito.dati;
  });
  // 04/11 (Mario, §6c): l'indirizzo email non stava nel file, ed è il dato che
  // lo identifica (e dal 03/11 la chiave della lapide). Non sta in `profiles`,
  // sta in auth: lo passa chi chiama, dalla sessione. Senza un indirizzo letto
  // lo si dice, non lo si tace.
  if (contenuto.profilo && typeof contenuto.profilo === "object") {
    contenuto.profilo = { email: email ?? "non letto: non siamo riusciti a leggere il tuo indirizzo", ...(contenuto.profilo as object) };
  }

  return { file: JSON.stringify(contenuto, null, 2), tutteLePartiRichiesteOttenute, nonSiamoRiusciti };
}
