// KIREO — Test attitudinali, contenuto (client-safe: solo domande, opzioni,
// etichette d'area; nessun numero di punteggio, che vive solo in scoring.ts
// lato server). Fase 1: il solo T1 «Da dove parti», 14 item sulle 18 aree.
//
// Principio (dal design): nessun item chiede «ti interessa l'area X?». Chiedono
// cose concrete e a basso carico identitario (cosa guarderesti più a lungo,
// quale notizia apriresti). Tre accorgimenti anti-falsificazione: ordine delle
// opzioni randomizzato per-attempt (lib/test/ordine.ts), due item negativi
// (4 e 11) e due a scelta forzata a coppie (6 e 12).

export type ItemTipo = "positivo" | "negativo" | "forzata";

// Un'opzione dell'item, etichettata con l'area che rappresenta.
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

export type TestMeta = {
  slug: string;
  titolo: string;
  sottotitolo: string;
  descrizione: string;
  durata: string;
};

export type TestDef = TestMeta & {
  items: TestItem[];
  // Dopo quale numero d'item mostrare la micro-schermata motivazionale.
  motivazionaleDopo: number;
  motivazionaleTitolo: string;
  motivazionaleTesto: string;
};

export const SLUG_T1 = "da-dove-parti";

const T1: TestDef = {
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

const TESTS: TestDef[] = [T1];
const TEST_BY_SLUG = new Map(TESTS.map((t) => [t.slug, t]));

// Metadati del catalogo (client), senza gli item.
export const TEST_META: TestMeta[] = TESTS.map(({ slug, titolo, sottotitolo, descrizione, durata }) => ({ slug, titolo, sottotitolo, descrizione, durata }));

export function getTest(slug: string): TestDef | undefined {
  return TEST_BY_SLUG.get(slug);
}
