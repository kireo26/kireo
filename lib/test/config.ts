// KIREO — Test attitudinali, contenuto (client-safe: solo domande, opzioni,
// etichette d'area; nessun numero di punteggio, che vive solo in scoring.ts
// lato server). Fase 1: il solo T1 «Da dove parti», 14 item sulle 18 aree.
//
// Principio (dal design): nessun item chiede «ti interessa l'area X?». Chiedono
// cose concrete e a basso carico identitario (cosa guarderesti più a lungo,
// quale notizia apriresti). Tre accorgimenti anti-falsificazione: ordine delle
// opzioni randomizzato per-attempt (lib/test/ordine.ts), due item negativi
// (4 e 11) e due a scelta forzata a coppie (6 e 12).

import type { AsseStile } from "@/lib/escape/tipi";

export type ItemTipo = "positivo" | "negativo" | "forzata";

// ── T1 «Da dove parti» — item a scelta, mappati sulle 18 AREE ──
export type OpzioneItem = { id: string; label: string; area: string };
export type TestItem = {
  id: string;
  numero: number;
  domanda: string;
  // frammento leggibile per costruire la motivazione della prova, es.
  // «Tra le cose che guarderesti più a lungo» → «… hai scelto «un orto…»».
  frammento: string;
  tipo: ItemTipo;
  opzioni: OpzioneItem[];
};

// ── T2 «Come ti muovi» — item su 4 ASSI di stile (analitico/relazionale/
// creativo/operativo). `punti` può essere NEGATIVO (scelte forzate: +3 a un
// asse, −1 all'altro). ──
export type PesoAsse = { asse: AsseStile; punti: number };
export type OpzioneAsse = { id: string; label: string; pesi: PesoAsse[] };
export type ElementoAsse = { id: string; label: string; asse: AsseStile };
export type ItemT2 =
  // situazionali (1-9) + scelte forzate a coppie (10-12): due o quattro opzioni
  | { id: string; numero: number; tipo: "scelta"; domanda: string; frammento: string; opzioni: OpzioneAsse[] }
  // comportamentale 13 (ordina_priorita): 1° = +3 · 2° = +2 · 3° = +1 · 4° = 0
  | { id: string; numero: number; tipo: "ordina"; domanda: string; frammento: string; elementi: ElementoAsse[] }
  // comportamentale 14 (alloca_budget): ore/totale × 4, arrotondato
  | { id: string; numero: number; tipo: "alloca"; domanda: string; frammento: string; totale: number; unita: string; voci: ElementoAsse[] }
  // Likert 15-16: scala 1-5 → +1..+5 su un asse
  | { id: string; numero: number; tipo: "likert"; domanda: string; frammento: string; asse: AsseStile };

export type TestMeta = {
  slug: string;
  titolo: string;
  sottotitolo: string;
  descrizione: string;
  durata: string;
};

type TestComune = TestMeta & {
  // Dopo quale numero d'item mostrare la micro-schermata motivazionale.
  motivazionaleDopo: number;
  motivazionaleTitolo: string;
  motivazionaleTesto: string;
};

// TestDef è discriminato su `misura`: T1 misura le aree, T2 gli assi. Il player
// e lo scoring si ramificano su questo campo.
export type TestDef =
  | (TestComune & { misura: "aree"; items: TestItem[] })
  | (TestComune & { misura: "assi"; items: ItemT2[] });

export const SLUG_T1 = "da-dove-parti";
export const SLUG_T2 = "come-ti-muovi";

const T1: TestDef = {
  misura: "aree",
  slug: SLUG_T1,
  titolo: "Da dove parti",
  sottotitolo: "14 domande, 5-6 minuti · verso quali mondi ti orienti",
  descrizione:
    "Non ti chiediamo cosa vuoi fare da grande. Ti mostriamo cose concrete — una vetrina, un titolo di giornale, un problema da risolvere — e guardiamo cosa ti attira di più. Da qui proviamo a capire, come ipotesi e mai come verdetto, verso quali aree ti orienti. Nessun cronometro: puoi fermarti e riprendere quando vuoi, e rifarlo quando cambi idea.",
  durata: "5-6 minuti",
  motivazionaleDopo: 7,
  motivazionaleTitolo: "Sei a metà.",
  motivazionaleTesto:
    "Non c'è una risposta giusta in nessuna di queste domande: stiamo solo guardando dove va la tua attenzione. Rispondi di pancia — è più onesto, e più utile a te.",
  items: [
    {
      id: "i1",
      numero: 1,
      domanda: "Ti fermi davanti a una vetrina. Quale di queste cose guarderesti più a lungo?",
      frammento: "Tra le cose che guarderesti più a lungo",
      tipo: "positivo",
      opzioni: [
        { id: "i1a", label: "Un modellino di una struttura in costruzione", area: "edilizia-architettura" },
        { id: "i1b", label: "Una stampante 3D che sta lavorando", area: "meccanica-meccatronica" },
        { id: "i1c", label: "Un abito costruito con materiali insoliti", area: "arte-design-moda" },
        { id: "i1d", label: "Un orto verticale che funziona da solo", area: "agrifood-ambiente" },
      ],
    },
    {
      id: "i2",
      numero: 2,
      domanda: "Apri il telefono e vedi cinque titoli. Quale leggi per primo?",
      frammento: "Tra i titoli di giornale",
      tipo: "positivo",
      opzioni: [
        { id: "i2a", label: "«Trovata una molecola che rallenta una malattia»", area: "salute-professioni-sanitarie" },
        { id: "i2b", label: "«Cambia la legge sugli affitti brevi»", area: "giurisprudenza-pa" },
        { id: "i2c", label: "«Il documentario girato in nove mesi in un solo quartiere»", area: "comunicazione-media" },
        { id: "i2d", label: "«Il paese che ha eliminato le auto dal centro»", area: "mobilita-sostenibile" },
      ],
    },
    {
      id: "i3",
      numero: 3,
      domanda: "Quale di questi problemi ti sembra più interessante da risolvere?",
      frammento: "Tra i problemi da risolvere",
      tipo: "positivo",
      opzioni: [
        { id: "i3a", label: "Capire perché una macchina si ferma sempre allo stesso punto", area: "meccanica-meccatronica" },
        { id: "i3b", label: "Capire perché in una classe nessuno partecipa", area: "scienze-educazione" },
        { id: "i3c", label: "Capire perché un negozio perde clienti", area: "economia-management" },
        { id: "i3d", label: "Capire perché un dato non torna", area: "scienze-ricerca" },
      ],
    },
    {
      id: "i4",
      numero: 4,
      domanda: "Quale di queste cose ti annoierebbe di più?",
      frammento: "Tra le cose che ti annoierebbero",
      tipo: "negativo",
      opzioni: [
        { id: "i4a", label: "Controllare per ore che dei conti tornino", area: "economia-management" },
        { id: "i4b", label: "Rifare la stessa cucitura cinquanta volte", area: "arte-design-moda" },
        { id: "i4c", label: "Stare in un cantiere sotto il sole a prendere misure", area: "edilizia-architettura" },
        { id: "i4d", label: "Ripetere lo stesso esperimento finché non viene", area: "scienze-ricerca" },
      ],
    },
    {
      id: "i5",
      numero: 5,
      domanda: "Ti offrono di passare una giornata a guardare qualcuno che lavora. Chi scegli?",
      frammento: "Tra le persone da guardare al lavoro",
      tipo: "positivo",
      opzioni: [
        { id: "i5a", label: "Chi progetta il suono di uno spettacolo", area: "musica-spettacolo" },
        { id: "i5b", label: "Chi assiste una persona in riabilitazione", area: "salute-professioni-sanitarie" },
        { id: "i5c", label: "Chi organizza il servizio di un ristorante in una sera piena", area: "ristorazione-turismo" },
        { id: "i5d", label: "Chi traduce in tempo reale in una riunione", area: "lingue-relazioni-internazionali" },
      ],
    },
    {
      id: "i6",
      numero: 6,
      domanda: "Devi scegliere. Preferiresti…",
      frammento: "Dovendo scegliere",
      tipo: "forzata",
      opzioni: [
        { id: "i6a", label: "Scoprire come funziona una cosa che nessuno ha ancora capito", area: "scienze-ricerca" },
        { id: "i6b", label: "Rendere una cosa complicata comprensibile a tutti", area: "comunicazione-media" },
      ],
    },
    {
      id: "i7",
      numero: 7,
      domanda: "Un edificio abbandonato viene assegnato a chi presenta l'idea migliore. Su cosa lavoreresti?",
      frammento: "Sull'edificio abbandonato",
      tipo: "positivo",
      opzioni: [
        { id: "i7a", label: "Su come renderlo sicuro e riutilizzabile", area: "edilizia-architettura" },
        { id: "i7b", label: "Su cosa ci si può fare dentro per il quartiere", area: "scienze-educazione" },
        { id: "i7c", label: "Su come farlo conoscere e riempirlo di gente", area: "comunicazione-media" },
        { id: "i7d", label: "Su come farlo stare in piedi economicamente", area: "economia-management" },
      ],
    },
    {
      id: "i8",
      numero: 8,
      domanda: "Quale di queste frasi ti somiglia di più?",
      frammento: "Tra le frasi che ti somigliano",
      tipo: "positivo",
      opzioni: [
        { id: "i8a", label: "«Mi accorgo subito quando qualcosa non è al suo posto»", area: "sicurezza-difesa" },
        { id: "i8b", label: "«Mi accorgo subito quando qualcuno sta male»", area: "salute-professioni-sanitarie" },
        { id: "i8c", label: "«Mi accorgo subito quando una cosa è fatta bene»", area: "arte-design-moda" },
        { id: "i8d", label: "«Mi accorgo subito quando un discorso non regge»", area: "scienze-ricerca" },
      ],
    },
    {
      id: "i9",
      numero: 9,
      domanda: "In gita, dove ti fermeresti più a lungo?",
      frammento: "In gita ti fermeresti",
      tipo: "positivo",
      opzioni: [
        { id: "i9a", label: "In un laboratorio artigiano", area: "arte-design-moda" },
        { id: "i9b", label: "In un mercato con prodotti del posto", area: "agrifood-ambiente" },
        { id: "i9c", label: "In un archivio con documenti di due secoli fa", area: "studi-umanistici-beni-culturali" },
        { id: "i9d", label: "In una sala di controllo di una centrale", area: "energia-sostenibilita" },
      ],
    },
    {
      id: "i10",
      numero: 10,
      domanda: "Ti chiedono di dare una mano a un evento. Quale compito prendi?",
      frammento: "All'evento prenderesti",
      tipo: "positivo",
      opzioni: [
        { id: "i10a", label: "Occuparti del cibo e di come si mangia", area: "ristorazione-turismo" },
        { id: "i10b", label: "Occuparti di chi arriva e non parla italiano", area: "lingue-relazioni-internazionali" },
        { id: "i10c", label: "Curare luci e audio", area: "musica-spettacolo" },
        { id: "i10d", label: "Controllare che sia tutto sicuro", area: "sicurezza-difesa" },
      ],
    },
    {
      id: "i11",
      numero: 11,
      domanda: "Quale di queste cose non vorresti proprio fare?",
      frammento: "Tra le cose che non vorresti fare",
      tipo: "negativo",
      opzioni: [
        { id: "i11a", label: "Assistere una persona che non collabora", area: "salute-professioni-sanitarie" },
        { id: "i11b", label: "Scrivere il testo di una campagna", area: "comunicazione-media" },
        { id: "i11c", label: "Riparare qualcosa che non sai come è fatto", area: "meccanica-meccatronica" },
        { id: "i11d", label: "Potare e curare piante tutto il giorno", area: "agrifood-ambiente" },
      ],
    },
    {
      id: "i12",
      numero: 12,
      domanda: "Devi scegliere. Preferiresti…",
      frammento: "Dovendo scegliere",
      tipo: "forzata",
      opzioni: [
        { id: "i12a", label: "Costruire qualcosa che dura vent'anni", area: "edilizia-architettura" },
        { id: "i12b", label: "Curare qualcuno che sta male oggi", area: "salute-professioni-sanitarie" },
      ],
    },
    {
      id: "i13",
      numero: 13,
      domanda: "Quale di questi mestieri ti incuriosisce di più vedere da vicino?",
      frammento: "Ti incuriosirebbe vedere da vicino",
      tipo: "positivo",
      opzioni: [
        { id: "i13a", label: "Chi progetta il percorso di un autobus per una città", area: "mobilita-sostenibile" },
        { id: "i13b", label: "Chi controlla i consumi di un edificio e li fa scendere", area: "energia-sostenibilita" },
        { id: "i13c", label: "Chi programma il sistema che gestisce un ospedale", area: "informatica-digitale" },
        { id: "i13d", label: "Chi restaura un quadro", area: "studi-umanistici-beni-culturali" },
      ],
    },
    {
      id: "i14",
      numero: 14,
      domanda: "Ultima. Quale di queste soddisfazioni riconosci di più come tua?",
      frammento: "La soddisfazione che senti più tua",
      tipo: "positivo",
      opzioni: [
        { id: "i14a", label: "Aver capito come funziona qualcosa", area: "informatica-digitale" },
        { id: "i14b", label: "Aver rimesso in funzione qualcosa che era rotto", area: "meccanica-meccatronica" },
        { id: "i14c", label: "Aver fatto stare meglio qualcuno", area: "salute-professioni-sanitarie" },
        { id: "i14d", label: "Aver messo ordine dove c'era confusione", area: "giurisprudenza-pa" },
      ],
    },
  ],
};

const T2: TestDef = {
  misura: "assi",
  slug: SLUG_T2,
  titolo: "Come ti muovi",
  sottotitolo: "16 domande, 6-7 minuti · come lavori, dentro qualunque area",
  descrizione:
    "T1 dice verso quali mondi ti orienti; questo test dice COME ti muovi dentro qualunque cosa: se osservi e scomponi, se ascolti e tieni insieme le persone, se cerchi la strada che non c'era, o se decidi e porti a termine. Non c'è un modo migliore di un altro. Da qui nasce un'ipotesi sul tuo stile — mai un'etichetta — che le missioni serviranno a mettere alla prova. Nessun cronometro: puoi fermarti e riprendere.",
  durata: "6-7 minuti",
  motivazionaleDopo: 8,
  motivazionaleTitolo: "Sei a metà.",
  motivazionaleTesto:
    "Nessuna di queste risposte «fa più bella figura» delle altre: i quattro modi di lavorare valgono uguale, e servono tutti. Rispondi come faresti davvero, non come pensi si debba fare.",
  items: [
    { id: "t2_1", numero: 1, tipo: "scelta", frammento: "Davanti a un progetto nuovo", domanda: "Ti affidano un progetto nuovo e hai poco tempo per orientarti. Da dove parti?", opzioni: [
      { id: "t2_1a", label: "Raccolgo dati e vincoli prima di decidere", pesi: [{ asse: "analitico", punti: 3 }] },
      { id: "t2_1b", label: "Sento le persone coinvolte per capire cosa si aspettano", pesi: [{ asse: "relazionale", punti: 3 }] },
      { id: "t2_1c", label: "Cerco un'idea diversa da come si è sempre fatto", pesi: [{ asse: "creativo", punti: 3 }] },
      { id: "t2_1d", label: "Definisco i primi tre passi e comincio", pesi: [{ asse: "operativo", punti: 3 }] },
    ] },
    { id: "t2_2", numero: 2, tipo: "scelta", frammento: "Davanti a un imprevisto vicino alla consegna", domanda: "Salta fuori un problema imprevisto poco prima della consegna.", opzioni: [
      { id: "t2_2a", label: "Cerco la causa vera e scompongo il problema", pesi: [{ asse: "analitico", punti: 3 }, { asse: "operativo", punti: 1 }] },
      { id: "t2_2b", label: "Tengo insieme il gruppo perché non vada nel panico", pesi: [{ asse: "relazionale", punti: 3 }, { asse: "operativo", punti: 1 }] },
      { id: "t2_2c", label: "Propongo una via che nessuno aveva considerato", pesi: [{ asse: "creativo", punti: 3 }, { asse: "analitico", punti: 1 }] },
      { id: "t2_2d", label: "Scelgo una direzione e faccio muovere tutti", pesi: [{ asse: "operativo", punti: 3 }, { asse: "relazionale", punti: 1 }] },
    ] },
    { id: "t2_3", numero: 3, tipo: "scelta", frammento: "Con tante informazioni in disordine", domanda: "Hai davanti tante informazioni in disordine.", opzioni: [
      { id: "t2_3a", label: "Le classifico e ne ricavo uno schema", pesi: [{ asse: "analitico", punti: 3 }] },
      { id: "t2_3b", label: "Chiedo a chi c'è dentro cosa conta davvero", pesi: [{ asse: "relazionale", punti: 3 }] },
      { id: "t2_3c", label: "Cerco collegamenti tra cose lontane tra loro", pesi: [{ asse: "creativo", punti: 3 }] },
      { id: "t2_3d", label: "Tengo solo quello che serve per decidere", pesi: [{ asse: "operativo", punti: 3 }] },
    ] },
    { id: "t2_4", numero: 4, tipo: "scelta", frammento: "In una riunione confusa", domanda: "Sei in una riunione che sta andando in confusione.", opzioni: [
      { id: "t2_4a", label: "Rimetto in ordine i punti emersi", pesi: [{ asse: "analitico", punti: 3 }] },
      { id: "t2_4b", label: "Traduco le posizioni degli uni agli altri", pesi: [{ asse: "relazionale", punti: 3 }] },
      { id: "t2_4c", label: "Sposto il discorso su un altro piano", pesi: [{ asse: "creativo", punti: 3 }] },
      { id: "t2_4d", label: "Chiudo con decisioni e responsabilità", pesi: [{ asse: "operativo", punti: 3 }] },
    ] },
    { id: "t2_5", numero: 5, tipo: "scelta", frammento: "Quando il gruppo si blocca", domanda: "Il gruppo si è bloccato. Il tuo contributo più naturale è…", opzioni: [
      { id: "t2_5a", label: "portare lucidità e struttura", pesi: [{ asse: "analitico", punti: 3 }] },
      { id: "t2_5b", label: "rimettere in circolo il confronto", pesi: [{ asse: "relazionale", punti: 3 }] },
      { id: "t2_5c", label: "aprire una strada diversa", pesi: [{ asse: "creativo", punti: 3 }] },
      { id: "t2_5d", label: "sbloccare con un passo concreto", pesi: [{ asse: "operativo", punti: 3 }] },
    ] },
    { id: "t2_6", numero: 6, tipo: "scelta", frammento: "Davanti a una critica", domanda: "Ricevi una critica sul tuo lavoro.", opzioni: [
      { id: "t2_6a", label: "La analizzo per capire cosa esattamente migliorare", pesi: [{ asse: "analitico", punti: 3 }] },
      { id: "t2_6b", label: "Ne parlo per capire come sono stato percepito", pesi: [{ asse: "relazionale", punti: 3 }] },
      { id: "t2_6c", label: "La uso per ripensare l'approccio da capo", pesi: [{ asse: "creativo", punti: 3 }] },
      { id: "t2_6d", label: "La trasformo subito in correzioni concrete", pesi: [{ asse: "operativo", punti: 3 }] },
    ] },
    { id: "t2_7", numero: 7, tipo: "scelta", frammento: "Con carta bianca su un progetto", domanda: "Hai carta bianca su un piccolo progetto. Prima cosa che fai?", opzioni: [
      { id: "t2_7a", label: "Definisco cosa vuol dire farlo bene", pesi: [{ asse: "analitico", punti: 3 }] },
      { id: "t2_7b", label: "Capisco per chi lo sto facendo", pesi: [{ asse: "relazionale", punti: 3 }] },
      { id: "t2_7c", label: "Butto giù possibilità, anche strane", pesi: [{ asse: "creativo", punti: 3 }] },
      { id: "t2_7d", label: "Faccio un calendario con delle scadenze", pesi: [{ asse: "operativo", punti: 3 }] },
    ] },
    { id: "t2_8", numero: 8, tipo: "scelta", frammento: "Un'attività ti prende di più quando", domanda: "Un'attività ti prende di più quando…", opzioni: [
      { id: "t2_8a", label: "richiede precisione e ragionamento", pesi: [{ asse: "analitico", punti: 3 }] },
      { id: "t2_8b", label: "lascia qualcosa alle persone", pesi: [{ asse: "relazionale", punti: 3 }] },
      { id: "t2_8c", label: "ti fa immaginare o inventare", pesi: [{ asse: "creativo", punti: 3 }] },
      { id: "t2_8d", label: "porta un risultato che si vede", pesi: [{ asse: "operativo", punti: 3 }] },
    ] },
    { id: "t2_9", numero: 9, tipo: "scelta", frammento: "Quando impari qualcosa di nuovo", domanda: "Quando devi imparare qualcosa di nuovo, preferisci…", opzioni: [
      { id: "t2_9a", label: "capire la logica e il funzionamento", pesi: [{ asse: "analitico", punti: 3 }] },
      { id: "t2_9b", label: "confrontarti con chi ne sa più di te", pesi: [{ asse: "relazionale", punti: 3 }] },
      { id: "t2_9c", label: "esplorare per conto tuo e collegare", pesi: [{ asse: "creativo", punti: 3 }] },
      { id: "t2_9d", label: "provare subito nella pratica", pesi: [{ asse: "operativo", punti: 3 }] },
    ] },
    { id: "t2_10", numero: 10, tipo: "scelta", frammento: "Dovendo scegliere", domanda: "Devi scegliere. Cosa ti somiglia di più?", opzioni: [
      { id: "t2_10a", label: "«Capire bene prima di decidere»", pesi: [{ asse: "analitico", punti: 3 }, { asse: "operativo", punti: -1 }] },
      { id: "t2_10b", label: "«Far avanzare le cose senza restare fermo»", pesi: [{ asse: "operativo", punti: 3 }, { asse: "analitico", punti: -1 }] },
    ] },
    { id: "t2_11", numero: 11, tipo: "scelta", frammento: "Dovendo scegliere", domanda: "Devi scegliere. Cosa ti somiglia di più?", opzioni: [
      { id: "t2_11a", label: "«Far funzionare bene le persone insieme»", pesi: [{ asse: "relazionale", punti: 3 }, { asse: "creativo", punti: -1 }] },
      { id: "t2_11b", label: "«Trovare possibilità dove altri vedono solo vincoli»", pesi: [{ asse: "creativo", punti: 3 }, { asse: "relazionale", punti: -1 }] },
    ] },
    { id: "t2_12", numero: 12, tipo: "scelta", frammento: "La soddisfazione che riconosci più tua", domanda: "Quale soddisfazione riconosci più come tua?", opzioni: [
      { id: "t2_12a", label: "«Ho capito una cosa a fondo»", pesi: [{ asse: "analitico", punti: 3 }, { asse: "relazionale", punti: -1 }] },
      { id: "t2_12b", label: "«Ho aiutato il gruppo a funzionare meglio»", pesi: [{ asse: "relazionale", punti: 3 }, { asse: "analitico", punti: -1 }] },
    ] },
    { id: "t2_13", numero: 13, tipo: "ordina", frammento: "Per sistemare una cosa che non funziona, hai messo per prime", domanda: "Vi hanno dato due settimane per sistemare una cosa che non funziona. Metti in ordine cosa fai per prime.", elementi: [
      { id: "t2_13a", label: "Capire perché non funziona", asse: "analitico" },
      { id: "t2_13b", label: "Sentire chi la usa tutti i giorni", asse: "relazionale" },
      { id: "t2_13c", label: "Immaginare come potrebbe essere invece", asse: "creativo" },
      { id: "t2_13d", label: "Cominciare a sistemare la parte più semplice", asse: "operativo" },
    ] },
    { id: "t2_14", numero: 14, tipo: "alloca", frammento: "Delle dieci ore, la fetta più grande l'hai messa su", domanda: "Hai dieci ore per affrontare un problema. Come le distribuisci?", totale: 10, unita: "ore", voci: [
      { id: "t2_14a", label: "Studiare il problema", asse: "analitico" },
      { id: "t2_14b", label: "Parlare con le persone coinvolte", asse: "relazionale" },
      { id: "t2_14c", label: "Provare soluzioni diverse", asse: "creativo" },
      { id: "t2_14d", label: "Realizzare la prima versione", asse: "operativo" },
    ] },
    { id: "t2_15", numero: 15, tipo: "likert", frammento: "Sul decidere in base a dati e segnali oggettivi", domanda: "«Mi trovo bene quando devo decidere sulla base di dati e segnali oggettivi.»", asse: "analitico" },
    { id: "t2_16", numero: 16, tipo: "likert", frammento: "Sul passare in fretta dall'idea alla pratica", domanda: "«Preferisco passare in fretta dall'idea alla pratica.»", asse: "operativo" },
  ],
};

const TESTS: TestDef[] = [T1, T2];
const TEST_BY_SLUG = new Map(TESTS.map((t) => [t.slug, t]));

// Metadati del catalogo (client), senza gli item.
export const TEST_META: TestMeta[] = TESTS.map(({ slug, titolo, sottotitolo, descrizione, durata }) => ({ slug, titolo, sottotitolo, descrizione, durata }));

export function getTest(slug: string): TestDef | undefined {
  return TEST_BY_SLUG.get(slug);
}
