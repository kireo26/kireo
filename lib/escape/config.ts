// KIREO Escape — contenuto delle missioni (client-safe: solo prompt, opzioni,
// etichette d'area, materiali; nessun numero di punteggio, che vive solo in
// scoring.ts lato server). Standard v2: 5 stanze / 12 step, bivio del mandato,
// gettoni con conseguenze, materiali consultabili, trappola nello scarto,
// restituzione a 4 blocchi. Le missioni condividono la STRUTTURA (stessi tipi
// di step, stessi id canonici: s1_mandato, s1_materiali, s2_informazioni,
// s2_non_approfondire, s3_budget, s3_scarto, s4_proposta, s5_riflessione…) e
// differiscono solo per CONTENUTO. Il contenuto dinamico (dossier della Stanza
// 2, voci/totale del budget, testo del vincolo, avvisi dello scarto) è risolto
// dalle risposte via costruisciMissione(get), stesso accessore puro condiviso
// da player (client) e scoring (server).
//
// L'unica differenza di layout ammessa tra missioni è la posizione dello step
// "assegna_ruoli" (Stanza 4 nella Missione 01, Stanza 3 nelle 02/03): l'id dello
// step riflette la stanza (`s4_ruoli` o `s3_ruoli`), e il motore lo tratta per
// tipo, non per id.

import type {
  CompitoAssegnabile,
  EscapeMission,
  Lavoro,
  TagAsse,
  LeggiRisposta,
  Mandato,
  Materiale,
  MissioneMeta,
  OpzioneArea,
  OpzioneScarto,
  Passo,
  Payload,
  PayloadSceltaSingola,
  PayloadEsplora,
  PayloadSeleziona,
  PersonaAssegnabile,
  Ruolo,
  Step,
  StepPianificaLavori,
  VoceBudget,
} from "./tipi";
import { ASSI_MISSIONI } from "./assi";

export const SLUG_QUARTIERE = "progetto-quartiere";
export const SLUG_MEDIATECA = "crisi-mediateca";
export const SLUG_SERRA = "guasto-serra";
export const SLUG_CANTIERE = "cantiere-scuola";
export const SLUG_SPORTELLO = "sportello-insieme";
export const SLUG_FILIERA = "filiera-borea";
export const SLUG_MUSEO = "museo-seta";
export const SLUG_ACQUA = "citta-acqua";
export const SLUG_PALCO = "palco-programma";
export const SLUG_CLASSE = "classe-partecipa";
export const SLUG_VIAGGIO = "viaggio-impossibile";

// ─────────────────────────────────────────── tipi interni di definizione

type TS = { titolo: string; prompt: string; hint?: string };
type DefTesti = {
  introS1: string;
  introS2: string;
  introS4: string;
  introS5: string;
  materiali: TS;
  priorita: TS;
  mandato: TS;
  informazioni: TS;
  nonApprofondire: TS;
  budget: TS;
  scarto: TS;
  ruoli: TS;
  previsione: TS & { domanda: string };
  proposta: TS & { minCaratteri: number };
  riflessione: TS & { minCaratteri: number };
  passi: TS;
};

type MissioneDef = {
  meta: MissioneMeta;
  areeCandidate: string[];
  ruoliStanza: 3 | 4;
  daScartare: number;
  quantiPassi: number;
  materialiLiberi: Materiale[];
  materialiGettone: Materiale[];
  mandati: Mandato[];
  prioritaVoci: OpzioneArea[];
  ruoli: Ruolo[];
  passi: Passo[];
  budget: {
    // `totale` riceve anche i materiali letti: la Missione 11 è la prima in cui
    // la CAPIENZA del budget dipende da un materiale (M13 → +88 €), non solo le
    // voci disponibili. Le altre missioni lo ignorano.
    totale: (m: Mandato | null, letti: Set<string>) => number;
    unita: string;
    passo: number;
    voci: (m: Mandato | null, letti: Set<string>) => VoceBudget[];
  };
  // Se presente, la Stanza 3.1 è un "pianifica_lavori" (tetto soldi ± giorni +
  // dipendenze, o obiettivo da raggiungere) invece di un "alloca_budget". L'id
  // dello step resta comunque "s3_budget" (canonico). Missioni 04/06/07/08/11.
  // `budgetSoldi` può essere una funzione dei materiali letti: nella Missione 11
  // il tetto cresce da 264 a 352 € se è stato letto M13.
  piano?: {
    unitaSoldi: string;
    budgetSoldi?: number | ((letti: Set<string>) => number);
    budgetGiorni?: number;
    obiettivo?: number;
    unitaObiettivo?: string;
    lavori: (letti: Set<string>) => Lavoro[];
  };
  // Se presente, lo step dei ruoli (s3_ruoli / s4_ruoli) è un "assegna_persone"
  // (compito→persona specifica) invece di un "assegna_ruoli" (io/altri).
  // Missione 10: cinque abbinamenti compito↔persona sono segnali forti.
  assegnaPersone?: { compiti: CompitoAssegnabile[]; persone: PersonaAssegnabile[] };
  scarto: (letti: Set<string>) => OpzioneScarto[];
  introStanza3: (m: Mandato | null, letti: Set<string>) => string;
  testi: DefTesti;
};

// Le consulenze sono materiali a gettone che sono PERSONE da sentire: scegliere
// di consultare qualcuno invece di leggere un documento è, di per sé,
// relazionale — segnale uniforme e genuino in tutte le missioni (valore
// moderato, non travolge). Il contenuto tecnico di ciò che dicono resta
// area-specifico. `assi` è sovrascrivibile se una consulenza esprime altro.
function consulenza(id: string, titolo: string, area: string, contenuto: string, assi: TagAsse[] = [{ asse: "relazionale", valore: 0.4 }]): Materiale {
  return { id, titolo, aree: area ? [area] : [], costo: 1, contenuto, assi };
}

// =====================================================================
// MISSIONE 01 — "Il progetto per il quartiere" (invariata rispetto alla v2)
// =====================================================================

const Q_M1: Materiale = {
  id: "M1",
  titolo: "Scheda del quartiere",
  aree: [],
  costo: 0,
  contenuto:
    "8.400 abitanti; età media 47 anni; 22% over 65; 19% under 18; 31% delle famiglie con un solo genitore; disoccupazione giovanile 28%. Due fermate bus, nessuna metro. Un solo spazio pubblico aperto: il campetto parrocchiale.",
};
const Q_M2: Materiale = {
  id: "M2",
  titolo: "Verbale dell'assemblea di quartiere del 14 marzo",
  aree: [],
  costo: 0,
  contenuto:
    "61 presenti. Le richieste emerse sono in parte in contraddizione tra loro: «il quartiere» non è una voce sola. Alcuni interventi, riportati testualmente:",
  estratti: [
    { chi: "Sig.ra Peruzzi, 71 anni", testo: "Di sera qui non c'è più nessuno. Serve un posto dove ritrovarsi, non un'altra discoteca." },
    { chi: "Karim, 19 anni", testo: "Un posto dove suonare. Proviamo in un garage e i vicini chiamano i vigili." },
    { chi: "Prof.ssa Dessì, insegnante", testo: "I ragazzi non hanno dove studiare. Le biblioteche chiudono alle 19." },
    { chi: "Sig. Traversa, commerciante", testo: "Se non porta gente che spende, il quartiere non si rialza." },
    { chi: "Nadia, madre di due bambini", testo: "Un posto dove lasciarli il pomeriggio in sicurezza. Io lavoro fino alle 18." },
    { chi: "Comitato Verde Sanzio", testo: "Quel cortile deve tornare a essere terra, non cemento." },
  ],
};
const Q_M3: Materiale = {
  id: "M3",
  titolo: "Il bando del Comune",
  aree: [],
  costo: 0,
  contenuto:
    "180.000 € una tantum; assegnazione novennale; obbligo di apertura al pubblico almeno 20 ore a settimana; obbligo di sostenibilità economica dal terzo anno. Punteggio premiante per: occupazione giovanile creata, efficienza energetica, accessibilità.",
};
const Q_M4: Materiale = { id: "M4", titolo: "Perizia strutturale", aree: ["edilizia-architettura"], costo: 1, contenuto: "La copertura in lamiera ha travi ammalorate su 340 dei 900 m². Messa in sicurezza stimata 55.000 €; senza intervento quella porzione è inagibile. Chi non legge questa perizia scopre il problema solo dopo, a budget già speso." };
const Q_M5: Materiale = { id: "M5", titolo: "Diagnosi energetica", aree: ["energia-sostenibilita"], costo: 1, contenuto: "Consumo stimato a regime 38.000 kWh/anno ≈ 11.000 €/anno. Con cappotto + fotovoltaico da 20 kW: investimento 46.000 €, rientro in 6 anni, bolletta a 3.400 €/anno." };
const Q_M6: Materiale = { id: "M6", titolo: "Vincolo della Soprintendenza", aree: ["studi-umanistici-beni-culturali", "giurisprudenza-pa"], costo: 1, contenuto: "La facciata e le capriate originali sono tutelate: non si possono coprire né sostituire, solo consolidare. Ogni progetto che le nasconde viene respinto." };
const Q_M7: Materiale = { id: "M7", titolo: "Piano economico di gestione", aree: ["economia-management"], costo: 1, contenuto: "Costi fissi annui a regime: utenze 11.000, assicurazione 2.400, pulizie 7.200, coordinatore part-time 14.000. Totale ≈ 34.600 €/anno da coprire dal terzo anno." };
const Q_M8: Materiale = { id: "M8", titolo: "Indagine sui bisogni giovanili", aree: ["salute-professioni-sanitarie", "scienze-ricerca"], costo: 1, contenuto: "214 questionari agli under 25: 68% «non c'è niente da fare la sera»; 41% cerca un posto per studiare; 29% si sente solo spesso o sempre; 12% ha lasciato la scuola." };
const Q_M9: Materiale = { id: "M9", titolo: "Analisi del commercio locale", aree: ["economia-management", "ristorazione-turismo"], costo: 1, contenuto: "14 attività chiuse in 5 anni entro 400 m, 3 aperte. Nessun bar aperto dopo le 20. Due panifici storici ancora attivi." };
const Q_M10: Materiale = { id: "M10", titolo: "Report ambientale", aree: ["agrifood-ambiente", "scienze-ricerca"], costo: 1, contenuto: "0,9 m² di verde per abitante contro i 9 raccomandati. Il suolo del cortile retrostante (300 m²) è idoneo alla coltivazione. Isola di calore rilevata a +3,8 °C rispetto alla media cittadina." };
const Q_M11: Materiale = { id: "M11", titolo: "Dossier accessibilità e mobilità", aree: ["mobilita-sostenibile", "salute-professioni-sanitarie"], costo: 1, contenuto: "Nessuno scivolo per carrozzine sui tre ingressi; marciapiede antistante largo 90 cm. Il 22% del quartiere è over 65 e ci sono due strutture per disabili entro 600 m." };
const Q_M12: Materiale = { id: "M12", titolo: "Rilevazione sulla sicurezza percepita", aree: ["scienze-ricerca"], costo: 1, contenuto: "4 segnalazioni di vandalismo sull'edificio negli ultimi 12 mesi; illuminazione pubblica assente sul lato nord; il 54% dei residenti evita la via dopo le 21." };
const Q_M13: Materiale = { id: "M13", titolo: "Mappa delle competenze del quartiere", aree: ["lingue-relazioni-internazionali", "arte-design-moda", "musica-spettacolo", "meccanica-meccatronica", "informatica-digitale"], costo: 1, contenuto: "Censimento informale: 3 insegnanti in pensione; una sarta con laboratorio; un ex tecnico del suono; 2 meccanici; una comunità bangladese di ~300 persone con due mediatori linguistici; un gruppo musicale che prova in garage." };
const Q_M14: Materiale = { id: "M14", titolo: "Precedenti: cosa è successo altrove", aree: ["scienze-ricerca"], costo: 1, contenuto: "Tre casi reali: un progetto fallito dopo 18 mesi per costi di gestione sottostimati; uno riuscito grazie a un patto con le scuole; uno che ha funzionato solo dopo aver cambiato completamente destinazione al secondo anno." };

const Q_MANDATI: Mandato[] = [
  {
    id: "educativo", label: "«Un posto per crescere»", frase: "Un posto pensato per i ragazzi: studio, sostegno, un pomeriggio sicuro.",
    aree: ["scienze-educazione", "salute-professioni-sanitarie"],
    vincolo: { id: "minori", testo: "Ogni attività continuativa con minori richiede spazi separati certificati e personale qualificato: +38.000 € e uno dei tre locali grandi non è più utilizzabile per il resto." },
    consulenze: [
      consulenza("C_pedagogista", "Consulenza: pedagogista", "scienze-educazione", "Servono spazi distinti per fasce d'età e figure con titolo. Il doposcuola funziona solo se stabile e continuativo, non a singhiozzo."),
      consulenza("C_educatore", "Consulenza: educatore", "salute-professioni-sanitarie", "Il 29% dei ragazzi si sente solo: conta la presenza di adulti di riferimento, più che le attrezzature. Ambienti accoglienti, non asettici."),
    ],
  },
  {
    id: "economico", label: "«Un posto che produce»", frase: "Un posto che riporta attività, lavoro e gente che spende nel quartiere.",
    aree: ["economia-management", "ristorazione-turismo"],
    vincolo: { id: "sostenibilita", testo: "La sostenibilità dal terzo anno va dimostrata con un piano firmato: servono 34.600 €/anno di ricavi propri o l'assegnazione decade." },
    consulenze: [
      consulenza("C_commercialista", "Consulenza: commercialista", "economia-management", "Un mix di ricavi (affitti a ore, bar, corsi a pagamento) regge meglio di un'unica fonte. Prevedi un margine per i mesi vuoti."),
      consulenza("C_ristoratore", "Consulenza: ristoratrice", "ristorazione-turismo", "Un piccolo bar-caffetteria di quartiere può fare da traino, ma serve un orario serale: qui dopo le 20 non è aperto niente."),
    ],
  },
  {
    id: "ambientale", label: "«Un posto che respira»", frase: "Un posto che porta verde, ombra e aria pulita dove ora c'è solo cemento.",
    aree: ["agrifood-ambiente", "energia-sostenibilita"],
    vincolo: { id: "budget", testo: "Il capitolo verde del bilancio comunale è stato ridotto: dei 180.000 € ne restano 141.000." },
    consulenze: [
      consulenza("C_agronomo", "Consulenza: agronoma", "agrifood-ambiente", "Il cortile (300 m²) è coltivabile subito: orti condivisi e alberi abbattono l'isola di calore di +3,8 °C. Serve però qualcuno che li curi tutto l'anno."),
      consulenza("C_energetico", "Consulenza: tecnico energetico", "energia-sostenibilita", "Cappotto + fotovoltaico da 20 kW: 46.000 € che rientrano in 6 anni e tagliano la bolletta da 11.000 a 3.400 €/anno."),
    ],
  },
  {
    id: "creativo", label: "«Un posto dove si fa»", frase: "Un posto per fare cose con le mani e con l'arte: musica, laboratori, creatività.",
    aree: ["musica-spettacolo", "arte-design-moda", "meccanica-meccatronica"],
    vincolo: { id: "acustica", testo: "Insonorizzazione obbligatoria per attività musicali oltre le 20: 29.000 €, oppure orario limitato alle 19." },
    consulenze: [
      consulenza("C_suono", "Consulenza: tecnico del suono", "musica-spettacolo", "Una sala prova insonorizzata serve davvero: senza, le attività musicali serali sono impossibili e i vicini protestano."),
      consulenza("C_artigiana", "Consulenza: artigiana", "arte-design-moda", "Un laboratorio condiviso (sartoria, stampa, riparazioni) può autofinanziarsi in parte con piccoli corsi. La sarta del quartiere è disponibile a insegnare."),
    ],
  },
  {
    id: "comunita", label: "«Un posto di tutti»", frase: "Un posto accessibile e sicuro, che tenga insieme le tante anime del quartiere.",
    aree: ["mobilita-sostenibile", "lingue-relazioni-internazionali"],
    vincolo: { id: "barriere", testo: "Adeguamento accessibilità obbligatorio su tutti e tre gli ingressi + servizi: 34.000 €, non finanziabili altrove." },
    consulenze: [
      consulenza("C_mediatrice", "Consulenza: mediatrice culturale", "lingue-relazioni-internazionali", "La comunità bangladese (~300 persone) partecipa se coinvolta fin dall'inizio, con i suoi due mediatori. Spazi neutri e multilingue, non «per stranieri»."),
      consulenza("C_accessibilita", "Consulenza: tecnica dell'accessibilità", "mobilita-sostenibile", "Scivoli sui tre ingressi, servizi a norma e illuminazione del lato nord: senza, metà quartiere resta di fatto escluso."),
    ],
  },
];

const MD01: MissioneDef = {
  meta: {
    slug: SLUG_QUARTIERE,
    titolo: "Il progetto per il quartiere",
    sottotitolo: "L'ex mercato di Via Sanzio, da rigenerare",
    descrizione:
      "L'ex mercato coperto di Via Sanzio, 900 m², chiuso da undici anni. Il Comune lo assegna per nove anni a chi presenta il progetto migliore: c'è un bando, ci sono 180.000 € e una scadenza. Tu sei nel gruppo che scrive la proposta — la decisione non è solo tua, ma la firma sì. Le tue scelte apriranno e chiuderanno porte: quello che non vorrai sapere ti mancherà quando dovrai decidere. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: [
    "informatica-digitale", "salute-professioni-sanitarie", "ristorazione-turismo", "meccanica-meccatronica",
    "agrifood-ambiente", "arte-design-moda", "musica-spettacolo", "energia-sostenibilita", "edilizia-architettura",
    "economia-management", "giurisprudenza-pa", "mobilita-sostenibile", "scienze-educazione", "comunicazione-media",
    "scienze-ricerca", "sicurezza-difesa", "lingue-relazioni-internazionali", "studi-umanistici-beni-culturali",
  ],
  ruoliStanza: 4,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [Q_M1, Q_M2, Q_M3],
  materialiGettone: [Q_M4, Q_M5, Q_M6, Q_M7, Q_M8, Q_M9, Q_M10, Q_M11, Q_M12, Q_M13, Q_M14],
  mandati: Q_MANDATI,
  prioritaVoci: [
    { id: "ragazzi", label: "I ragazzi non hanno dove stare né dove studiare", aree: ["scienze-educazione", "salute-professioni-sanitarie"] },
    { id: "lavoro", label: "Serve lavoro, servono attività che portino gente", aree: ["economia-management", "ristorazione-turismo"] },
    { id: "verde", label: "Serve verde: qui non si respira", aree: ["agrifood-ambiente", "energia-sostenibilita"] },
    { id: "fare", label: "Serve un posto per fare cose: musica, mani, creatività", aree: ["musica-spettacolo", "arte-design-moda", "meccanica-meccatronica"] },
    { id: "aperto", label: "Serve che questo posto sia sicuro e aperto a tutti", aree: ["mobilita-sostenibile"] },
    { id: "edificio", label: "Serve che l'edificio non cada a pezzi e sia riconoscibile", aree: ["edilizia-architettura", "studi-umanistici-beni-culturali"] },
  ],
  ruoli: [
    { id: "conti", label: "Tenere i conti", area: "economia-management" },
    { id: "scuole", label: "Parlare con le scuole", area: "scienze-educazione" },
    { id: "lavori", label: "Seguire i lavori", area: "edilizia-architettura" },
    { id: "raccontare", label: "Raccontare il progetto fuori", area: "comunicazione-media" },
    { id: "giornate", label: "Far funzionare le giornate", area: "salute-professioni-sanitarie" },
  ],
  passi: [
    { id: "sicurezza", label: "Mettere in sicurezza il tetto" },
    { id: "convenzione", label: "Firmare la convenzione col Comune e sistemare gli adempimenti" },
    { id: "lavori", label: "Avviare i lavori essenziali (impianti, spazi)" },
    { id: "coordinatore", label: "Trovare la persona che coordina le attività" },
    { id: "quartiere", label: "Presentare il progetto al quartiere e ascoltare" },
    { id: "attivita", label: "Far partire le prime attività" },
    { id: "fondi", label: "Cercare fondi e bandi aggiuntivi" },
    { id: "inaugurazione", label: "Organizzare l'inaugurazione" },
  ],
  budget: {
    totale: (m) => (m?.vincolo.id === "budget" ? 141000 : 180000),
    unita: "€",
    passo: 1000,
    voci: (m, letti) => {
      const voci: VoceBudget[] = [
        { id: "tetto", label: "Messa in sicurezza del tetto", aree: ["edilizia-architettura"], costoIndicativo: 55000 },
        { id: "impianti", label: "Impianti e allacci (luce, acqua, riscaldamento)", aree: [], costoIndicativo: 25000 },
        { id: "arredi", label: "Arredi e attrezzature", aree: [], costoIndicativo: 20000 },
      ];
      if (m) {
        const spesaVincolo: Record<string, { label: string; area: string; costo: number } | undefined> = {
          minori: { label: "Spazi certificati per i minori (vincolo del Comune)", area: "edilizia-architettura", costo: 38000 },
          acustica: { label: "Insonorizzazione della sala musica (vincolo del Comune)", area: "musica-spettacolo", costo: 29000 },
          barriere: { label: "Adeguamento accessibilità dei tre ingressi (vincolo del Comune)", area: "mobilita-sostenibile", costo: 34000 },
        };
        const v = spesaVincolo[m.vincolo.id];
        if (v) voci.push({ id: "adeguamento_vincolo", label: v.label, aree: [v.area], costoIndicativo: v.costo });
      }
      voci.push({ id: "comunicazione", label: "Comunicazione e apertura al quartiere", aree: ["comunicazione-media"], costoIndicativo: 12000 });
      voci.push({ id: "orto", label: "Orto e cortile verde", aree: ["agrifood-ambiente"], costoIndicativo: 15000 });
      voci.push({ id: "accessibilita", label: "Segnaletica e accessibilità di base", aree: ["mobilita-sostenibile"], costoIndicativo: 10000 });
      if (letti.has("M7")) voci.push({ id: "fondo_gestione", label: "Fondo per i costi di gestione (dal terzo anno)", aree: ["economia-management"], costoIndicativo: 20000, soloSe: "M7" });
      if (letti.has("M5")) voci.push({ id: "fotovoltaico", label: "Cappotto + fotovoltaico da 20 kW (rientra in 6 anni)", aree: ["energia-sostenibilita"], costoIndicativo: 46000, soloSe: "M5" });
      return voci;
    },
  },
  scarto: (letti) => [
    { id: "facciata_pannelli", label: "Rivestire la facciata con pannelli moderni, per dare un'immagine nuova", aree: ["arte-design-moda"], qualita: 0.05, trappola: true, avviso: letti.has("M6") ? "Dalla perizia della Soprintendenza: facciata e capriate sono tutelate. Un rivestimento farebbe respingere la domanda." : undefined },
    { id: "insegna_effetto", label: "Grande insegna luminosa e arredo urbano d'effetto", aree: ["arte-design-moda"], qualita: 0.4 },
    { id: "spazio_flessibile", label: "Uno spazio interno flessibile, riconfigurabile per usi diversi", aree: ["edilizia-architettura"], qualita: 0.85 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["Mancano nove giorni. Arriva una mail dall'ufficio tecnico del Comune. La aprite in sette, in piedi."];
    if (m) parti.push(`«${m.vincolo.testo}»`);
    parti.push(letti.has("M4") ? "Come sapevate dalla perizia, restano da mettere in sicurezza 340 m². Avendolo previsto, potete procedere per lotti: 55.000 € in due annualità." : "Dalla verifica d'ufficio: 340 m² di copertura risultano inagibili. Messa in sicurezza obbligatoria: 55.000 €.");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Sono le 18:40 e siete in sette intorno a un tavolo, nella sala parrocchiale. Sul tavolo c'è il bando del Comune, scaduto tra ventidue giorni. Fuori, l'ex mercato è chiuso da undici anni: undici anni di serrande abbassate su novecento metri quadri.\n\nAvete una possibilità sola. E prima di scrivere qualsiasi cosa, dovete capire a quale problema state rispondendo — perché il quartiere non ne ha uno, ne ha sei, e non potete risolverli tutti con 180.000 euro.",
    introS2: "Avete undici giorni prima di consegnare. Undici giorni sono cinque approfondimenti, non di più: ogni documento va richiesto, ogni consulente va incontrato, e il tempo è quello che è.\n\nScegliete cosa vale la pena sapere. Quello che non chiedete oggi, non lo saprete quando dovrete decidere.",
    introS4: "Quattro giorni. La proposta va scritta. Sono le vostre parole quelle che leggerà la commissione.",
    introS5: "La proposta è partita. Non saprete l'esito per due mesi. Ma una cosa la sapete già adesso: come avete lavorato.",
    materiali: { titolo: "Prima di tutto: cosa c'è sul tavolo?", prompt: "Apri i documenti che vuoi leggere. Non è obbligatorio aprirli tutti — ma quello che leggi adesso ti aiuta a capire a chi stai rispondendo.", hint: "Ciò che scegli di leggere lascia traccia: dice dove va la tua curiosità." },
    priorita: { titolo: "Il quartiere ha detto sei cose diverse. Da cosa partiresti?", prompt: "Mettile in ordine, dalla più importante. Le prime scelte pesano di più." },
    mandato: { titolo: "Il gruppo vi chiede di scrivere il mandato in una frase. Quale?", prompt: "È la scelta che decide il resto: da qui in poi tutto ruota attorno a questo.", hint: "Non ce n'è una giusta. Scegli quella in cui credi di più." },
    informazioni: { titolo: "Avete 5 gettoni. Su cosa li spendete?", prompt: "Ogni approfondimento costa un gettone e non torna indietro. Aprilo per leggerlo: quello che non apri, non lo saprai quando dovrai decidere.", hint: "Puoi restare nel tuo campo o guardarti intorno: sono due stili diversi, nessuno è migliore." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di NON approfondire: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Distribuite il budget tra le voci", prompt: "Il colpo del tetto ha cambiato i conti. Metti le risorse dove servono davvero: non puoi coprire tutto.", hint: "Dove metti i soldi quando sei alle strette racconta le tue priorità più delle parole." },
    scarto: { titolo: "Tre cose non ci stanno più. Quali due tagliate?", prompt: "Rinuncia a due delle tre. Tieni ciò che per il progetto è davvero essenziale.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Siete in sette. Chi fa cosa nei primi sei mesi?", prompt: "Per ogni compito: te ne occupi tu o lo lascia a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scrivere: quanto reggerà, secondo te?", prompt: "Quanto pensi che la vostra proposta reggerà l'esame della commissione?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete la proposta", prompt: "Cosa diventa l'ex mercato, per chi, e come sta in piedi dal terzo anno? Scrivetelo come lo leggerebbe la commissione.", hint: "Non servono paroloni: concretezza, coerenza col mandato e col vincolo ricevuto.", minCaratteri: 300 },
    riflessione: { titolo: "Ripensando a questi ventidue giorni…", prompt: "Qual è il momento in cui eri più nel tuo? E quello in cui eri più fuori posto?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Se il progetto viene approvato, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "L'ordine conta: da dove è più saggio cominciare?" },
  },
};

// =====================================================================
// MISSIONE 02 — "La crisi della comunicazione" (Mediateca Sanvito)
// =====================================================================

const D_M1: Materiale = { id: "M1", titolo: "Il comunicato originale", aree: [], costo: 0, contenuto: "«A seguito della revisione del piano di sostenibilità del servizio, a decorrere dal 1° settembre l'ala est della Mediateca sarà riconfigurata in postazioni ad accesso riservato mediante prenotazione, con contributo di 4,00 € giornalieri. La restante superficie continuerà a garantire il servizio nelle forme consuete.» — Nessuna menzione di: quanti posti restano liberi, perché serve, chi ha deciso, cosa succede a chi usa la mediateca oggi." };
const D_M2: Materiale = {
  id: "M2", titolo: "Rassegna dei commenti e delle reazioni", aree: [], costo: 0,
  contenuto: "340 commenti in dieci giorni. Le voci sono in contraddizione tra loro: «gli utenti» non sono un blocco solo. Alcune, testuali:",
  estratti: [
    { chi: "Giulia, 17 anni, studentessa", testo: "Studio lì perché a casa siamo in cinque in due stanze. Quattro euro al giorno non li ho." },
    { chi: "Marco Restani, grafico freelance", testo: "Finalmente un posto serio dove lavorare. Fino a ieri era impossibile: c'era gente che parlava al telefono ovunque." },
    { chi: "Prof.ssa Amato, docente", testo: "Ho sempre mandato lì i miei ragazzi. Ora dovrò dire a metà di loro che non possono più andarci?" },
    { chi: "Sig. Nardi, 78 anni", testo: "Io ci vado per leggere i giornali. Nessuno mi ha mai chiesto niente." },
    { chi: "Associazione Passo Nuovo", testo: "La riconfigurazione non prevede alcuna postazione accessibile a sedia a rotelle nell'area gratuita. Chiediamo risposta formale." },
    { chi: "Un dipendente, anonimo", testo: "Noi l'abbiamo saputo dal giornale come tutti gli altri." },
  ],
};
const D_M3: Materiale = { id: "M3", titolo: "Dati di utilizzo (ultimi 12 mesi)", aree: [], costo: 0, contenuto: "71.400 ingressi; 58% under 25; picco 14:00-19:00; 22% degli utenti dichiara di non avere un altro posto dove studiare; 9% è over 70." };
const D_M4: Materiale = { id: "M4", titolo: "Regolamento comunale del servizio bibliotecario", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Art. 7: «Nelle strutture bibliotecarie comunali almeno il 60% della superficie destinata al pubblico deve rimanere ad accesso libero e gratuito.» Nel progetto attuale l'area libera scende al 48%. Confermare la decisione così com'è non è solo impopolare: è illegittimo." };
const D_M5: Materiale = { id: "M5", titolo: "Bilancio della Mediateca", aree: ["economia-management"], costo: 1, contenuto: "Costi annui 412.000 €; trasferimento comunale 340.000 € (era 395.000 tre anni fa); disavanzo 72.000 €. La decisione ha una ragione vera: non è arroganza, è un buco." };
const D_M6: Materiale = { id: "M6", titolo: "Lettera formale dell'Associazione Passo Nuovo", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Protocollata. Richiede risposta scritta entro 15 giorni, oltre i quali «si valuteranno le opportune sedi». Cita la normativa sull'accessibilità dei servizi pubblici." };
const D_M7: Materiale = { id: "M7", titolo: "Affluenza per fascia oraria e tipo di utente", aree: ["scienze-ricerca"], costo: 1, contenuto: "La mattina è semivuota (18% di occupazione), il pomeriggio è satura (94%). Il conflitto è tutto in quattro ore al giorno. Forse non serve dividere lo spazio: forse serve distribuire il tempo." };
const D_M8: Materiale = { id: "M8", titolo: "Relazione del personale", aree: ["scienze-educazione"], costo: 1, contenuto: "23 segnalazioni in un anno di attrito tra gruppi di utenti (rumore, occupazione dei posti, uso dei tavoli). I bibliotecari chiedono da due anni «regole d'uso chiare», mai arrivate. La tensione esisteva prima della decisione." };
const D_M9: Materiale = { id: "M9", titolo: "Il precedente di un'altra città", aree: ["studi-umanistici-beni-culturali"], costo: 1, contenuto: "Una biblioteca fece la stessa scelta: dopo 8 mesi tornò indietro, non per le proteste ma perché le postazioni a pagamento restarono vuote al 70%. Il ricavo previsto non arrivò." };
const D_M10: Materiale = { id: "M10", titolo: "Analisi delle reazioni online", aree: ["comunicazione-media"], costo: 1, contenuto: "340 commenti: 61% negativi, 12% positivi, 27% richieste di chiarimento. Il 44% dei commenti negativi contiene un'informazione sbagliata (molti credono che la mediateca chiuda del tutto). Il picco è stato il giorno 2, ora sta calando." };
const D_M11: Materiale = { id: "M11", titolo: "Verbale del Consiglio di quartiere", aree: ["giurisprudenza-pa", "lingue-relazioni-internazionali"], costo: 1, contenuto: "La decisione fu presentata come «ipotesi di lavoro» in una riunione di aprile con 9 presenti. Nessuno votò. Nessuno la comunicò." };
const D_M12: Materiale = { id: "M12", titolo: "Nota interna dell'assessorato", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "«Si rappresenta che, in assenza di un riscontro pubblico entro cinque giorni, questa amministrazione riterrà opportuno chiarire pubblicamente che la riorganizzazione è iniziativa autonoma della direzione della Mediateca.» Tradotto: il Comune è pronto a scaricarvi." };
const D_M13: Materiale = { id: "M13", titolo: "Linee guida sulla comunicazione dei servizi pubblici", aree: ["comunicazione-media"], costo: 1, contenuto: "Quattro principi con esempi: dire prima cosa cambia per chi legge; non usare parole che nessuno userebbe parlando; ammettere ciò che non si sa ancora; indicare sempre un canale per chiedere." };

const D_MANDATI: Mandato[] = [
  {
    id: "trasparenza", label: "«È un problema di trasparenza»", frase: "La decisione può anche essere giusta, ma è stata presa e comunicata male.",
    aree: ["comunicazione-media", "giurisprudenza-pa"],
    vincolo: { id: "verbale", testo: "Il verbale di aprile risulta incompleto: non è chiaro chi abbia davvero deciso, e la stampa comincia a chiederlo." },
    consulenze: [
      consulenza("D_amministrativo", "Consulenza: il responsabile amministrativo", "giurisprudenza-pa", "La decisione passò come «ipotesi di lavoro» in una riunione di aprile: non c'è un atto formale che la deliberi. Sulla carta, nessuno l'ha decisa."),
      consulenza("D_giornalista", "Consulenza: un giornalista locale", "comunicazione-media", "Il pezzo è uscito perché il comunicato non spiegava niente. Se date i numeri veri e dite chi ha deciso, la storia cambia tono in un giorno."),
    ],
  },
  {
    id: "diritti", label: "«È un problema di diritti»", frase: "Un servizio pubblico sta escludendo qualcuno che non ha alternative.",
    aree: [],
    vincolo: { id: "diffida", testo: "La diffida dell'associazione è protocollata: avete quindici giorni per una risposta formale, non un post." },
    consulenze: [
      consulenza("D_legale", "Consulenza: un legale del Comune", "giurisprudenza-pa", "Il regolamento impone il 60% di superficie libera. Sotto quella soglia la decisione è impugnabile: non è una questione di opinioni, è una norma."),
      consulenza("D_referente", "Consulenza: una referente dell'associazione", "scienze-educazione", "Non chiediamo di bloccare tutto: chiediamo che l'area gratuita resti accessibile davvero, anche a chi ha una carrozzina e a chi non ha quattro euro."),
    ],
  },
  {
    id: "ascolto", label: "«È un problema di ascolto»", frase: "Non è stato chiesto niente a nessuno, prima di decidere.",
    aree: [],
    vincolo: { id: "tempo", testo: "Il sondaggio che vorreste fare richiede tre settimane. La risposta, però, serve giovedì." },
    consulenze: [
      consulenza("D_mediatrice", "Consulenza: una mediatrice", "lingue-relazioni-internazionali", "Le persone accettano quasi tutto se sentono di essere state ascoltate prima. Anche solo un incontro pubblico, fatto sul serio, cambia il clima."),
      consulenza("D_insegnante", "Consulenza: un'insegnante", "scienze-educazione", "Per molti dei miei studenti quella è l'unica sala studio possibile. Se cambia, ditelo a loro per primi, non sui giornali."),
    ],
  },
  {
    id: "identita", label: "«È un problema di identità»", frase: "La Mediateca sta smettendo di essere ciò che è: un luogo di tutti.",
    aree: [],
    vincolo: { id: "articolo", testo: "Esce il pezzo sul quotidiano: «La biblioteca che vende i suoi tavoli»." },
    consulenze: [
      consulenza("D_direttrice", "Consulenza: la direttrice storica", "studi-umanistici-beni-culturali", "Una biblioteca pubblica non è un coworking. Nel momento in cui un posto a sedere ha un prezzo, cambia cosa quel posto significa per la città."),
      consulenza("D_docente", "Consulenza: un docente di beni culturali", "studi-umanistici-beni-culturali", "Il valore di questi luoghi è che chiunque può entrarci senza dover dimostrare nulla. È quello che li distingue da un ufficio."),
    ],
  },
  {
    id: "convivenza", label: "«È un problema di convivenza»", frase: "Il vero attrito è tra utenti diversi che usano lo stesso spazio.",
    aree: [],
    vincolo: { id: "regole", testo: "Terza lite in sala in una settimana. Il personale chiede regole scritte, subito." },
    consulenze: [
      consulenza("D_capo_personale", "Consulenza: il capo del personale", "economia-management", "Chiediamo regole d'uso chiare da due anni: chi può fare cosa, dove si parla e dove no. Senza, ogni giorno è una trattativa tra sconosciuti."),
      consulenza("D_spazi", "Consulenza: un esperto di gestione degli spazi", "edilizia-architettura", "Non serve un muro: serve dividere gli usi. Zone silenziose e zone di lavoro, fasce orarie diverse. Lo spazio c'è, manca la regola."),
    ],
  },
];

const MD02: MissioneDef = {
  meta: {
    slug: SLUG_MEDIATECA,
    titolo: "La crisi della comunicazione",
    sottotitolo: "La Mediateca Sanvito, dopo un comunicato sbagliato",
    descrizione:
      "La Mediateca Sanvito, biblioteca comunale aperta dal 1997, ha annunciato che da settembre metà delle sale diventano postazioni a pagamento. Dieci giorni dopo: 340 commenti, una diffida, un articolo, due liti in sala. Tu entri nel gruppo che deve preparare la risposta — non hai deciso tu. Prima di aprire bocca devi distinguere cosa è un fatto, cosa è un'opinione e cosa è un'accusa da verificare. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["comunicazione-media", "giurisprudenza-pa", "lingue-relazioni-internazionali", "studi-umanistici-beni-culturali", "scienze-educazione", "sicurezza-difesa"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [D_M1, D_M2, D_M3],
  materialiGettone: [D_M4, D_M5, D_M6, D_M7, D_M8, D_M9, D_M10, D_M11, D_M12, D_M13],
  mandati: D_MANDATI,
  prioritaVoci: [
    { id: "regolamento", label: "Il regolamento potrebbe non permettere questa decisione", aree: ["giurisprudenza-pa"] },
    { id: "studenti", label: "Metà di chi studia lì non ha un altro posto dove andare", aree: ["scienze-educazione"] },
    { id: "linguaggio", label: "Il comunicato è scritto in una lingua che nessuno capisce", aree: ["comunicazione-media", "lingue-relazioni-internazionali"] },
    { id: "lettera", label: "C'è una lettera formale che aspetta risposta", aree: ["giurisprudenza-pa"] },
    { id: "attrito", label: "Due gruppi di utenti non riescono a stare nello stesso spazio", aree: ["scienze-educazione"] },
    { id: "identita", label: "Una mediateca pubblica che fa pagare tradisce quello che è", aree: [] },
  ],
  ruoli: [
    { id: "stampa", label: "Parlare con la stampa", area: "comunicazione-media" },
    { id: "comune", label: "Tenere i rapporti con il Comune", area: "giurisprudenza-pa" },
    { id: "studenti", label: "Incontrare gli studenti", area: "scienze-educazione" },
    { id: "testo", label: "Scrivere il testo della risposta", area: "lingue-relazioni-internazionali" },
    { id: "regolamento", label: "Sistemare il regolamento interno", area: "giurisprudenza-pa" },
  ],
  passi: [
    { id: "assoc", label: "Incontrare l'associazione" },
    { id: "regolamento", label: "Riscrivere il regolamento d'uso" },
    { id: "bilancio", label: "Rifare i conti del bilancio" },
    { id: "utenti", label: "Consultare gli utenti" },
    { id: "personale", label: "Formare il personale" },
    { id: "accessibilita", label: "Verificare l'accessibilità" },
    { id: "comunicazione_interna", label: "Sistemare la comunicazione interna" },
    { id: "monitorare", label: "Monitorare le reazioni" },
  ],
  budget: {
    totale: () => 5,
    unita: "giornate",
    passo: 1,
    voci: (m, letti) => {
      const voci: VoceBudget[] = [
        { id: "verificare_fatti", label: "Verificare i fatti prima di parlare", aree: ["comunicazione-media"] },
        { id: "pubblicare_risposta", label: "Scrivere e pubblicare la risposta", aree: ["comunicazione-media"] },
        { id: "incontrare_gruppi", label: "Incontrare i gruppi che protestano", aree: ["scienze-educazione"] },
      ];
      if (letti.has("M6")) voci.push({ id: "rispondere_associazione", label: "Rispondere formalmente all'associazione", aree: ["giurisprudenza-pa"], soloSe: "M6" });
      voci.push({ id: "rivedere_spazi", label: "Rivedere il progetto degli spazi", aree: ["edilizia-architettura"] });
      if (letti.has("M12")) voci.push({ id: "concordare_comune", label: "Concordare la posizione con il Comune", aree: ["giurisprudenza-pa"], soloSe: "M12" });
      voci.push({ id: "scrivere_regole", label: "Scrivere le regole d'uso mancanti", aree: ["giurisprudenza-pa"] });
      voci.push({ id: "informare_personale", label: "Informare il personale prima di tutti gli altri", aree: ["comunicazione-media"] });
      return voci;
    },
  },
  scarto: (letti) => [
    { id: "confermare_spiegare", label: "Confermare la decisione e limitarsi a spiegarla meglio", aree: ["comunicazione-media"], qualita: 0.05, trappola: true, avviso: letti.has("M4") ? "Il regolamento (art. 7, che hai letto) impone almeno il 60% di superficie libera: qui scende al 48%. Confermare così com'è è illegittimo, non solo impopolare." : undefined },
    { id: "non_rispondere", label: "Non rispondere finché non si calma", aree: ["comunicazione-media"], qualita: 0.15 },
    { id: "rimandare", label: "Rimandare tutto a dopo l'estate", aree: ["giurisprudenza-pa"], qualita: 0.2 },
    { id: "rispondere_ognuno", label: "Rispondere a ogni commento uno per uno", aree: ["comunicazione-media"], qualita: 0.35 },
    { id: "ritirare_tutto", label: "Ritirare tutto e tornare indietro", aree: ["studi-umanistici-beni-culturali"], qualita: 0.45 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["È giovedì mattina. Il direttore entra con il telefono in mano."];
    if (m) parti.push(`«${m.vincolo.testo}»`);
    if (!letti.has("M12")) parti.push("E in più, dall'ufficio stampa del Comune: «La riorganizzazione della Mediateca è un'iniziativa autonoma della sua direzione.» Vi hanno appena scaricati, in pubblico.");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Siete in cinque, in una stanza sul retro della Mediateca. Sul tavolo: la stampa del comunicato, un raccoglitore di commenti, e una lettera con il timbro di protocollo.\n\nIl direttore vi ha detto una frase sola: «Aiutatemi a capire cosa ho combinato». Prima di scrivere qualunque risposta, dovete decidere di che problema si tratta — perché sembra uno solo e invece ne sono cinque, e a seconda di quale scegliete cambia tutto il resto.",
    introS2: "Avete tre giorni. Tre giorni sono cinque approfondimenti: un documento richiesto, una persona incontrata, un dato tirato fuori dall'archivio. Non di più.\n\nQuello che non chiedete adesso, non lo saprete quando dovrete scrivere.",
    introS4: "Il testo esce lunedì alle 9. Lo leggeranno Giulia, il signor Nardi, la professoressa Amato, il grafico, l'associazione, i giornalisti e i vostri colleghi. Tutti insieme, tutti lo stesso testo.",
    introS5: "Il testo è uscito. Non saprete subito se ha funzionato. Ma una cosa la sapete già adesso: come avete lavorato in questi tre giorni.",
    materiali: { titolo: "Prima di tutto: cosa è successo davvero?", prompt: "Apri i documenti che vuoi leggere. Sul tavolo ci sono un comunicato, i commenti della gente e i numeri di chi usa la mediateca.", hint: "Ciò che scegli di leggere lascia traccia: dice dove va la tua curiosità." },
    priorita: { titolo: "Nel materiale ci sono cose diverse mescolate. Da cosa parti?", prompt: "Mettile in ordine, dalla più importante. Le prime scelte pesano di più." },
    mandato: { titolo: "Scrivete in una frase di cosa parlerete. Quale?", prompt: "Sembra un problema solo e invece ne sono cinque: la frase che scegliete decide cosa andrete a cercare e come risponderete.", hint: "Non ce n'è una giusta. Scegli la lettura in cui credi di più." },
    informazioni: { titolo: "Avete 5 gettoni. Su cosa li spendete?", prompt: "Ogni approfondimento costa un gettone e non torna indietro. Aprilo per leggerlo: quello che non apri, non lo saprai quando dovrai scrivere.", hint: "Puoi restare nel tuo campo o guardarti intorno: sono due stili diversi, nessuno è migliore." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di NON approfondire: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Avete cinque giornate-persona prima di lunedì. Come le spendete?", prompt: "Distribuite le giornate tra le cose da fare. Non potete farle tutte: scegliete dove concentrarvi.", hint: "Dove metti il tempo quando è poco racconta le tue priorità più delle parole." },
    scarto: { titolo: "Tre strade non stanno in piedi. Tagliatene due.", prompt: "Rinuncia a due delle strade sul tavolo. Tieni quelle che reggono davvero.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Siete in cinque. Chi fa cosa?", prompt: "Per ogni compito: te ne occupi tu o lo lascia a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scriverla: quanto reggerà, secondo te?", prompt: "Quanto pensate che questa risposta reggerà, davanti a tutti quelli che la leggeranno?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete la risposta pubblica", prompt: "Deve dire cosa cambia davvero, per chi, e cosa succede adesso. La leggeranno tutti insieme: studenti, anziani, associazione, giornalisti, colleghi.", hint: "Di' prima cosa cambia per chi legge. Ammetti quello che è andato storto. Niente linguaggio da ufficio.", minCaratteri: 250 },
    riflessione: { titolo: "In questi tre giorni…", prompt: "Qual è il momento in cui vi siete sentiti più nel vostro? E quello in cui avreste voluto che decidesse qualcun altro?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Se lunedì la risposta esce così, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "L'ordine conta: da dove è più urgente cominciare?" },
  },
};

// =====================================================================
// MISSIONE 03 — "Il prototipo che non funziona" (la serra della 4ªB)
// =====================================================================

const S_M1: Materiale = { id: "M1", titolo: "Scheda del prototipo", aree: [], costo: 0, contenuto: "4 sezioni da 1,2 m²; 1 pompa 12V; 4 valvole elettriche; 4 sensori di umidità; pannello solare 60W con batteria; controllo via microcontrollore; app di monitoraggio. Costruita in 6 settimane da 7 studenti." };
const S_M2: Materiale = { id: "M2", titolo: "Registro delle prove (estratto di 5 giorni)", aree: [], costo: 0, contenuto: "Per ogni sezione e ogni giorno: «irrigazione: eseguita», umidità rilevata, foto. La sezione B risulta SEMPRE irrigata. L'umidità rilevata in B è stabile intorno al 41% — un valore che non scende mai, nemmeno di notte. (Un valore che non oscilla mai non è un valore reale.)" };
const S_M3: Materiale = {
  id: "M3", titolo: "Le tre osservazioni dei compagni", aree: [], costo: 0,
  contenuto: "Tre compagni, tre spiegazioni diverse — e in contraddizione tra loro:",
  estratti: [
    { chi: "Sara", testo: "Io la B l'ho vista bagnata. Sono sicura, l'ho toccata martedì mattina." },
    { chi: "Yassin", testo: "Secondo me è il codice. L'abbiamo scritto di corsa l'ultima settimana e non l'ha più riletto nessuno." },
    { chi: "Elena", testo: "Ma quella sezione prende sole da mezzogiorno alle sei. Le altre no. Forse non c'è nessun guasto: è solo che lì serve più acqua." },
  ],
};
const S_M4: Materiale = { id: "M4", titolo: "Log dettagliato dei comandi con orario", aree: ["informatica-digitale", "scienze-ricerca"], costo: 1, contenuto: "Ogni riga registra «comando inviato», ora, sezione. Non esiste alcuna riga che registri l'acqua effettivamente erogata: il sistema scrive «eseguita» nell'istante in cui manda il segnale." };
const S_M5: Materiale = { id: "M5", titolo: "Curva di produzione del pannello solare", aree: ["energia-sostenibilita"], costo: 1, contenuto: "Grafico su 24 ore: la produzione cala del 40% tra le 13:00 e le 16:00, per l'ombra del muro della palestra. Le irrigazioni sono programmate alle 14:00." };
const S_M6: Materiale = { id: "M6", titolo: "Manuale della pompa e delle valvole", aree: ["meccanica-meccatronica"], costo: 1, contenuto: "La valvola si apre solo sopra 0,8 bar. Sotto quella soglia non si apre affatto: non si apre poco, non si apre. Allungare la durata dell'irrigazione non serve a niente se la valvola non apre." };
const S_M7: Materiale = { id: "M7", titolo: "Scheda di taratura dei sensori", aree: ["scienze-ricerca"], costo: 1, contenuto: "Quattro sensori, data ultima calibrazione: mai effettuata per nessuno. Il sensore B è stato montato con un cavo di ricambio diverso dagli altri." };
const S_M8: Materiale = { id: "M8", titolo: "Mappa dell'esposizione solare", aree: ["agrifood-ambiente", "edilizia-architettura"], costo: 1, contenuto: "Conferma Elena: la sezione B prende 6 ore di sole diretto contro le 2-3 delle altre. Il fabbisogno idrico stimato è quasi doppio. Non è la causa del guasto, ma è una causa concorrente vera: anche risolto il guasto, la B avrà bisogno di più acqua." };
const S_M9: Materiale = { id: "M9", titolo: "Foto delle piante giorno per giorno", aree: ["agrifood-ambiente"], costo: 1, contenuto: "21 giorni. Il deterioramento non è graduale: le prime due settimane la B sta bene, poi crolla. Qualcosa è cambiato intorno al 15° giorno — l'ombra della palestra si allunga con la stagione." };
const S_M10: Materiale = { id: "M10", titolo: "Diario di montaggio", aree: ["meccanica-meccatronica"], costo: 1, contenuto: "Chi ha fatto cosa. Riga del 9° giorno: «valvola B montata più in alto delle altre perché il tubo non arrivava, useremo una prolunga». Dislivello: circa 40 cm." };
const S_M11: Materiale = { id: "M11", titolo: "Prova di un compagno che non riproduce il guasto", aree: ["scienze-ricerca"], costo: 1, contenuto: "Yassin ha rifatto la prova di mattina e la sezione B si è irrigata perfettamente. Conclusione sua: «non c'è nessun guasto». Ma «funziona la mattina e non il pomeriggio» è un'informazione enorme, se si capisce cosa significa." };
const S_M12: Materiale = { id: "M12", titolo: "Lettura del contatore dell'acqua", aree: ["scienze-ricerca", "energia-sostenibilita"], costo: 1, contenuto: "Consumo reale misurato nell'ultima settimana: 31 litri. Somma delle irrigazioni dichiarate dal sistema: 96 litri. Manca un terzo abbondante: i dati del sistema non corrispondono alla realtà." };
const S_M13: Materiale = { id: "M13", titolo: "Il codice dell'irrigazione (12 righe commentate)", aree: ["informatica-digitale"], costo: 1, contenuto: "Leggibile anche da chi non programma, con i commenti in italiano. Si vede che dopo apriValvola(sezione) viene subito scritto registraIrrigazione(sezione, «eseguita»), senza alcun controllo che l'acqua sia davvero uscita." };

const S_MANDATI: Mandato[] = [
  {
    id: "sensori", label: "«Non ci fidiamo di quello che misuriamo»", frase: "Il sospetto è che i sensori stiano mentendo.",
    aree: ["scienze-ricerca", "informatica-digitale"],
    vincolo: { id: "kit", testo: "Il kit di taratura è in prestito e torna solo dopodomani: se volete misurare i sensori sul serio, è adesso o mai." },
    consulenze: [
      consulenza("S_prof_lab", "Consulenza: il prof di laboratorio", "scienze-ricerca", "Un sensore non calibrato non mente per forza: dà un numero che nessuno ha mai verificato. Prima di crederci, confrontalo con una misura fatta a mano."),
      consulenza("S_tecnico", "Consulenza: un tecnico", "informatica-digitale", "Un valore che resta identico giorno e notte non è una lettura: è un sensore fermo, o un dato scritto da qualche parte e mai aggiornato."),
    ],
  },
  {
    id: "idraulica", label: "«L'acqua non arriva»", frase: "Il sospetto è che sia un problema idraulico: l'acqua non raggiunge la B.",
    aree: ["meccanica-meccatronica", "energia-sostenibilita"],
    vincolo: { id: "ricambi", testo: "Il negozio di ricambi è chiuso fino a lunedì: qualsiasi pezzo idraulico dovete farvelo bastare com'è." },
    consulenze: [
      consulenza("S_idraulico", "Consulenza: l'idraulico della scuola", "meccanica-meccatronica", "Se una valvola sta più in alto delle altre, le serve più pressione per aprirsi. Con una pompa piccola, quella è la prima che resta chiusa."),
      consulenza("S_manutentore", "Consulenza: un tecnico manutentore", "energia-sostenibilita", "Una pompa da 12V spinge quanto le arriva di corrente. Se la corrente cala, la pressione cala: e certe valvole, sotto soglia, semplicemente non aprono."),
    ],
  },
  {
    id: "software", label: "«Il sistema si racconta una bugia»", frase: "Il sospetto è che il software creda a sé stesso: scrive «fatto» senza controllare.",
    aree: ["informatica-digitale", "scienze-ricerca"],
    vincolo: { id: "assente", testo: "Chi ha scritto il codice è assente tutta la settimana: dovete capirlo da soli, leggendolo." },
    consulenze: [
      consulenza("S_autore", "Consulenza: chi ha scritto il codice", "informatica-digitale", "L'ho scritto di corsa: mando il comando alla valvola e segno subito «eseguito». Non controllo se l'acqua è uscita davvero. Non ci avevo pensato."),
      consulenza("S_sviluppatrice", "Consulenza: una sviluppatrice", "scienze-ricerca", "Un sistema che registra l'intenzione al posto del risultato ti mente in buona fede. Devi misurare l'effetto, non fidarti del comando."),
    ],
  },
  {
    id: "progetto", label: "«Abbiamo progettato male»", frase: "Il sospetto è che il difetto sia nel disegno, non in un guasto.",
    aree: ["arte-design-moda", "meccanica-meccatronica"],
    vincolo: { id: "fissata", testo: "La serra è fissata al suolo: non si sposta e non si smonta. Dovete lavorare su quello che c'è." },
    consulenze: [
      consulenza("S_prof_tecnologia", "Consulenza: la prof di tecnologia", "meccanica-meccatronica", "Un buon progetto prevede che le cose possano andare storte. Se una valvola può restare chiusa senza che nessuno se ne accorga, il disegno ha un buco."),
      consulenza("S_progettista", "Consulenza: un progettista", "arte-design-moda", "Le quattro sezioni non sono uguali: sole, altezza, esposizione diversi. Trattarle come identiche è la scelta di progetto che ha creato il problema."),
    ],
  },
  {
    id: "energia", label: "«Manca corrente quando serve»", frase: "Il sospetto è che sia un problema di energia: la potenza cala nell'ora sbagliata.",
    aree: ["energia-sostenibilita", "meccanica-meccatronica"],
    vincolo: { id: "rete", testo: "Non potete collegarvi alla rete elettrica: il regolamento della scuola non lo permette. Solo pannello e batteria." },
    consulenze: [
      consulenza("S_fotovoltaico", "Consulenza: un tecnico fotovoltaico", "energia-sostenibilita", "Un pannello all'ombra nel pomeriggio produce molto meno. Se un'operazione che consuma è programmata proprio in quelle ore, è lì che si rompe tutto."),
      consulenza("S_custode", "Consulenza: il custode", "meccanica-meccatronica", "Il muro della palestra fa ombra sul pannello dal primo pomeriggio. Lo vedo tutti i giorni: verso le due, quell'angolo è già in ombra."),
    ],
  },
];

const MD03: MissioneDef = {
  meta: {
    slug: SLUG_SERRA,
    titolo: "Il prototipo che non funziona",
    sottotitolo: "La serra automatica della 4ªB, due giorni prima dell'open day",
    descrizione:
      "Una serra automatica costruita dagli studenti: quattro sezioni, sensori, una pompa, un'app. Funziona da tre settimane, ma le piante della sezione B stanno seccando — mentre l'app dice che la B è stata innaffiata regolarmente, tutti i giorni. Fra due giorni c'è l'open day. Tu entri nel gruppo che deve capire cosa succede: non riparare, capire. Non serve sapere niente di tecnica: bastano osservazione, logica e metodo. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["informatica-digitale", "meccanica-meccatronica", "scienze-ricerca", "energia-sostenibilita", "arte-design-moda", "agrifood-ambiente"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [S_M1, S_M2, S_M3],
  materialiGettone: [S_M4, S_M5, S_M6, S_M7, S_M8, S_M9, S_M10, S_M11, S_M12, S_M13],
  mandati: S_MANDATI,
  prioritaVoci: [
    { id: "gialle", label: "Le piante della B sono gialle", aree: ["agrifood-ambiente"], affidabilita: 0.85 },
    { id: "contatore", label: "Il contatore dell'acqua segna un numero", aree: ["scienze-ricerca"], affidabilita: 0.95 },
    { id: "app_dice", label: "L'app dice che la B è stata irrigata", aree: ["informatica-digitale"], affidabilita: 0.15 },
    { id: "sara", label: "Sara ha visto la B bagnata martedì", aree: ["scienze-ricerca"], affidabilita: 0.4 },
    { id: "codice", label: "Il codice è stato scritto di corsa", aree: ["informatica-digitale"], affidabilita: 0.3 },
    { id: "sole", label: "La B prende più sole delle altre", aree: ["energia-sostenibilita", "agrifood-ambiente"], affidabilita: 0.6 },
  ],
  ruoli: [
    { id: "misurare", label: "Misurare", area: "scienze-ricerca" },
    { id: "smontare", label: "Smontare e rimontare", area: "meccanica-meccatronica" },
    { id: "codice", label: "Leggere il codice", area: "informatica-digitale" },
    { id: "registro", label: "Tenere il registro di quello che provate", area: "scienze-ricerca" },
    { id: "spiegare", label: "Spiegare al pubblico dell'open day", area: "comunicazione-media" },
  ],
  passi: [
    { id: "tarare", label: "Tarare tutti i sensori" },
    { id: "flusso", label: "Far registrare l'irrigazione solo a flusso confermato" },
    { id: "valvola", label: "Riposizionare la valvola B" },
    { id: "fabbisogno", label: "Misurare il fabbisogno reale di ogni sezione" },
    { id: "orari", label: "Spostare gli orari secondo la curva solare" },
    { id: "collaudo", label: "Scrivere una procedura di collaudo" },
    { id: "allarme", label: "Aggiungere un allarme di scostamento" },
    { id: "montaggio", label: "Documentare il montaggio" },
  ],
  budget: {
    totale: () => 6,
    unita: "ore",
    passo: 1,
    voci: (m, letti) => {
      const voci: VoceBudget[] = [
        { id: "tarare_sensori", label: "Rifare la taratura dei sensori", aree: ["scienze-ricerca"] },
        { id: "controllare_valvola", label: "Smontare e controllare la valvola B", aree: ["meccanica-meccatronica"] },
        { id: "leggere_codice", label: "Leggere il codice riga per riga", aree: ["informatica-digitale"] },
        { id: "ripetere_prova", label: "Ripetere la prova a orari diversi", aree: ["scienze-ricerca"] },
        { id: "misurare_acqua", label: "Misurare l'acqua che esce davvero", aree: ["scienze-ricerca"] },
      ];
      if (letti.has("M5")) voci.push({ id: "spostare_orario", label: "Spostare l'orario dell'irrigazione al mattino", aree: ["energia-sostenibilita"], soloSe: "M5" });
      if (letti.has("M4") && letti.has("M13")) voci.push({ id: "correggere_registrazione", label: "Correggere la registrazione a flusso confermato", aree: ["informatica-digitale"], soloSe: "M4+M13" });
      voci.push({ id: "preparare_spiegazione", label: "Preparare la spiegazione per l'open day", aree: ["comunicazione-media"] });
      return voci;
    },
  },
  scarto: (letti) => [
    { id: "raddoppiare", label: "Raddoppiare la durata dell'irrigazione della sezione B", aree: ["meccanica-meccatronica"], qualita: 0.05, trappola: true, avviso: letti.has("M6") ? "Il manuale della pompa (che hai letto): sotto 0,8 bar la valvola non si apre affatto. Raddoppiare zero fa zero." : undefined },
    { id: "dire_apposto", label: "Dire all'open day che è tutto a posto", aree: ["comunicazione-media"], qualita: 0.1 },
    { id: "spostare_piante", label: "Spostare le piante della B in un'altra sezione", aree: ["agrifood-ambiente"], qualita: 0.2 },
    { id: "rifare_codice", label: "Rifare il codice da capo", aree: ["informatica-digitale"], qualita: 0.3 },
    { id: "sostituire_sensore", label: "Sostituire il sensore B", aree: ["scienze-ricerca"], qualita: 0.4 },
    { id: "innaffiare_mano", label: "Innaffiare la B a mano fino a dopo l'open day", aree: ["agrifood-ambiente"], qualita: 0.55 },
  ],
  introStanza3: (m, letti) => {
    const parti = [
      "Martedì, ricreazione. Yassin vi raggiunge di corsa con il telefono in mano.\n\n«Ragazzi, ho rifatto la prova stamattina. La sezione B si è irrigata benissimo. Non c'è nessun guasto.»\n\nUn dato vero che sembra chiudere il caso. Ma «funziona la mattina e non il pomeriggio» non è l'assenza di un guasto: è la sua descrizione più precisa.",
    ];
    if (m) parti.push(`Intanto, il vostro vincolo resta: ${m.vincolo.testo}`);
    if (!letti.has("M12")) parti.push("E il custode vi ferma: «Il contatore segna un terzo dell'acqua che il vostro sistema dice di aver usato. Avete una perdita?»");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Sono le 8:10 di lunedì. Siete davanti alla serra con i giubbotti ancora addosso. Le piante della sezione B sono gialle e piegate; quelle delle altre tre stanno benissimo.\n\nYassin apre l'app sul telefono e ve la gira: sezione B, irrigazione eseguita, tutti i giorni, spunta verde. Qualcosa qui non torna. E fra due giorni c'è l'open day.",
    introS2: "Avete un pomeriggio. Un pomeriggio sono cinque cose: cinque documenti da tirare fuori, cinque misure da prendere, cinque persone da fermare nel corridoio.\n\nScegliete bene: quello che non misurate oggi, domani non lo saprete.",
    introS4: "Mercoledì, 8:30. Fra un'ora entrano le famiglie. Davanti alla serra c'è un cartello bianco: quello che ci scrivete sopra è la vostra spiegazione.",
    introS5: "L'open day è passato. La serra è ancora lì, e adesso sapete qualcosa in più — non solo sulle piante, ma su come si insegue una cosa che non torna.",
    materiali: { titolo: "Prima di tutto: cosa vedete?", prompt: "Apri i documenti che vuoi leggere. C'è la scheda del prototipo, il registro delle prove e quello che dicono i tuoi compagni.", hint: "Ciò che scegli di leggere lascia traccia. E a volte il dato che conta è quello che sembra più noioso." },
    priorita: { titolo: "Alcune di queste cose sono fatti misurati, altre sono quello che qualcuno crede. Ordinale.", prompt: "Da «più affidabile» a «meno affidabile». Attenzione: «l'app dice» non è un fatto, è un'affermazione da verificare.", hint: "Un fatto misurato vale più di un'impressione, e un'impressione più di ciò che un sistema dice di sé." },
    mandato: { titolo: "Da dove partite? Scrivetelo in una frase.", prompt: "La frase che scegliete deciderà cosa andrete a controllare. Nessuna è quella «giusta»: ognuna porta a una spiegazione parziale ma difendibile.", hint: "Non serve avere ragione subito: serve sapere cosa misurare per scoprirlo." },
    informazioni: { titolo: "Avete 5 gettoni. Cosa andate a misurare?", prompt: "Ogni approfondimento costa un gettone e non torna indietro. Aprilo per leggerlo: quello che non misuri oggi, domani non lo saprai.", hint: "Puoi restare dentro la tua ipotesi o guardarti intorno: sono due stili diversi, nessuno è migliore." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di non controllare: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Restano sei ore prima dell'open day. Come le spendete?", prompt: "Distribuite le ore tra le cose da fare. Non potete farle tutte: scegliete cosa misurare e cosa preparare.", hint: "Dove metti il tempo quando è poco racconta il tuo metodo più delle parole." },
    scarto: { titolo: "Tre strade non reggono. Tagliatene due.", prompt: "Rinuncia a due delle strade sul tavolo. Tieni quelle che hanno senso.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Siete in sette. Nelle prossime sei ore, chi fa cosa?", prompt: "Per ogni compito: te ne occupi tu o lo lascia a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scriverla: quanto siete sicuri di aver capito?", prompt: "Quanto siete sicuri di aver capito cosa succede davvero alla sezione B?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete la spiegazione per l'open day", prompt: "Tre cose: cosa succede, come l'avete verificato, cosa farete dopo. Lo leggeranno le famiglie davanti alla serra.", hint: "Se non avete ancora le prove, scrivetelo. «Non ne siamo ancora certi» è una risposta onesta, non un fallimento.", minCaratteri: 250 },
    riflessione: { titolo: "Ripensando a questi due giorni…", prompt: "Quando avete capito che l'app poteva dire una cosa falsa, cosa avete pensato? E c'è stato un momento in cui eravate sicuri di qualcosa che poi si è rivelato sbagliato?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Dopo l'open day, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "L'ordine conta: da dove è più saggio cominciare?" },
  },
};

// =====================================================================
// MISSIONE 04 — "Il cantiere della scuola" (la palestra dell'Istituto Fermi)
// =====================================================================

const K_M1: Materiale = { id: "M1", titolo: "Verbale del sopralluogo tecnico (marzo)", aree: [], costo: 0, contenuto: "900 m² di palestra + spogliatoi. Rilevati: controsoffitto ammalorato su tutta la superficie (caduta parziale); impianto elettrico del 1988, non a norma; infiltrazioni dalla copertura in tre punti; caldaia a gasolio del 2003, funzionante ma fuori norma sulle emissioni; pavimentazione sportiva usurata; nessun accesso per sedie a rotelle agli spogliatoi." };
const K_M2: Materiale = {
  id: "M2", titolo: "L'assemblea di giugno", aree: [], costo: 0,
  contenuto: "In cinque, un'ora di discussione. Le voci non vanno d'accordo: ognuno guarda il problema da dove ci vive. Alcune, testuali:",
  estratti: [
    { chi: "Prof. Baldini, educazione fisica", testo: "A me serve il campo. Se a settembre non ho un pavimento su cui far giocare i ragazzi, il resto non è servito a niente." },
    { chi: "Sig.ra Ferro, RSPP", testo: "Il pavimento è un problema di comodità. Il controsoffitto è un problema di teste. Non sono la stessa cosa e non si discutono insieme." },
    { chi: "Marta, rappresentante d'istituto", testo: "Noi in palestra ci passiamo due ore a settimana. Negli spogliatoi venti minuti ogni volta, e sono uno schifo." },
    { chi: "Il tecnico del Comune", testo: "Se sforate il 5 settembre, i soldi tornano indietro. Non è una minaccia, è il regolamento del finanziamento." },
    { chi: "Il custode, sig. Rota", testo: "Io ci sto dentro tutti i giorni. Quando piove forte, l'acqua entra dall'angolo nord. Sempre lo stesso. L'ho detto tre volte." },
    { chi: "Un genitore", testo: "Mio figlio è in carrozzina. Alle medie non è mai potuto entrare nello spogliatoio con gli altri. Speravo cambiasse." },
  ],
};
const K_M3: Materiale = { id: "M3", titolo: "Il quadro economico", aree: [], costo: 0, contenuto: "240.000 € totali. Vincoli del finanziamento: lavori conclusi e collaudati entro il 5 settembre; nessuna proroga; le economie non spese non restano alla scuola." };
const K_M4: Materiale = { id: "M4", titolo: "Relazione sull'impianto elettrico", aree: ["informatica-digitale", "meccanica-meccatronica", "edilizia-architettura"], costo: 1, contenuto: "Quadro del 1988, nessun differenziale sulle linee della palestra, cavi in canaline non ignifughe. NON certificabile: senza rifacimento il collaudo finale non passa e la palestra non riapre, comunque siano andati gli altri lavori. Costo 62.000 €, 25 giorni. Va fatto PRIMA del controsoffitto, perché i cavi passano lì sopra." };
const K_M5: Materiale = { id: "M5", titolo: "Perizia sulla copertura", aree: ["edilizia-architettura"], costo: 1, contenuto: "Le infiltrazioni vengono da 40 m² di guaina degenerata sull'angolo nord (conferma il custode). Rifacimento 34.000 €, 15 giorni. Se non si fa PRIMA del controsoffitto nuovo, l'acqua rovinerà il controsoffitto nuovo entro il primo inverno." };
const K_M6: Materiale = { id: "M6", titolo: "Preventivo del controsoffitto", aree: ["edilizia-architettura"], costo: 1, contenuto: "Smontaggio del vecchio e nuovo in fibra minerale antisfondamento: 71.000 €, 20 giorni. È il lavoro che ha causato la chiusura. Senza, la palestra resta chiusa." };
const K_M7: Materiale = { id: "M7", titolo: "Diagnosi energetica", aree: ["energia-sostenibilita"], costo: 1, contenuto: "Caldaia a gasolio del 2003: 19.000 €/anno di riscaldamento. Sostituzione con pompa di calore: 48.000 €, 18 giorni, spesa a regime 7.400 €/anno. NON è obbligatoria per il collaudo. Rientro in circa 6 anni." };
const K_M8: Materiale = { id: "M8", titolo: "Preventivo della pavimentazione sportiva", aree: ["edilizia-architettura", "meccanica-meccatronica"], costo: 1, contenuto: "Parquet sportivo omologato 39.000 €, 12 giorni; alternativa in PVC sportivo 21.000 €, 6 giorni, durata inferiore. Va posato per ULTIMO, dopo tutti i lavori in quota, altrimenti si rovina." };
const K_M9: Materiale = { id: "M9", titolo: "Dossier accessibilità degli spogliatoi", aree: ["mobilita-sostenibile", "edilizia-architettura"], costo: 1, contenuto: "Gradino di 18 cm all'ingresso spogliatoi, porte da 70 cm, nessun servizio attrezzato. Adeguamento 27.000 €, 14 giorni. Nell'istituto ci sono quattro studenti con disabilità motoria. Obbligo normativo in caso di ristrutturazione significativa: il collaudo può rilevarlo." };
const K_M10: Materiale = { id: "M10", titolo: "Cronoprogramma della ditta", aree: ["meccanica-meccatronica", "edilizia-architettura"], costo: 1, contenuto: "Cinque operai, una sola squadra: i lavori vanno in fila, non in parallelo, salvo che spogliatoi e palestra si possono fare in contemporanea con due squadre (la seconda costa +18.000 €). Giorni disponibili: 83." };
const K_M11: Materiale = { id: "M11", titolo: "Regolamento del finanziamento comunale", aree: ["edilizia-architettura", "giurisprudenza-pa"], costo: 1, contenuto: "Art. 4: collaudo entro il 5 settembre, pena revoca. Art. 9: le varianti in corso d'opera superiori al 10% richiedono una nuova approvazione, con 20 giorni di istruttoria. Tradotto: cambiare idea a metà cantiere costa venti giorni che non hai." };
const K_M12: Materiale = { id: "M12", titolo: "Storico delle manutenzioni", aree: ["edilizia-architettura"], costo: 1, contenuto: "2009: rifacimento parziale della guaina, «da completare l'anno successivo». Mai completato. 2015: preventivo per l'elettrico, mai approvato. 2019: segnalazione infiltrazioni dal custode, archiviata. Il crollo non è stato un incidente, è stato un calendario." };
const K_M13: Materiale = { id: "M13", titolo: "Nota della ditta sui tempi di consegna", aree: ["meccanica-meccatronica"], costo: 1, contenuto: "I pannelli antisfondamento del controsoffitto hanno 35 giorni di consegna dall'ordine. Se l'ordine non parte entro la prima settimana, il lavoro slitta a fine agosto e trascina tutto il resto." };

const K_MANDATI: Mandato[] = [
  {
    id: "sicurezza", label: "«Prima che nessuno si faccia male»", frase: "La sicurezza viene prima di tutto il resto.",
    aree: ["edilizia-architettura"],
    vincolo: { id: "ispezione", testo: "Verifica ispettiva a sorpresa a metà cantiere: se trovano difformità, sospensione di 10 giorni." },
    consulenze: [
      consulenza("K_rspp", "Consulenza: l'RSPP", "edilizia-architettura", "Il controsoffitto è un problema di teste, non di comodità. Finché non è a norma, per me la palestra non riapre — e lo metto per iscritto."),
      consulenza("K_ispettore", "Consulenza: un ispettore", "edilizia-architettura", "Un cantiere in ordine si vede da come sono documentati i lavori. Se la sequenza non è tracciata, alla verifica saltano fuori le difformità."),
    ],
  },
  {
    id: "acqua", label: "«Prima che l'acqua entri di nuovo»", frase: "È inutile rifare, se poi si rovina.",
    aree: ["edilizia-architettura", "energia-sostenibilita"],
    vincolo: { id: "pioggia", testo: "Due settimane di pioggia a fine giugno: nove giorni di lavori in quota persi." },
    consulenze: [
      consulenza("K_coperture", "Consulenza: un tecnico delle coperture", "edilizia-architettura", "La guaina va sull'angolo nord, sono 40 m². Ma se ci mettete sopra il controsoffitto nuovo prima di averla rifatta, la prossima pioggia ve lo rovina."),
      consulenza("K_custode", "Consulenza: il custode", "edilizia-architettura", "Ve lo dico da nove anni: l'acqua entra sempre dallo stesso angolo. Non è un mistero, è che nessuno l'ha mai rifatto."),
    ],
  },
  {
    id: "elettrico", label: "«Prima che si riaccenda la luce»", frase: "Senza impianto non si collauda niente.",
    aree: ["informatica-digitale", "meccanica-meccatronica"],
    vincolo: { id: "quadro", testo: "Il quadro elettrico ordinato arriva difettoso: dodici giorni per la sostituzione." },
    consulenze: [
      consulenza("K_impiantista", "Consulenza: un impiantista", "informatica-digitale", "L'impianto è del 1988, senza differenziali. Il rifacimento va fatto prima del controsoffitto: i cavi passano lì sopra, dopo non ci arrivate più."),
      consulenza("K_collaudatore", "Consulenza: il collaudatore", "meccanica-meccatronica", "Al collaudo guardo prima l'elettrico. Se non è certificabile, tutto il resto non conta: la palestra non la faccio riaprire."),
    ],
  },
  {
    id: "gioco", label: "«Prima che ci si possa giocare»", frase: "È una palestra: deve funzionare da palestra.",
    aree: ["meccanica-meccatronica", "edilizia-architettura"],
    vincolo: { id: "parquet", testo: "Il parquet omologato non è disponibile prima di settembre: o si mette il PVC, o si aspetta." },
    consulenze: [
      consulenza("K_baldini", "Consulenza: il prof di educazione fisica", "edilizia-architettura", "A me serve un pavimento su cui i ragazzi possano giocare a settembre. Non m'importa se è parquet o PVC: m'importa che ci sia."),
      consulenza("K_posatore", "Consulenza: un posatore", "meccanica-meccatronica", "Il pavimento si posa per ultimo, dopo tutti i lavori in quota. Se lo mettete prima, tra polvere e cadute dall'alto lo buttate via."),
    ],
  },
  {
    id: "accessibilita", label: "«Prima che ci possano entrare tutti»", frase: "Una palestra da cui qualcuno è escluso non è finita.",
    aree: ["mobilita-sostenibile"],
    vincolo: { id: "idrico", testo: "L'adeguamento rivela che serve rifare anche l'impianto idrico degli spogliatoi: +19.000 €." },
    consulenze: [
      consulenza("K_accessibilita", "Consulenza: un tecnico dell'accessibilità", "mobilita-sostenibile", "Gradino di 18 cm, porte da 70: oggi quattro studenti non entrano. In una ristrutturazione significativa l'adeguamento è un obbligo, e il collaudo può rilevarlo."),
      consulenza("K_genitore", "Consulenza: un genitore", "", "Mio figlio in tre anni di medie non è mai entrato in uno spogliatoio con i suoi compagni. Non chiedo un favore, chiedo che sia finita per tutti."),
    ],
  },
];

const MD04: MissioneDef = {
  meta: {
    slug: SLUG_CANTIERE,
    titolo: "Il cantiere della scuola",
    sottotitolo: "La palestra dell'Istituto Fermi, ottantatré giorni per riaprirla",
    descrizione:
      "La palestra dell'Istituto Fermi è chiusa da marzo, da quando un pezzo di controsoffitto è caduto di notte. Il Comune ha stanziato 240.000 € e una finestra sola: dal 15 giugno al 5 settembre, ottantatré giorni, perché il 12 settembre la scuola riapre. Una ditta, cinque operai, nessuna proroga. Tu entri nel gruppo che decide cosa fare e in che ordine — su un cantiere le decisioni hanno conseguenze fisiche e irreversibili, e alcuni lavori sono vincolati tra loro. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["edilizia-architettura", "meccanica-meccatronica", "energia-sostenibilita", "sicurezza-difesa", "mobilita-sostenibile", "informatica-digitale"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [K_M1, K_M2, K_M3],
  materialiGettone: [K_M4, K_M5, K_M6, K_M7, K_M8, K_M9, K_M10, K_M11, K_M12, K_M13],
  mandati: K_MANDATI,
  prioritaVoci: [
    { id: "controsoffitto", label: "Il controsoffitto è caduto una volta e può cadere ancora", aree: ["edilizia-architettura"] },
    { id: "elettrico", label: "L'impianto elettrico è del 1988 e non è a norma", aree: ["edilizia-architettura"] },
    { id: "tetto", label: "Dal tetto entra acqua da anni", aree: ["edilizia-architettura"] },
    { id: "pavimento", label: "Il pavimento è finito: non ci si può giocare", aree: ["meccanica-meccatronica", "edilizia-architettura"] },
    { id: "caldaia", label: "La caldaia consuma il doppio del necessario", aree: ["energia-sostenibilita"] },
    { id: "spogliatoi", label: "Quattro studenti non possono entrare negli spogliatoi", aree: ["mobilita-sostenibile", "edilizia-architettura"] },
  ],
  ruoli: [
    { id: "ditta", label: "Stare dietro alla ditta ogni giorno", area: "edilizia-architettura" },
    { id: "conti", label: "Tenere i conti e le varianti", area: "informatica-digitale" },
    { id: "sicurezza", label: "Controllare la sicurezza in cantiere", area: "edilizia-architettura" },
    { id: "materiali", label: "Verificare che i materiali arrivino in tempo", area: "meccanica-meccatronica" },
    { id: "famiglie", label: "Parlare con la scuola e le famiglie", area: "mobilita-sostenibile" },
  ],
  passi: [
    { id: "accessibilita", label: "Completare l'accessibilità" },
    { id: "caldaia", label: "Sostituire la caldaia" },
    { id: "pavimento", label: "Rifare il pavimento definitivo" },
    { id: "registro", label: "Istituire un registro delle manutenzioni" },
    { id: "controlli", label: "Programmare i controlli annuali" },
    { id: "formazione", label: "Formare il personale sulla sicurezza" },
    { id: "sensori", label: "Installare sensori di infiltrazione" },
    { id: "documentare", label: "Documentare tutto l'impianto" },
  ],
  // budget alloca non usato (Stanza 3.1 è un pianifica_lavori): stub richiesto
  // dal tipo, mai costruito perché `piano` è presente.
  budget: { totale: () => 0, unita: "€", passo: 1000, voci: () => [] },
  piano: {
    budgetSoldi: 240000,
    unitaSoldi: "€",
    budgetGiorni: 83,
    lavori: (letti) => {
      const richiedeControsoffitto: string[] = [];
      if (letti.has("M5")) richiedeControsoffitto.push("copertura");
      if (letti.has("M4")) richiedeControsoffitto.push("elettrico");
      const lavori: Lavoro[] = [
        { id: "elettrico", label: "Rifacimento impianto elettrico", aree: ["informatica-digitale", "meccanica-meccatronica", "edilizia-architettura"], costo: 62000, giorni: 25, essenziale: true },
        { id: "copertura", label: "Rifacimento della copertura (angolo nord)", aree: ["edilizia-architettura"], costo: 34000, giorni: 15 },
        { id: "controsoffitto", label: "Controsoffitto nuovo antisfondamento", aree: ["edilizia-architettura"], costo: 71000, giorni: 20, essenziale: true, richiede: richiedeControsoffitto },
        { id: "parquet", label: "Pavimento in parquet sportivo omologato", aree: ["edilizia-architettura", "meccanica-meccatronica"], costo: 39000, giorni: 12, parallelizzabile: true, richiede: ["controsoffitto"] },
        { id: "pvc", label: "Pavimento in PVC sportivo (più rapido)", aree: ["edilizia-architettura", "meccanica-meccatronica"], costo: 21000, giorni: 6, parallelizzabile: true, richiede: ["controsoffitto"] },
        { id: "pompa_calore", label: "Pompa di calore al posto della caldaia", aree: ["energia-sostenibilita"], costo: 48000, giorni: 18 },
        { id: "accessibilita", label: "Adeguamento accessibilità degli spogliatoi", aree: ["mobilita-sostenibile", "edilizia-architettura"], costo: 27000, giorni: 14, parallelizzabile: true },
        { id: "fondo_imprevisti", label: "Fondo imprevisti (per le varianti)", aree: [], costo: 15000, giorni: 0 },
      ];
      if (letti.has("M10")) lavori.push({ id: "seconda_squadra", label: "Seconda squadra (lavori in parallelo)", aree: [], costo: 18000, giorni: 0, gate: "M10" });
      return lavori;
    },
  },
  // Le sei etichette si chiamano per quello che SONO, senza la glossa fra
  // parentesi che diceva cosa succede a rinunciarci («si rinvia», «si tiene la
  // vecchia caldaia»). Quella glossa era scritta dal punto di vista di chi
  // scarta, e la stessa etichetta compare anche in frasi che dicono «hai
  // TENUTO …»: lì si contraddiceva. Quattro delle sei non aggiungevano niente
  // che lo step non dica già («rinuncia a due»); le altre due dicevano un
  // ripiego che lo studente ha comunque davanti (la caldaia vecchia è uno dei
  // sei problemi in classifica). La conseguenza vera, quando c'è, sta
  // nell'`avviso` — che compare solo a chi ha letto il documento, ed è lì che
  // deve restare il suo peso.
  scarto: (letti) => [
    { id: "accessibilita", label: "L'adeguamento degli spogliatoi", aree: ["mobilita-sostenibile"], qualita: 0.85, trappola: true, trappolaSeScartata: true, avviso: letti.has("M9") ? "Il dossier accessibilità (che hai letto): quattro studenti restano fuori, e in una ristrutturazione significativa il collaudo può rilevarlo. Non è un «di più»." : undefined },
    { id: "pompa_calore", label: "La pompa di calore", aree: ["energia-sostenibilita"], qualita: 0.1 },
    { id: "parquet", label: "Il parquet omologato", aree: ["edilizia-architettura"], qualita: 0.2 },
    { id: "copertura", label: "La copertura del tetto", aree: ["edilizia-architettura"], qualita: 0.6, avviso: letti.has("M5") ? "La perizia (che hai letto): senza rifare la guaina, l'acqua rovinerà il controsoffitto nuovo entro il primo inverno." : undefined },
    { id: "elettrico", label: "Il rifacimento dell'impianto elettrico", aree: ["edilizia-architettura"], qualita: 0.75, avviso: letti.has("M4") ? "La relazione (che hai letto): senza rifacimento il collaudo non passa e la palestra non riapre, comunque siano andati gli altri lavori." : undefined },
    { id: "controsoffitto", label: "Il controsoffitto nuovo", aree: ["edilizia-architettura"], qualita: 0.9 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["14 luglio, ventinovesimo giorno. Il capocantiere vi chiama nel container."];
    if (m) parti.push(m.vincolo.testo);
    if (!letti.has("M13")) parti.push("E la ditta comunica: «I pannelli del controsoffitto arrivano il 20 agosto. Nessuno li aveva ordinati.» Trentacinque giorni di consegna che nessuno aveva contato, e adesso trascinano tutto il resto.");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "È il 9 giugno. Siete in cinque nell'aula di tecnologia, con le finestre aperte e il rumore degli esami dal corridoio. Sul tavolo: un verbale di sopralluogo di tre mesi fa, un quadro economico, e un calendario con due date cerchiate in rosso — 15 giugno e 5 settembre.\n\nIn mezzo ci sono ottantatré giorni e duecentoquarantamila euro. La palestra ha sei problemi. Voi non potete risolverne sei.",
    introS2: "Il cantiere apre lunedì. Prima di lunedì avete tempo per cinque approfondimenti: cinque preventivi da farsi mandare, cinque tecnici da sentire, cinque documenti da tirare fuori dall'archivio della segreteria.\n\nNon di più. Quello che non chiedete adesso, lo scoprirete a lavori iniziati — quando cambiare idea costa venti giorni.",
    introS4: "20 agosto. Mancano sedici giorni al collaudo. Il documento che scrivete adesso lo leggeranno il dirigente, il Comune, e a settembre milleduecento studenti che entreranno da quella porta.",
    introS5: "Il cantiere è chiuso. Il 12 settembre si vedrà se la palestra riapre. Ma una cosa la sapete già: cosa avete scelto di fare, e cosa avete lasciato indietro.",
    materiali: { titolo: "Prima di tutto: cosa c'è da sistemare?", prompt: "Apri i documenti che vuoi leggere. C'è il verbale del sopralluogo, quello che si sono detti in assemblea e il quadro economico.", hint: "In un cantiere le persone contano quanto i numeri: leggi anche le voci, non solo i tecnici." },
    priorita: { titolo: "Sei problemi. Metteteli in ordine: da cosa partite?", prompt: "Mettili in ordine, dal più importante. Le prime scelte pesano di più." },
    mandato: { titolo: "Il gruppo vi chiede la frase che aprirà il documento. Quale?", prompt: "È la scelta che decide il resto: da qui in poi tutto ruota attorno a questo.", hint: "Tutte e cinque sono difendibili. Scegli quella in cui credi di più." },
    informazioni: { titolo: "Avete 5 gettoni. Cosa andate a verificare?", prompt: "Ogni approfondimento costa un gettone e non torna indietro. Aprilo per leggerlo: quello che non chiedi adesso, lo scoprirai a lavori iniziati.", hint: "Puoi restare nel tuo campo o guardarti intorno: sono due stili diversi, nessuno è migliore." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di non verificare: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Il piano dei lavori: cosa entra, dentro soldi e giorni?", prompt: "Restano i soldi che restano e i giorni che restano. Scegli i lavori: il piano deve stare dentro 240.000 € e 83 giorni, e rispettare le dipendenze (alcuni lavori vanno fatti prima di altri).", hint: "Dove metti le risorse quando sei alle strette racconta le tue priorità più delle parole." },
    scarto: { titolo: "Non ci stanno tutti. Due lavori restano fuori: quali due lasciate fuori?", prompt: "Rinuncia a due. Scegli con attenzione: qualcuno di questi «tagli» costa più di quanto sembra.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Da qui al 5 settembre, chi segue cosa?", prompt: "Per ogni compito: te ne occupi tu o lo lascia a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scriverlo: quanto sarà agibile il 12 settembre?", prompt: "Quanto pensate che la palestra sarà davvero agibile il 12 settembre, quando entrano i ragazzi?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete cosa avete fatto e cosa no", prompt: "Cosa avete fatto, cosa NON avete fatto e perché, e cosa resta da fare. Lo leggeranno il dirigente, il Comune e gli studenti.", hint: "Di' chiaramente cosa hai lasciato indietro e chi ne paga il prezzo. Niente toni trionfali.", minCaratteri: 250 },
    riflessione: { titolo: "Ripensando a questi mesi di cantiere…", prompt: "C'è stata una cosa che avete deciso di non fare e che vi è rimasta addosso? E un momento in cui avete capito qualcosa che gli altri non vedevano?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "L'anno prossimo ci sarà un altro finanziamento. I primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "L'ordine conta: da dove è più saggio cominciare?" },
  },
};

// =====================================================================
// MISSIONE 05 — "Il pronto soccorso organizzativo" (lo Sportello Insieme)
// =====================================================================

const P_M1: Materiale = { id: "M1", titolo: "Le cinque richieste", aree: [], costo: 0, contenuto: "R1 · Sig.ra Colella, 68 anni (in sala): una lettera le chiede di restituire 2.400 € di un contributo, non capisce perché; è agitata. R2 · Famiglia Kaur (in sala, in tre): la domanda per il contributo affitto SCADE OGGI alle 12:00; documenti forse incompleti; la signora parla poco italiano, traduce il figlio di 14 anni. R3 · Telefonata in sospeso, sig. Muratori: vuole l'esito di una pratica di marzo, «è la quarta volta che chiamo». R4 · Mail delle 7:40, mittente non identificato: «esiste un modo di chiedere aiuto senza che lo sappia la mia famiglia?»; nessun nome. R5 · Segnalazione dalla scuola media Ada Negri: un alunno «da tre settimane arriva senza colazione e si addormenta in classe»." };
const P_M2: Materiale = {
  id: "M2", titolo: "Il quarto d'ora prima dell'apertura", aree: [], costo: 0,
  contenuto: "Prima di aprire, gli operatori si confrontano. Dicono cose diverse e incompatibili tra loro:",
  estratti: [
    { chi: "Nadia, operatrice esperta", testo: "La Kaur ha una scadenza alle 12. Le scadenze non si discutono: o si fa o non si fa." },
    { chi: "Paolo, operatore (parla arabo)", testo: "La signora Colella è qui e sta male adesso. Non possiamo lasciarla lì a urlare da sola per due ore." },
    { chi: "Sofia, in formazione", testo: "Quella mail mi ha fatto una strana impressione. Non so dire perché." },
    { chi: "La coordinatrice, al telefono da casa", testo: "Ragazzi, decidete voi. Ma qualunque cosa fate, che sia una cosa che sapreste spiegare." },
    { chi: "Il custode, passando", testo: "Comunque quello che ha telefonato quattro volte prima o poi si presenta qui di persona." },
  ],
};
const P_M3: Materiale = { id: "M3", titolo: "Come funziona lo sportello", aree: [], costo: 0, contenuto: "Non prende decisioni sulle pratiche, indirizza; può accompagnare alla compilazione; deve registrare ogni contatto; non può contattare terzi senza consenso della persona interessata, salvo i casi previsti per i minori." };
const P_M4: Materiale = { id: "M4", titolo: "Regolamento del bando affitti", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Art. 6: la domanda si considera presentata con la ricevuta di protocollo; la documentazione mancante può essere integrata entro 10 giorni. Cioè: basta protocollare entro le 12, il resto si sistema dopo. Non serve avere i documenti perfetti, serve protocollare." };
const P_M5: Materiale = { id: "M5", titolo: "Protocollo per le segnalazioni sui minori", aree: ["salute-professioni-sanitarie", "giurisprudenza-pa"], costo: 1, contenuto: "Le segnalazioni provenienti da istituzioni scolastiche relative a minori vanno trasmesse al servizio sociale competente entro 48 ore e non possono essere gestite dallo sportello in autonomia. La segnalazione della scuola è arrivata lunedì: il termine scade oggi." };
const P_M6: Materiale = { id: "M6", titolo: "Nota sulla riservatezza dei contatti anonimi", aree: ["salute-professioni-sanitarie", "giurisprudenza-pa"], costo: 1, contenuto: "A una richiesta anonima non si risponde con domande identificative; si risponde tenendo aperto il canale, indicando un contatto raggiungibile e senza chiedere nome, età o famiglia. Chiedere «chi sei?» è il modo più rapido per non ricevere più risposta." };
const P_M7: Materiale = { id: "M7", titolo: "Registro degli accessi degli ultimi 3 mesi", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Il sig. Muratori risulta venuto due volte di persona e aver chiamato quattro volte. La pratica di marzo risulta «in attesa di integrazione» da 74 giorni: nessuno gliel'ha mai comunicato. Non è un impaziente: è uno a cui non è stato detto." };
const P_M8: Materiale = { id: "M8", titolo: "Nota sulla mediazione linguistica", aree: ["lingue-relazioni-internazionali", "salute-professioni-sanitarie"], costo: 1, contenuto: "È sconsigliato far tradurre a un minore in situazioni che riguardano la famiglia: mette il ragazzino in una posizione che non gli spetta e rende inaffidabile la comunicazione. Paolo parla arabo ed è disponibile." };
const P_M9: Materiale = { id: "M9", titolo: "Cosa dice davvero la lettera della sig.ra Colella", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Non è una richiesta di restituzione: è una comunicazione di avvio di verifica, con 30 giorni per presentare osservazioni. Nessuno le sta chiedendo indietro 2.400 € adesso. Si può calmarla in tre minuti con un'informazione vera, invece che con un'ora di ascolto." };
const P_M10: Materiale = { id: "M10", titolo: "La scheda dell'alunno segnalato", aree: ["scienze-educazione", "salute-professioni-sanitarie"], costo: 1, contenuto: "12 anni, arrivato a gennaio da un'altra città, due fratelli più piccoli, madre sola con turni notturni. Nessun contatto precedente con i servizi." };
const P_M11: Materiale = { id: "M11", titolo: "Le disponibilità reali degli operatori oggi", aree: ["salute-professioni-sanitarie"], costo: 1, contenuto: "Nadia esce alle 11:00 (commissione). Paolo è l'unico che parla arabo. Sofia è in formazione: non può gestire un colloquio da sola, può affiancare. Cioè dalle 11 in poi restano due persone, di cui una non autonoma." };
const P_M12: Materiale = { id: "M12", titolo: "Le indicazioni della coordinatrice, per iscritto", aree: ["salute-professioni-sanitarie"], costo: 1, contenuto: "«Non lasciate nessuno senza sapere quando avrà una risposta. Anche un “non lo so ancora” è una risposta, se ha una data.»" };
const P_M13: Materiale = { id: "M13", titolo: "Precedente: la mail di aprile", aree: ["salute-professioni-sanitarie"], costo: 1, contenuto: "Sei mesi fa arrivò una mail simile. Fu risposto chiedendo nome e recapito per «poter aiutare meglio». Non arrivò mai una seconda mail. Nessuno ha mai saputo chi fosse." };

const P_MANDATI: Mandato[] = [
  {
    id: "scadenza", label: "«Prima chi ha una scadenza»", frase: "Ciò che scade non torna.",
    aree: [],
    vincolo: { id: "protocollo", testo: "Il protocollo va in tilt per un'ora: le domande cartacee vanno portate a mano in Comune." },
    consulenze: [
      consulenza("P_protocollo", "Consulenza: l'ufficio protocollo", "giurisprudenza-pa", "Per il bando affitti conta la ricevuta di protocollo, non i documenti perfetti. Se protocollate entro le 12, la domanda è salva: il resto si integra dopo."),
      consulenza("P_amministrativa", "Consulenza: un'assistente amministrativa", "giurisprudenza-pa", "Le scadenze rigide sono poche, ma quando ci sono vengono prima di tutto. Il resto si può spiegare, una scadenza persa no."),
    ],
  },
  {
    id: "sofferenza", label: "«Prima chi sta peggio adesso»", frase: "La sofferenza visibile non si mette in coda.",
    aree: ["salute-professioni-sanitarie"],
    vincolo: { id: "colella", testo: "La sig.ra Colella si sente male e va accompagnata: due persone impegnate per 40 minuti." },
    consulenze: [
      consulenza("P_psicologa", "Consulenza: una psicologa dei servizi", "salute-professioni-sanitarie", "Chi sta male e alza la voce non va zittito, va accolto. Ma spesso basta un'informazione vera per far scendere l'ansia: prima di ascoltare per un'ora, verificate cosa dice davvero quella lettera."),
      consulenza("P_ascolto", "Consulenza: un'operatrice di ascolto", "salute-professioni-sanitarie", "La sofferenza che vedi rischia di prendersi tutto il tempo, e intanto quella che non vedi resta indietro. Tienile presenti entrambe."),
    ],
  },
  {
    id: "minori", label: "«Prima i minori»", frase: "Dove c'è un minore, decide la tutela.",
    aree: ["scienze-educazione", "salute-professioni-sanitarie"],
    vincolo: { id: "sociale_chiuso", testo: "Il servizio sociale competente è chiuso il giovedì pomeriggio: o entro le 13 o domani." },
    consulenze: [
      consulenza("P_sociale", "Consulenza: un'assistente sociale", "salute-professioni-sanitarie", "Le segnalazioni sui minori dalle scuole hanno un termine di 48 ore e non le gestisce lo sportello: vanno trasmesse al servizio sociale. Controllate da quando è arrivata."),
      consulenza("P_referente_scuola", "Consulenza: la referente della scuola", "salute-professioni-sanitarie", "Un bambino che arriva senza colazione e si addormenta da tre settimane non è un capriccio: è un segnale che va preso sul serio, e in fretta."),
    ],
  },
  {
    id: "rischio", label: "«Prima chi non può aspettare senza rischio»", frase: "Conta la conseguenza, non la voce.",
    aree: ["salute-professioni-sanitarie"],
    vincolo: { id: "seconda_mail", testo: "Arriva una seconda mail dallo stesso indirizzo: due righe, più brevi." },
    consulenze: [
      consulenza("P_antiviolenza", "Consulenza: un referente del numero antiviolenza", "salute-professioni-sanitarie", "A chi scrive in forma anonima non si chiede chi è: si tiene aperto il canale e si dà un appiglio raggiungibile. La domanda «chi sei?» è il modo più veloce per non ricevere più risposta."),
      consulenza("P_medico", "Consulenza: un medico di comunità", "salute-professioni-sanitarie", "La richiesta più silenziosa può essere la più urgente. Chi urla di solito può aspettare; chi scrive una riga e sparisce, a volte no."),
    ],
  },
  {
    id: "trascurato", label: "«Prima chi è già stato lasciato indietro»", frase: "Chi è stato trascurato ha una precedenza.",
    aree: [],
    vincolo: { id: "muratori", testo: "Il sig. Muratori si presenta di persona alle 10:30, e non è contento." },
    consulenze: [
      consulenza("P_pratiche", "Consulenza: il responsabile delle pratiche", "giurisprudenza-pa", "La pratica di Muratori è ferma «in attesa di integrazione» da 74 giorni, e nessuno gliel'ha mai detto. Non è un impaziente: è uno a cui non abbiamo comunicato niente."),
      consulenza("P_custode", "Consulenza: il custode", "", "Chi ha chiamato quattro volte prima o poi arriva di persona. Meglio richiamarlo prima, che ricevere una lite allo sportello dopo."),
    ],
  },
];

const MD05: MissioneDef = {
  meta: {
    slug: SLUG_SPORTELLO,
    titolo: "Il pronto soccorso organizzativo",
    sottotitolo: "Lo Sportello Insieme, cinque richieste in una mattina",
    descrizione:
      "Lo Sportello Insieme è un servizio comunale di primo ascolto e orientamento. È giovedì mattina, 9:10, e cinque richieste sono arrivate insieme: due persone in sala, una telefonata in sospeso, una mail anonima, una segnalazione dalla scuola. Gli operatori disponibili sono tre. Tu affianchi il coordinamento: proponi come muoversi e devi saper dire perché. Urgente e importante non sono la stessa cosa, e non hai tutte le informazioni. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["salute-professioni-sanitarie", "scienze-educazione", "sicurezza-difesa", "giurisprudenza-pa", "lingue-relazioni-internazionali", "comunicazione-media"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [P_M1, P_M2, P_M3],
  materialiGettone: [P_M4, P_M5, P_M6, P_M7, P_M8, P_M9, P_M10, P_M11, P_M12, P_M13],
  mandati: P_MANDATI,
  prioritaVoci: [
    { id: "kaur", label: "R2 · la famiglia con la scadenza alle 12", aree: ["giurisprudenza-pa", "lingue-relazioni-internazionali"] },
    { id: "colella", label: "R1 · la signora che sta male qui e adesso", aree: ["salute-professioni-sanitarie"] },
    { id: "alunno", label: "R5 · il ragazzino segnalato dalla scuola", aree: ["scienze-educazione", "salute-professioni-sanitarie"] },
    { id: "mail", label: "R4 · la mail anonima di cui non si sa niente", aree: ["salute-professioni-sanitarie"] },
    { id: "muratori", label: "R3 · l'uomo che ha chiamato quattro volte", aree: ["salute-professioni-sanitarie"] },
  ],
  ruoli: [
    { id: "colella", label: "Stare con la signora Colella", area: "salute-professioni-sanitarie" },
    { id: "kaur", label: "Seguire la famiglia Kaur", area: "lingue-relazioni-internazionali" },
    { id: "muratori", label: "Richiamare il sig. Muratori", area: "salute-professioni-sanitarie" },
    { id: "segnalazione", label: "Occuparsi della segnalazione della scuola", area: "scienze-educazione" },
    { id: "mail", label: "Rispondere alla mail", area: "salute-professioni-sanitarie" },
  ],
  passi: [
    { id: "colella_esito", label: "Richiamare la sig.ra Colella per l'esito" },
    { id: "kaur_verifica", label: "Verificare che l'integrazione Kaur sia arrivata" },
    { id: "muratori_chiudi", label: "Chiudere la pratica del sig. Muratori" },
    { id: "sociale_alunno", label: "Sentire il servizio sociale sull'alunno" },
    { id: "canale_mail", label: "Lasciare aperto il canale della mail" },
    { id: "procedura_anonime", label: "Scrivere una procedura per le richieste anonime" },
    { id: "segnala_ferme", label: "Segnalare che le pratiche restano ferme senza avvisare" },
    { id: "mediazione", label: "Organizzare una mediazione linguistica stabile" },
  ],
  budget: {
    totale: () => 210,
    unita: "minuti",
    passo: 10,
    voci: (m, letti) => {
      const voci: VoceBudget[] = [
        { id: "ascolto_colella", label: "Accogliere e ascoltare la sig.ra Colella", aree: ["salute-professioni-sanitarie"] },
      ];
      if (letti.has("M9")) voci.push({ id: "spiega_colella", label: "Spiegarle cosa dice davvero la lettera", aree: ["salute-professioni-sanitarie"], soloSe: "M9" });
      voci.push({ id: "compila_kaur", label: "Compilare la domanda Kaur per intero", aree: ["giurisprudenza-pa"] });
      if (letti.has("M4")) voci.push({ id: "protocolla_kaur", label: "Protocollare la domanda Kaur e integrare dopo", aree: ["giurisprudenza-pa"], soloSe: "M4" });
      voci.push({ id: "richiama_muratori", label: "Richiamare il sig. Muratori", aree: ["salute-professioni-sanitarie"] });
      voci.push({ id: "trasmetti_segnalazione", label: letti.has("M5") ? "Trasmettere la segnalazione al servizio sociale (scade oggi!)" : "Trasmettere la segnalazione al servizio sociale", aree: ["salute-professioni-sanitarie", "scienze-educazione"] });
      voci.push({ id: "rispondi_mail", label: "Rispondere alla mail anonima", aree: ["salute-professioni-sanitarie"] });
      voci.push({ id: "registra_contatti", label: "Registrare i contatti", aree: ["giurisprudenza-pa"] });
      if (letti.has("M12")) voci.push({ id: "data_per_ciascuno", label: "Lasciare a ciascuno una data per la risposta", aree: ["salute-professioni-sanitarie"], soloSe: "M12" });
      return voci;
    },
  },
  scarto: (letti) => [
    { id: "chiedi_identita", label: "Rispondere alla mail anonima chiedendo nome ed età, per poter aiutare meglio", aree: ["salute-professioni-sanitarie"], qualita: 0.05, trappola: true, avviso: letti.has("M6") ? "La nota sulla riservatezza (che hai letto): a una richiesta anonima non si chiede chi è. E sei mesi fa, chiedendo il nome, quella persona non ha più scritto." : undefined },
    { id: "traduce_figlio", label: "Far tradurre al figlio di 14 anni per fare prima", aree: ["lingue-relazioni-internazionali"], qualita: 0.1, avviso: letti.has("M8") ? "La nota sulla mediazione (che hai letto): non si fa tradurre a un minore ciò che riguarda la sua famiglia. Paolo parla arabo." : undefined },
    { id: "segnalazione_qui", label: "Trattare la segnalazione della scuola qui, senza trasmetterla", aree: ["giurisprudenza-pa"], qualita: 0.12, avviso: letti.has("M5") ? "Il protocollo minori (che hai letto): la segnalazione va trasmessa al servizio sociale entro 48 ore, non gestita qui." : undefined },
    { id: "colella_domani", label: "Dire alla sig.ra Colella di tornare domani perché oggi c'è troppa gente", aree: ["salute-professioni-sanitarie"], qualita: 0.25 },
    { id: "muratori_dopo", label: "Richiamare il sig. Muratori solo quando la pratica sarà definita", aree: ["salute-professioni-sanitarie"], qualita: 0.3 },
    { id: "registra_dopo", label: "Rimandare la registrazione dei contatti a fine giornata", aree: ["giurisprudenza-pa"], qualita: 0.6 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["Sono le 10:20. Nadia si affaccia dalla stanza accanto con la faccia di chi sta per dire una cosa che complica tutto."];
    if (m) parti.push(m.vincolo.testo);
    if (!letti.has("M5")) parti.push("E dalla scuola richiamano: «La segnalazione dell'alunno è di lunedì, sono passate 48 ore. È stata trasmessa al servizio sociale?» Se nel piano non c'è, è fuori termine.");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Sono le 9:10. In sala d'attesa ci sono quattro persone; il telefono ha una chiamata in sospeso da ieri; sul computer una mail delle 7:40; sulla scrivania un foglio arrivato dalla scuola media.\n\nNadia vi guarda: «Allora? Da dove cominciamo?» Non potete rispondere a tutti insieme. E la cosa complicata non è scegliere in fretta: è scegliere in un modo che sappiate spiegare.",
    introS2: "Prima di muovervi, potete chiedere cinque cose: tirare fuori un documento, telefonare a qualcuno, leggere un regolamento, guardare un registro.\n\nCinque, non di più: intanto la gente aspetta. Quello che non chiedete adesso, deciderete senza.",
    introS4: "Sono le 12:40. La sala si sta svuotando. Sul vostro schermo c'è una finestra aperta da stamattina: la risposta alla mail delle 7:40, che non avete ancora scritto.",
    introS5: "La mattina è finita. Non tutti hanno avuto risposta, e va bene così: quello che conta è come avete deciso di chi occuparvi, e chi avete deciso di non lasciare al buio.",
    materiali: { titolo: "Prima di tutto: chi c'è, e cosa chiede?", prompt: "Apri i documenti che vuoi leggere. Ci sono le cinque richieste, quello che si sono detti gli operatori e come funziona lo sportello.", hint: "Leggi anche le voci degli operatori: già lì ci sono tre priorità diverse e incompatibili." },
    priorita: { titolo: "Cinque richieste. In che ordine le prendete?", prompt: "Mettile in ordine. Non c'è un ordine giusto in assoluto: conta verso quale bisogno ti giri per primo.", hint: "Le prime scelte pesano di più." },
    mandato: { titolo: "Nadia vi chiede la regola con cui state decidendo. Quale?", prompt: "È la regola che deciderà a chi rispondere prima sapendo che qualcun altro aspetterà.", hint: "Nessuna è quella giusta. Scegli quella in cui credi di più." },
    informazioni: { titolo: "Avete 5 gettoni. Cosa chiedete prima di decidere?", prompt: "Ogni approfondimento costa un gettone e non torna indietro. Aprilo per leggerlo: quello che non chiedi adesso, deciderai senza.", hint: "Puoi restare nel tuo campo o guardarti intorno: sono due stili diversi, nessuno è migliore." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di non chiedere: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Restano tre ore e mezza e le persone che ci sono. Come le distribuite?", prompt: "Avete 210 minuti-operatore. Distribuiteli tra le cose da fare: dove metti il tempo dice a chi hai deciso di dare la precedenza. Fare prima non conta: conta fare bene le cose che vanno fatte oggi.", hint: "Dove metti il tempo quando è poco racconta le tue priorità più delle parole." },
    scarto: { titolo: "Tre modi di procedere non stanno in piedi. Tagliatene due.", prompt: "Rinuncia a due delle strade sul tavolo. Tieni quelle che reggono davvero.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Siete in tre più voi. Chi si occupa di cosa?", prompt: "Per ogni compito: te ne occupi tu o lo lasci a Nadia, Paolo o Sofia? Quello che ti prendi è quello che ti senti di saper fare.", hint: "Il compito più incerto e meno gratificante dice di te più degli altri." },
    previsione: { titolo: "Prima di scriverla: quanto ve la sentite di rispondere a questa mail?", prompt: "Quanto ve la sentite di rispondere alla mail anonima delle 7:40?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete la risposta alla mail", prompt: "Dall'altra parte c'è qualcuno che ha scritto una volta sola e potrebbe non scrivere più. Rispondete tenendo aperto il canale.", hint: "Breve, non invadente, con un appiglio raggiungibile. Non chiedere chi è.", minCaratteri: 150 },
    riflessione: { titolo: "Ripensando a questa mattina…", prompt: "C'è qualcuno che avete lasciato aspettare più di quanto vi sembrasse giusto? E un momento in cui avreste voluto chiedere aiuto e non l'avete fatto?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Domani mattina, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "Alcuni problemi di oggi sono difetti di sistema, non giornate storte." },
  },
};

// =====================================================================
// MISSIONE 06 — "La filiera trasparente" (l'azienda Borea)
// =====================================================================

const B_M1: Materiale = { id: "M1", titolo: "La filiera dello zaino, sei tappe", aree: [], costo: 0, contenuto: "Impatto stimato per tappa: Materie prime (poliestere vergine fossile, 620 g/zaino) 48%; Trasformazione (taglio e cucitura, Prato) 11%; Trasporti (filato dalla Turchia, accessori dalla Cina) 21%; Imballaggio (sacchetto plastica monouso + cartone) 6%; Distribuzione (magazzino unico, spedizioni frazionate) 9%; Fine vita (non riciclabile: tessuto, zip e imbottitura non separabili) 5% dichiarato, ma il 100% finisce in discarica." };
const B_M2: Materiale = {
  id: "M2", titolo: "La riunione di aprile", aree: [], costo: 0,
  contenuto: "Sei persone, cinque posizioni diverse — e una di loro propone qualcosa di illegale. Testuali:",
  estratti: [
    { chi: "La proprietaria", testo: "Non voglio scriverci sopra cose che non possiamo dimostrare. Se lo facciamo, prima o poi qualcuno controlla." },
    { chi: "Il commerciale", testo: "Sopra i 42 euro le catene non ci prendono. Non è un'opinione, è quello che mi dicono al telefono." },
    { chi: "La responsabile di produzione", testo: "Se cambiamo materiale, le mie macchine da cucire vanno ritarate. Non è gratis e non è immediato." },
    { chi: "Il giovane del marketing", testo: "Basta scriverci «eco» e «green» sopra, lo fanno tutti. Chi va a controllare?" },
    { chi: "L'operaia più anziana", testo: "Io ci lavoro da diciannove anni. Se lo zaino dura meno di prima, ce ne accorgiamo noi per primi — e i genitori dopo." },
  ],
};
const B_M3: Materiale = { id: "M3", titolo: "Il vincolo commerciale", aree: [], costo: 0, contenuto: "Costo industriale attuale 14,20 € a zaino; prezzo a scaffale 39 €. Tetto invalicabile: 42 € a scaffale, che corrisponde a circa 15,30 € di costo industriale. Margine di manovra reale: 1,10 € a zaino." };
const B_M4: Materiale = { id: "M4", titolo: "Le tre offerte per il tessuto", aree: ["agrifood-ambiente", "economia-management"], costo: 1, contenuto: "Attuale (poliestere vergine, Turchia): 4,10 €/zaino, 2.100 km, riferimento, 98% puntualità, 20 gg. Alfa (poliestere riciclato CERTIFICATO, Portogallo): 5,40 €, 1.900 km, −34% impatto, 91%, 35 gg. Beta (riciclato NON certificato, Italia): 4,60 €, 320 km, −28% dichiarato non verificato, 88%, 12 gg." };
const B_M5: Materiale = { id: "M5", titolo: "Cosa significa davvero «certificato»", aree: ["scienze-ricerca", "economia-management"], costo: 1, contenuto: "La certificazione di Alfa traccia il materiale con documenti verificabili lungo tutta la catena. Beta dichiara il riciclato ma non ha tracciabilità: non è detto che menta, è che non lo si può dimostrare. Se lo si scrive in etichetta e un'autorità controlla, la contestazione è a carico di Borea, non del fornitore." };
const B_M6: Materiale = { id: "M6", titolo: "La normativa sulle dichiarazioni ambientali", aree: ["scienze-ricerca", "giurisprudenza-pa"], costo: 1, contenuto: "Le affermazioni ambientali generiche («eco», «green», «amico dell'ambiente») senza prova documentale sono pratica commerciale scorretta. Sanzione fino al 10% del fatturato, e obbligo di ritirare le confezioni già stampate." };
const B_M7: Materiale = { id: "M7", titolo: "Analisi dei trasporti", aree: ["mobilita-sostenibile", "energia-sostenibilita"], costo: 1, contenuto: "Il 21% d'impatto dei trasporti si divide così: 14% gli accessori dalla Cina (zip, fibbie, regolatori: pezzi piccoli, spediti in aereo per non fermare la produzione), 7% il filato dalla Turchia via nave. Il grosso non è il tessuto: sono le fibbie che viaggiano in aereo." };
const B_M8: Materiale = { id: "M8", titolo: "Offerta accessori europei", aree: ["meccanica-meccatronica", "mobilita-sostenibile"], costo: 1, contenuto: "Un fornitore slovacco: zip e fibbie a +0,35 € a zaino, consegna via camion in 6 giorni, −12% d'impatto sul totale del prodotto. Le fibbie sono leggermente diverse: serve ritarare le macchine, 3 giorni di fermo produzione. È il miglior rapporto impatto/costo della missione." };
const B_M9: Materiale = { id: "M9", titolo: "Studio sulla riciclabilità a fine vita", aree: ["agrifood-ambiente", "scienze-ricerca"], costo: 1, contenuto: "Lo zaino oggi non è riciclabile perché tessuto, imbottitura e zip sono incollati e cuciti insieme. Rendere il prodotto smontabile costa +0,45 € a zaino e non cambia nulla nell'impatto misurato oggi — cambia tutto tra otto anni, quando lo zaino verrà buttato." };
const B_M10: Materiale = { id: "M10", titolo: "Il test di resistenza", aree: ["meccanica-meccatronica", "scienze-ricerca"], costo: 1, contenuto: "Il tessuto riciclato di Alfa, testato a 12.000 cicli di abrasione, tiene il 92% della resistenza del vergine. Quello di Beta non è stato testato. La durata media di uno zaino è due anni e mezzo: sotto il 90% di resistenza si scende a poco più di uno." };
const B_M11: Materiale = { id: "M11", titolo: "L'imballaggio", aree: ["agrifood-ambiente", "economia-management"], costo: 1, contenuto: "Eliminare il sacchetto in plastica monouso e usare solo il cartone: −0,08 € a zaino (si risparmia), −4% d'impatto, nessun problema tecnico. Non è stato fatto finora solo perché nessuno ci ha pensato. Il guadagno gratuito." };
const B_M12: Materiale = { id: "M12", titolo: "Le condizioni di consegna e il calendario scolastico", aree: ["economia-management", "mobilita-sostenibile"], costo: 1, contenuto: "L'80% delle vendite si concentra tra il 20 agosto e il 20 settembre. La produzione deve finire entro il 31 luglio. Alfa consegna in 35 giorni: l'ordine va fatto entro il 15 maggio, o si salta la stagione." };
const B_M13: Materiale = { id: "M13", titolo: "Il precedente di un concorrente", aree: ["economia-management"], costo: 1, contenuto: "Un'azienda del settore lanciò due anni fa una linea «100% sostenibile» senza documentazione. Un'associazione di consumatori fece un esposto; l'azienda ritirò la linea, distrusse 60.000 confezioni e pagò una sanzione. Il danno peggiore non fu la multa: fu che le catene smisero di rispondere al telefono." };

const B_MANDATI: Mandato[] = [
  {
    id: "materiale", label: "«Cambiamo il materiale»", frase: "Metà dell'impatto è lì, si parte da lì.",
    aree: ["agrifood-ambiente", "scienze-ricerca"],
    vincolo: { id: "alfa_prezzo", testo: "Alfa alza il prezzo di 0,30 €: il margine si assottiglia a 0,80 €." },
    consulenze: [
      consulenza("B_tessile", "Consulenza: un tecnico tessile", "scienze-ricerca", "Il riciclato certificato di Alfa tiene bene alla prova di resistenza; quello non certificato di Beta non è stato testato. Se il tessuto dura meno, non è più sostenibile: è solo più economico."),
      consulenza("B_certificatore", "Consulenza: un ente di certificazione", "economia-management", "Certificato vuol dire tracciabile con documenti lungo tutta la catena. Senza tracciabilità puoi migliorare davvero, ma non puoi scriverlo in etichetta: la responsabilità della frase è tua."),
    ],
  },
  {
    id: "trasporti", label: "«Cambiamo come si muove»", frase: "Il guadagno vero è nei trasporti.",
    aree: ["mobilita-sostenibile", "meccanica-meccatronica"],
    vincolo: { id: "slovacco_quantita", testo: "Il fornitore slovacco garantisce solo l'80% delle quantità il primo anno." },
    consulenze: [
      consulenza("B_spedizioniere", "Consulenza: uno spedizioniere", "mobilita-sostenibile", "Le fibbie viaggiano in aereo per non fermare la produzione: sono piccole ma pesano tanto sull'impatto. Portarle su camion dall'Europa taglia più del cambio di tessuto."),
      consulenza("B_slovacco", "Consulenza: il fornitore slovacco", "meccanica-meccatronica", "Zip e fibbie europee a +0,35 € a zaino, in camion in sei giorni. Sono un po' diverse: le macchine vanno ritarate, tre giorni di fermo."),
    ],
  },
  {
    id: "prodotto", label: "«Cambiamo come è fatto»", frase: "Va ripensato il prodotto, non i pezzi.",
    aree: ["meccanica-meccatronica", "scienze-ricerca"],
    vincolo: { id: "ritaratura", testo: "Ritarare le macchine richiede 6 giorni invece di 3: si mangia il margine di tempo." },
    consulenze: [
      consulenza("B_progettista", "Consulenza: un progettista", "scienze-ricerca", "Se tessuto, imbottitura e zip sono incollati e cuciti insieme, lo zaino non è riciclabile. Renderlo smontabile costa poco oggi e cambia tutto quando verrà buttato."),
      consulenza("B_produzione", "Consulenza: la responsabile di produzione", "meccanica-meccatronica", "Ogni cambio di materiale o di accessori mi ferma le macchine per ritararle. Non è gratis e non è immediato: mettetelo nei conti dei tempi."),
    ],
  },
  {
    id: "finevita", label: "«Cambiamo cosa succede dopo»", frase: "Uno zaino che finisce in discarica non è sostenibile.",
    aree: ["agrifood-ambiente", "energia-sostenibilita"],
    vincolo: { id: "impianto_lontano", testo: "L'unico impianto che tratta questo materiale è a 700 km: il fine vita costa più del previsto." },
    consulenze: [
      consulenza("B_consorzio", "Consulenza: un consorzio del riciclo", "agrifood-ambiente", "Un prodotto smontabile a fine vita non migliora i numeri di oggi, ma è l'unico modo perché tra otto anni non finisca tutto in discarica."),
      consulenza("B_ricercatrice", "Consulenza: una ricercatrice", "energia-sostenibilita", "Attenzione a spostare l'impatto: se per riciclare mandi il materiale a 700 km, il beneficio a fine vita se lo mangia il trasporto. Va misurato, non dichiarato."),
    ],
  },
  {
    id: "racconto", label: "«Cambiamo quello che raccontiamo»", frase: "Prima di tutto va detta la verità.",
    aree: ["economia-management", "scienze-ricerca"],
    vincolo: { id: "documentazione_10gg", testo: "Una catena chiede la documentazione completa entro dieci giorni, o niente ordine." },
    consulenze: [
      consulenza("B_legale", "Consulenza: una consulente legale", "economia-management", "«Eco», «green», «100% sostenibile» senza prova documentale sono pratica scorretta: sanzione fino al 10% del fatturato e ritiro delle confezioni. Ogni parola in etichetta va dimostrata."),
      consulenza("B_consumatori", "Consulenza: un'associazione di consumatori", "scienze-ricerca", "Controlliamo le etichette. Un'azienda che scrive «100% sostenibile» senza carte prima o poi riceve un esposto — e le catene se ne accorgono prima dei giudici."),
    ],
  },
];

const MD06: MissioneDef = {
  meta: {
    slug: SLUG_FILIERA,
    titolo: "La filiera trasparente",
    sottotitolo: "L'azienda Borea, uno zaino da riprogettare senza mentire",
    descrizione:
      "Borea produce 40.000 zaini scolastici l'anno. Le vendite calano, due catene chiedono una certificazione ambientale che non ha, un concorrente vende «riciclato» a meno. La proprietaria vuole riprogettare il prodotto, con una frase sola: «Non voglio scriverci sopra cose che non possiamo dimostrare». Tu sei nel gruppo. Il vincolo è triplo: ridurre l'impatto, tenere la qualità, non superare i 42 € a scaffale. Ogni scelta migliora una cosa e ne peggiora un'altra: chi accetta il compromesso e sa dichiararlo vince. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["agrifood-ambiente", "energia-sostenibilita", "scienze-ricerca", "mobilita-sostenibile", "meccanica-meccatronica", "economia-management"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [B_M1, B_M2, B_M3],
  materialiGettone: [B_M4, B_M5, B_M6, B_M7, B_M8, B_M9, B_M10, B_M11, B_M12, B_M13],
  mandati: B_MANDATI,
  prioritaVoci: [
    { id: "materie", label: "Le materie prime: sono quasi metà dell'impatto", aree: ["agrifood-ambiente"] },
    { id: "trasporti", label: "I trasporti: ventuno per cento e nessuno ci guarda", aree: ["mobilita-sostenibile"] },
    { id: "trasformazione", label: "La trasformazione: è l'unica cosa che controlliamo davvero", aree: ["meccanica-meccatronica"] },
    { id: "imballaggio", label: "L'imballaggio: piccolo ma è quello che il cliente vede", aree: ["agrifood-ambiente", "economia-management"] },
    { id: "distribuzione", label: "La distribuzione: spediamo male e lo sappiamo", aree: ["mobilita-sostenibile", "economia-management"] },
    { id: "finevita", label: "Il fine vita: oggi finisce tutto in discarica", aree: ["agrifood-ambiente", "scienze-ricerca"] },
  ],
  ruoli: [
    { id: "fornitori", label: "Trattare con i fornitori", area: "economia-management" },
    { id: "macchine", label: "Far ritarare le macchine", area: "meccanica-meccatronica" },
    { id: "documentazione", label: "Raccogliere la documentazione", area: "scienze-ricerca" },
    { id: "etichetta", label: "Scrivere quello che va in etichetta", area: "agrifood-ambiente" },
    { id: "test", label: "Verificare i test di resistenza", area: "mobilita-sostenibile" },
  ],
  passi: [
    { id: "certifica_italiano", label: "Certificare anche il fornitore italiano" },
    { id: "misura_impatto", label: "Misurare l'impatto reale del nuovo prodotto" },
    { id: "progetta_smontabile", label: "Progettare lo zaino smontabile" },
    { id: "ritiro_vecchi", label: "Avviare un ritiro dei vecchi zaini" },
    { id: "spedizioni", label: "Ridurre le spedizioni frazionate" },
    { id: "durata_scuole", label: "Testare la durata sul campo con le scuole" },
    { id: "forma_commerciale", label: "Formare il commerciale su cosa si può dire" },
    { id: "pubblica_dati", label: "Pubblicare i dati verificati" },
  ],
  // budget alloca non usato (Stanza 3.1 è un pianifica_lavori): stub.
  budget: { totale: () => 0, unita: "cent", passo: 1, voci: () => [] },
  piano: {
    budgetSoldi: 110,
    unitaSoldi: "cent",
    lavori: (letti) => {
      const lavori: Lavoro[] = [
        { id: "tessuto_alfa", label: "Tessuto Alfa riciclato certificato (−34% impatto)", aree: ["agrifood-ambiente"], costo: 130, giorni: 0 },
        { id: "tessuto_beta", label: "Tessuto Beta riciclato non certificato (−28% dichiarato)", aree: ["agrifood-ambiente"], costo: 50, giorni: 0 },
      ];
      if (letti.has("M7") && letti.has("M8")) lavori.push({ id: "accessori_europei", label: "Accessori europei in camion (−12% impatto)", aree: ["mobilita-sostenibile", "meccanica-meccatronica"], costo: 35, giorni: 0, gate: "M7+M8" });
      if (letti.has("M9")) lavori.push({ id: "smontabile", label: "Prodotto smontabile a fine vita", aree: ["agrifood-ambiente", "scienze-ricerca"], costo: 45, giorni: 0, gate: "M9" });
      if (letti.has("M11")) lavori.push({ id: "sacchetto", label: "Eliminare il sacchetto di plastica (fa RISPARMIARE, −4% impatto)", aree: ["agrifood-ambiente"], costo: -8, giorni: 0, gate: "M11" });
      lavori.push({ id: "test_resistenza", label: "Test di resistenza indipendente", aree: ["meccanica-meccatronica", "scienze-ricerca"], costo: 12, giorni: 0 });
      lavori.push({ id: "documentazione", label: "Documentazione e tracciabilità (per poter dichiarare)", aree: ["economia-management", "scienze-ricerca"], costo: 18, giorni: 0 });
      lavori.push({ id: "fondo_imprevisti", label: "Fondo per gli imprevisti di produzione", aree: [], costo: 15, giorni: 0 });
      return lavori;
    },
  },
  scarto: (letti) => [
    { id: "beta_dichiara", label: "Scegliere Beta e scrivere in etichetta «tessuto riciclato»", aree: ["agrifood-ambiente", "economia-management"], qualita: 0.05, trappola: true, avviso: letti.has("M5") ? "Beta non ha tracciabilità (l'hai letto): scriverlo in etichetta mette la responsabilità su Borea, non sul fornitore. Due anni fa un concorrente distrusse 60.000 confezioni così." : undefined },
    { id: "eco_friendly", label: "Scrivere «eco-friendly» senza specificare", aree: ["economia-management"], qualita: 0.08, avviso: letti.has("M6") ? "La normativa (che hai letto): le affermazioni generiche senza prova sono pratica scorretta, sanzione fino al 10% del fatturato." : undefined },
    { id: "alza_prezzo", label: "Tenere tutto com'è e alzare il prezzo a 44 €", aree: ["economia-management"], qualita: 0.2 },
    { id: "rimanda", label: "Rimandare tutto alla prossima stagione", aree: ["economia-management"], qualita: 0.3 },
    { id: "smontabile_comunica", label: "Fare il prodotto smontabile e comunicare solo quello", aree: ["agrifood-ambiente", "comunicazione-media"], qualita: 0.7 },
    { id: "beta_muto", label: "Scegliere Beta e NON scrivere niente in etichetta", aree: ["agrifood-ambiente"], qualita: 0.85 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["8 maggio, riunione del comitato. La proprietaria entra con un foglio in mano e non si siede."];
    if (m) parti.push(m.vincolo.testo);
    if (!letti.has("M12")) parti.push("E il commerciale entra con il calendario in mano: «Se l'ordine ad Alfa non parte entro il 15 maggio, la merce non c'è per la stagione. Consegnano in 35 giorni.»");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Siete in sei nella sala riunioni sopra il magazzino, con l'odore del tessuto che sale dalle scale. Sul tavolo c'è uno zaino blu tagliato a metà, per mostrare com'è fatto dentro.\n\nLa proprietaria ve lo indica: «Questo costa 14,20 a farlo e 39 in negozio. Deve inquinare meno, durare uguale, e non costare più di 42.» Poi aggiunge la frase che conta: «E non voglio scriverci sopra cose che non possiamo dimostrare.»",
    introS2: "Avete due settimane prima del comitato. Due settimane sono cinque verifiche: un preventivo chiesto, un test commissionato, una norma letta, un fornitore sentito.\n\nCinque, non di più. Quello che non verificate adesso, dovrete scriverlo senza poterlo dimostrare — e la proprietaria ha detto che non si fa.",
    introS4: "20 maggio. Sul tavolo c'è la bozza della nuova etichetta, vuota. Quello che ci scrivete sopra finirà su quarantamila zaini e lo leggeranno dei genitori mentre decidono se spendere quaranta euro.",
    introS5: "Il comitato ha deciso. La stagione dirà se ha funzionato. Ma una cosa la sapete già: quanto di ciò che avete scritto in etichetta lo potete davvero dimostrare.",
    materiali: { titolo: "Prima di tutto: com'è fatto lo zaino, e dove inquina?", prompt: "Apri i documenti che vuoi leggere. C'è la filiera con gli impatti, quello che si sono detti in riunione e il vincolo commerciale.", hint: "Leggi anche le voci: cinque persone dicono cinque cose incompatibili, e una propone qualcosa di illegale." },
    priorita: { titolo: "Sei tappe della filiera. Da quale partite a intervenire?", prompt: "Mettile in ordine, da dove conviene partire. Le prime scelte pesano di più." },
    mandato: { titolo: "La proprietaria vuole una frase sola per capire dove andate. Quale?", prompt: "È la scelta che decide dove concentrerete gli sforzi.", hint: "Nessuna è quella giusta. Ogni strada migliora una cosa e ne trascura un'altra." },
    informazioni: { titolo: "Avete 5 gettoni. Cosa verificate prima di decidere?", prompt: "Ogni verifica costa un gettone e non torna indietro. Aprila per leggerla: quello che non verifichi, non lo potrai scrivere — e la proprietaria non vuole cose non dimostrabili.", hint: "Puoi restare sul tessuto o guardarti intorno: a volte il guadagno più grande è dove nessuno guarda." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di non verificare: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Avete 1,10 € a zaino di margine. Cosa comprate?", prompt: "Ogni centesimo speso qui è un centesimo che non spendete altrove. Scegliete gli interventi: il piano deve stare dentro 110 centesimi. Attenzione: una voce fa RISPARMIARE, invece di costare.", hint: "Quanto impatto compri per centesimo speso conta più di quanto spendi." },
    scarto: { titolo: "Tre strade non reggono. Tagliatene due.", prompt: "Rinuncia a due delle strade sul tavolo. Attenzione: migliorare senza dichiararlo è lecito; dichiarare senza poterlo dimostrare no.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Chi segue cosa da qui alla produzione?", prompt: "Per ogni compito: te ne occupi tu o lo lasci a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scriverla: quanto è dimostrabile ogni parola che userete?", prompt: "Quanto siete sicuri che ogni parola che state per scrivere in etichetta sia dimostrabile?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete cosa comunicate al cliente", prompt: "Cosa avete cambiato, di quanto, e cosa NON avete potuto fare. Ogni affermazione dev'essere sostenuta da qualcosa che avete verificato.", hint: "Numeri veri, niente parole generiche. Una comunicazione modesta e dimostrabile vale più di una entusiasta.", minCaratteri: 150 },
    riflessione: { titolo: "Ripensando a queste due settimane…", prompt: "C'è stato un momento in cui la cosa più conveniente e la cosa più giusta non coincidevano? E cosa avete fatto?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Per la stagione prossima, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "L'ordine conta: da dove è più saggio cominciare?" },
  },
};

// =====================================================================
// MISSIONE 07 — "Il museo da reinventare" (Museo della Seta di Vallecorta)
// =====================================================================

const U_M1: Materiale = { id: "M1", titolo: "La collezione in tre sale", aree: [], costo: 0, contenuto: "Sala 1: telai a mano dell'Ottocento, 4 pezzi funzionanti. Sala 2: campionario di tessuti, 700 pezzi, di cui 60 esposti. Sala 3: la storia delle filandaie — fotografie, buste paga, un registro di fabbrica del 1911 con nomi ed età delle operaie (la più giovane aveva nove anni)." };
const U_M2: Materiale = {
  id: "M2", titolo: "La riunione con i volontari", aree: [], costo: 0,
  contenuto: "Attorno al tavolo, posizioni inconciliabili. E uno di loro dice la cosa più importante, che nessuno ascolta. Testuali:",
  estratti: [
    { chi: "Sig.ra Bertone, volontaria da 22 anni", testo: "Le scolaresche arrivano, corrono, toccano tutto e se ne vanno. Non è quello il pubblico che ci serve." },
    { chi: "Il sindaco", testo: "A me servono i numeri. Non mi interessa come li fate, mi interessa che il prossimo anno siano il doppio." },
    { chi: "Alessia, 24 anni, unica dipendente giovane", testo: "Il pezzo più forte che abbiamo è il registro del 1911. Ci sono i nomi. Uno di quei cognomi ce l'hanno ancora metà delle famiglie del paese." },
    { chi: "Un insegnante", testo: "Io ci porto i ragazzi perché è vicino e costa poco. Se ci fosse qualcosa da fare, non solo da guardare, ci tornerei due volte l'anno." },
    { chi: "Il conservatore, in pensione", testo: "Ricordo a tutti che quei tessuti stanno al buio per un motivo." },
  ],
};
const U_M3: Materiale = { id: "M3", titolo: "Il bando comunale", aree: [], costo: 0, contenuto: "18.000 €, una sola iniziativa, rendicontazione entro 12 mesi. Vincolo: l'iniziativa deve essere ripetibile senza nuovi fondi. Punteggio premiante per: coinvolgimento delle scuole, accessibilità, collaborazione con soggetti del territorio." };
const U_M4: Materiale = { id: "M4", titolo: "Nota di conservazione", aree: ["studi-umanistici-beni-culturali", "scienze-ricerca"], costo: 1, contenuto: "I tessuti storici tollerano max 50 lux e non più di tre mesi l'anno di esposizione. Ogni progetto che li porti in giro, li illumini o li faccia toccare è irrealizzabile senza un intervento di conservazione che costa da solo più dell'intero budget." };
const U_M5: Materiale = { id: "M5", titolo: "I numeri dei visitatori, disaggregati", aree: ["economia-management", "scienze-ricerca"], costo: 1, contenuto: "2.840 totali: 1.900 scolaresche (67%), 610 turisti di passaggio, 330 residenti. I residenti sono in calo del 40% in cinque anni. Il paese ha 4.100 abitanti: meno di uno su dieci entra nel proprio museo." };
const U_M6: Materiale = { id: "M6", titolo: "Il registro di fabbrica del 1911", aree: ["studi-umanistici-beni-culturali", "lingue-relazioni-internazionali"], costo: 1, contenuto: "214 nomi con età, paese di provenienza e mansione. Trentuno operaie sotto i quindici anni. Diciotto provenivano da fuori regione. I cognomi sono ancora quelli del paese. Il pezzo che vale più di tutti gli altri messi insieme, e non è un oggetto: è un elenco." };
const U_M7: Materiale = { id: "M7", titolo: "Preventivi dei sei formati", aree: ["economia-management"], costo: 1, contenuto: "Percorso interattivo con schermi 16.500 € (permanente, sì ma manutenzione). Podcast in 6 puntate 7.000 € (permanente, sì). Video breve 5.500 € (permanente, sì). Laboratorio con i telai 9.000 € (ricorrente, sì ed è l'unico che genera un piccolo ricavo). Evento dal vivo 12.000 € (una sera, NO non ripetibile). Pannelli narrativi nuovi 8.500 € (permanente, sì)." };
const U_M8: Materiale = { id: "M8", titolo: "L'indagine sui non-visitatori", aree: ["scienze-ricerca"], costo: 1, contenuto: "180 residenti intervistati. Perché non ci vanno: 44% «l'ho già visto da bambino», 27% «non so cosa ci sia», 19% «non è un posto per me», 10% orari. Solo il 27% è un problema di comunicazione. Il 44% è un problema di contenuto: chi c'è già stato non ha motivo di tornare." };
const U_M9: Materiale = { id: "M9", titolo: "La disponibilità delle scuole", aree: ["scienze-educazione", "economia-management"], costo: 1, contenuto: "Le tre scuole del comprensorio confermano che tornerebbero due volte l'anno invece di una se ci fosse un'attività pratica. Sono 1.900 visite che diventerebbero 3.400. Da solo, questo raddoppia i numeri che chiede il sindaco." };
const U_M10: Materiale = { id: "M10", titolo: "I quattro telai funzionanti", aree: ["arte-design-moda", "meccanica-meccatronica"], costo: 1, contenuto: "Due sono utilizzabili con supervisione. Un ex operaio del cotonificio, 79 anni, si è offerto di insegnare a usarli. Gratis. Ha chiesto solo «che non li lascino arrugginire»." };
const U_M11: Materiale = { id: "M11", titolo: "Chi c'è sul territorio", aree: ["lingue-relazioni-internazionali", "musica-spettacolo"], costo: 1, contenuto: "Una scuola di musica, un gruppo teatrale amatoriale, un'associazione di famiglie di origine straniera (molte lavorano nel tessile), una biblioteca con una sala." };
const U_M12: Materiale = { id: "M12", titolo: "Il precedente del museo vicino", aree: ["economia-management"], costo: 1, contenuto: "Un museo simile investì tutto in un percorso con schermi. Primo anno: +180% di visitatori. Terzo anno: sotto i numeri di partenza, perché gli schermi si guastarono e nessuno aveva i fondi per ripararli. La novità richiama una volta sola." };
const U_M13: Materiale = { id: "M13", titolo: "Accessibilità e lingue", aree: ["lingue-relazioni-internazionali", "mobilita-sostenibile"], costo: 1, contenuto: "Nessun materiale in altre lingue; nessun sottotitolo; la Sala 3 è al primo piano senza ascensore. Il bando premia l'accessibilità, e la Sala 3 è quella che contiene il registro del 1911." };

const U_MANDATI: Mandato[] = [
  {
    id: "residenti", label: "«Per chi ci è già stato da bambino»", frase: "I residenti che non tornano.",
    aree: [],
    vincolo: { id: "volontari", testo: "I volontari si oppongono: «cambiare tutto per chi non viene, e chi viene?»" },
    consulenze: [
      consulenza("U_comunicazione", "Consulenza: un'esperta di comunicazione culturale", "comunicazione-media", "Il 44% non torna perché l'ha già visto: non è un problema di comunicazione, è di contenuto. Comunicare di più non serve, serve dare un motivo nuovo per tornare."),
      consulenza("U_bertone", "Consulenza: la sig.ra Bertone", "studi-umanistici-beni-culturali", "Non buttate via chi il museo lo tiene aperto adesso per inseguire chi non c'è mai venuto. Si può fare qualcosa di nuovo senza tradire quello che siamo."),
    ],
  },
  {
    id: "scuole", label: "«Per le scuole»", frase: "1.900 visite che possono diventare 3.400.",
    aree: ["scienze-educazione", "arte-design-moda"],
    vincolo: { id: "guida", testo: "Le scuole chiedono una guida didattica e nessuno l'ha mai scritta: 30 ore di lavoro non preventivate." },
    consulenze: [
      consulenza("U_insegnante", "Consulenza: un'insegnante", "scienze-educazione", "Se ci fosse un'attività pratica torneremmo due volte l'anno invece di una. Ma serve una guida didattica vera, non un volantino."),
      consulenza("U_operaio", "Consulenza: l'ex operaio", "arte-design-moda", "Due dei quattro telai funzionano ancora. Vengo io a insegnare ai ragazzi a usarli, gratis. Basta che non li lascino arrugginire."),
    ],
  },
  {
    id: "turisti", label: "«Per chi passa di qui»", frase: "I turisti di passaggio.",
    aree: ["lingue-relazioni-internazionali", "economia-management"],
    vincolo: { id: "lingue", testo: "Il consorzio turistico chiede materiale in tre lingue entro l'apertura della stagione." },
    consulenze: [
      consulenza("U_turismo", "Consulenza: un operatore turistico", "economia-management", "Il turista di passaggio si ferma dieci minuti: gli serve una cosa da vedere subito e da raccontare dopo. Ma senza materiale nella sua lingua non entra nemmeno."),
      consulenza("U_traduttore", "Consulenza: un traduttore", "lingue-relazioni-internazionali", "Tre lingue, non una: il grosso dei passaggi qui è straniero. E le storie delle operaie venute da fuori regione parlano proprio a chi arriva da lontano."),
    ],
  },
  {
    id: "esclusi", label: "«Per chi il museo non lo considera un posto suo»", frase: "Il 19% che dice «non è per me».",
    aree: ["lingue-relazioni-internazionali", "musica-spettacolo"],
    vincolo: { id: "famiglie", testo: "Serve coinvolgere le famiglie prima di progettare: due mesi in più." },
    consulenze: [
      consulenza("U_mediatrice", "Consulenza: la mediatrice dell'associazione", "lingue-relazioni-internazionali", "Molte famiglie straniere del paese lavorano nel tessile, come le operaie del 1911. Se le coinvolgete prima di decidere, il museo diventa anche loro."),
      consulenza("U_teatro", "Consulenza: il gruppo teatrale", "musica-spettacolo", "Le storie del registro sono teatro già pronto. Un lavoro dal vivo con le voci delle operaie porta dentro chi non entrerebbe mai a guardare tessuti in una teca."),
    ],
  },
  {
    id: "conservazione", label: "«Per chi verrà dopo di noi»", frase: "Conservare prima di mostrare.",
    aree: ["studi-umanistici-beni-culturali", "scienze-ricerca"],
    vincolo: { id: "telai_sicurezza", testo: "La perizia rivela che due telai vanno messi in sicurezza subito: 4.000 € dal budget." },
    consulenze: [
      consulenza("U_conservatore", "Consulenza: il conservatore", "studi-umanistici-beni-culturali", "I tessuti stanno al buio per un motivo: 50 lux, tre mesi l'anno. Qualunque progetto che li esponga o li faccia toccare li rovina. Non è un dettaglio, è il vincolo."),
      consulenza("U_restauratrice", "Consulenza: una restauratrice", "scienze-ricerca", "Prima di mostrare bisogna conservare. Due telai vanno messi in sicurezza subito, o tra dieci anni non ci sarà più niente da mostrare."),
    ],
  },
];

const MD07: MissioneDef = {
  meta: {
    slug: SLUG_MUSEO,
    titolo: "Il museo da reinventare",
    sottotitolo: "Il Museo della Seta di Vallecorta, un solo progetto per rialzarsi",
    descrizione:
      "Il Museo della Seta ha 1.100 pezzi, due dipendenti, quattro volontari e 2.840 visitatori l'anno (di cui 1.900 scolaresche obbligate). Il Comune concede 18.000 € per «un progetto di rinnovamento del pubblico», una sola iniziativa, rendicontata entro dodici mesi: se i numeri non salgono, il prossimo bilancio taglia l'orario. Tu entri nel gruppo che sceglie cosa fare. Non svecchiare il museo: scegliere UNA cosa e farla bene — sapendo che un museo non ha un pubblico ma cinque, e che le cose antiche si rovinano. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["studi-umanistici-beni-culturali", "arte-design-moda", "musica-spettacolo", "lingue-relazioni-internazionali", "comunicazione-media", "economia-management"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [U_M1, U_M2, U_M3],
  materialiGettone: [U_M4, U_M5, U_M6, U_M7, U_M8, U_M9, U_M10, U_M11, U_M12, U_M13],
  mandati: U_MANDATI,
  prioritaVoci: [
    { id: "persone", label: "Delle persone che ci lavoravano, e di quanto erano giovani", aree: ["studi-umanistici-beni-culturali"] },
    { id: "tecnica", label: "Di come si fa un tessuto: la tecnica, le macchine", aree: ["arte-design-moda", "meccanica-meccatronica"] },
    { id: "paese", label: "Di questo paese e di cosa è stato", aree: ["studi-umanistici-beni-culturali", "lingue-relazioni-internazionali"] },
    { id: "bellezza", label: "Della bellezza dei tessuti in sé", aree: ["arte-design-moda"] },
    { id: "lavoro_mondo", label: "Di un lavoro che oggi si fa altrove nel mondo", aree: ["lingue-relazioni-internazionali", "economia-management"] },
    { id: "fabbrica", label: "Di una fabbrica che ha chiuso e di cosa è rimasto", aree: ["economia-management", "studi-umanistici-beni-culturali"] },
  ],
  ruoli: [
    { id: "scuole", label: "Tenere i rapporti con le scuole", area: "scienze-educazione" },
    { id: "contenuti", label: "Curare i contenuti storici", area: "studi-umanistici-beni-culturali" },
    { id: "budget", label: "Gestire il budget e la rendicontazione", area: "economia-management" },
    { id: "comunicazione", label: "Far conoscere l'iniziativa", area: "comunicazione-media" },
    { id: "laboratori", label: "Stare accanto all'ex operaio nei laboratori", area: "arte-design-moda" },
  ],
  passi: [
    { id: "formare_volontari", label: "Formare i volontari all'attività" },
    { id: "digitalizzare_registro", label: "Digitalizzare tutto il registro" },
    { id: "cercare_discendenti", label: "Cercare i discendenti delle operaie" },
    { id: "aprire_sera", label: "Aprire il museo di sera una volta al mese" },
    { id: "misurare_ritorni", label: "Misurare quanti tornano" },
    { id: "ascensore", label: "Mettere l'ascensore" },
    { id: "associazione", label: "Coinvolgere l'associazione delle famiglie" },
    { id: "bando_grande", label: "Candidarsi a un bando più grande" },
  ],
  // budget alloca non usato (Stanza 3.1 è un pianifica_lavori a tetto in euro).
  budget: { totale: () => 0, unita: "€", passo: 1000, voci: () => [] },
  piano: {
    budgetSoldi: 18000,
    unitaSoldi: "€",
    lavori: (letti) => {
      const lavori: Lavoro[] = [
        { id: "fmt_podcast", label: "Formato: podcast in 6 puntate (permanente)", aree: ["comunicazione-media", "studi-umanistici-beni-culturali"], costo: 7000, giorni: 0 },
        { id: "fmt_video", label: "Formato: video breve (permanente)", aree: ["comunicazione-media"], costo: 5500, giorni: 0 },
        { id: "fmt_pannelli", label: "Formato: pannelli narrativi nuovi (permanente)", aree: ["studi-umanistici-beni-culturali"], costo: 8500, giorni: 0 },
        { id: "fmt_schermi", label: "Formato: percorso interattivo con schermi", aree: ["comunicazione-media"], costo: 16500, giorni: 0 },
        { id: "fmt_evento", label: "Formato: evento dal vivo (una sera, NON ripetibile)", aree: ["musica-spettacolo"], costo: 12000, giorni: 0 },
      ];
      if (letti.has("M9") && letti.has("M10")) lavori.push({ id: "fmt_laboratorio", label: "Formato: laboratorio con i telai e l'ex operaio (ripetibile, genera un ricavo)", aree: ["arte-design-moda", "scienze-educazione"], costo: 9000, giorni: 0, gate: "M9+M10" });
      lavori.push({ id: "guida_didattica", label: "Guida didattica per le scuole", aree: ["scienze-educazione"], costo: 1800, giorni: 0 });
      lavori.push({ id: "traduzioni", label: "Traduzioni in tre lingue", aree: ["lingue-relazioni-internazionali"], costo: 2200, giorni: 0 });
      lavori.push({ id: "sicurezza_telai", label: "Messa in sicurezza dei telai", aree: ["arte-design-moda"], costo: 4000, giorni: 0 });
      if (letti.has("M6")) lavori.push({ id: "digitalizza_registro", label: "Digitalizzazione del registro del 1911", aree: ["studi-umanistici-beni-culturali", "informatica-digitale"], costo: 1500, giorni: 0, gate: "M6" });
      lavori.push({ id: "accessibilita_sala3", label: "Accessibilità della Sala 3 (premiata dal bando)", aree: ["mobilita-sostenibile"], costo: 3400, giorni: 0 });
      lavori.push({ id: "compenso_operaio", label: "Rimborso all'ex operaio (si è offerto gratis)", aree: ["arte-design-moda"], costo: 600, giorni: 0 });
      lavori.push({ id: "comunicazione_lancio", label: "Comunicazione e lancio", aree: ["comunicazione-media"], costo: 1400, giorni: 0 });
      return lavori;
    },
  },
  scarto: (letti) => [
    { id: "mostra_itinerante", label: "Portare i tessuti più belli in una mostra itinerante nelle scuole", aree: ["studi-umanistici-beni-culturali", "arte-design-moda"], qualita: 0.05, trappola: true, avviso: letti.has("M4") ? "La nota di conservazione (che hai letto): i tessuti tollerano 50 lux e tre mesi l'anno. Spostarli e illuminarli li rovina, e il restauro costerebbe più dell'intero budget." : undefined },
    { id: "grande_evento", label: "Un grande evento inaugurale con la banda del paese", aree: ["musica-spettacolo"], qualita: 0.15 },
    { id: "schermi_tutte_sale", label: "Un percorso con schermi in tutte e tre le sale", aree: ["comunicazione-media"], qualita: 0.25, avviso: letti.has("M12") ? "Il precedente del museo vicino (che hai letto): gli schermi richiamarono una volta sola, poi si guastarono e non c'erano fondi per ripararli." : undefined },
    { id: "laboratorio_telai", label: "Un laboratorio con i telai condotto dall'ex operaio", aree: ["arte-design-moda", "scienze-educazione"], qualita: 0.85 },
    { id: "podcast_operaie", label: "Un podcast sulle storie delle operaie del registro", aree: ["studi-umanistici-beni-culturali", "comunicazione-media"], qualita: 0.75 },
    { id: "solo_conservazione", label: "Non fare niente e mettere i soldi in conservazione", aree: ["studi-umanistici-beni-culturali"], qualita: 0.4 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["Martedì mattina, undici giorni alla consegna. Alessia vi chiama: «Dobbiamo parlare.»"];
    if (m) parti.push(m.vincolo.testo);
    if (!letti.has("M4")) parti.push("E il conservatore vi ferma sulle scale: «Sapete che quei tessuti non possono stare accesi più di tre mesi l'anno, vero? E che non si possono toccare?»");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Il museo apre alle dieci ma alle nove e mezza siete già dentro, e fa freddo. Le luci della Sala 2 sono spente: si accendono solo quando entra qualcuno.\n\nAlessia posa sul tavolo il registro del 1911, aperto a metà. «Guardate qui», dice, e indica una riga: Teresa B., anni nove, sguattera. Poi arriva il foglio del Comune: diciottomila euro, un progetto solo, dodici mesi.",
    introS2: "Il progetto va consegnato in tre settimane. Prima di scriverlo potete approfondire cinque cose: chiedere un preventivo, leggere una perizia, sentire una scuola, guardare i numeri veri.\n\nCinque. Quello che non chiedete adesso, lo scriverete a intuito.",
    introS4: "Il progetto è consegnato. Ora serve la frase con cui lo racconterete: andrà sul sito del Comune, sulla locandina in piazza e nella circolare alle scuole. Ottanta parole, non di più.",
    introS5: "Il progetto è partito. Il primo anno dirà se ha funzionato. Ma una cosa la sapete già: per chi l'avete pensato, e cosa avete scelto di non toccare.",
    materiali: { titolo: "Prima di tutto: di cosa parla questo museo?", prompt: "Apri i documenti che vuoi leggere. C'è la collezione, quello che si sono detti i volontari e il bando del Comune.", hint: "Leggi anche le voci: qualcuno in riunione ha detto la cosa più importante, e nessuno gli ha dato retta." },
    priorita: { titolo: "Di cosa parla davvero questo museo? Mettete in ordine.", prompt: "Mettile in ordine, da ciò che conta di più. Le prime scelte pesano di più." },
    mandato: { titolo: "Per chi lo state facendo? Una risposta sola.", prompt: "Con 18.000 € e un progetto solo, non potete parlare a tutti: scegliete un pubblico.", hint: "Nessuna è quella giusta. Più il progetto attira i giovani, più rischia di allontanare chi il museo lo tiene in vita adesso." },
    informazioni: { titolo: "Avete 5 gettoni. Cosa approfondite?", prompt: "Ogni approfondimento costa un gettone e non torna indietro. Aprilo per leggerlo: quello che non chiedi adesso, lo scriverai a intuito.", hint: "Puoi restare nel tuo campo o guardarti intorno: sono due stili diversi, nessuno è migliore." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di non approfondire: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "18.000 €, un progetto solo. Componete il piano.", prompt: "Scegliete il formato e le voci: il piano deve stare dentro 18.000 € e rispettare il bando, che chiede un'iniziativa ripetibile senza nuovi fondi.", hint: "Un formato che funziona una sera sola viola il bando: la ripetibilità conta." },
    scarto: { titolo: "Tre idee non stanno in piedi. Tagliatene due.", prompt: "Rinuncia a due delle idee sul tavolo. Attenzione: la più generosa non è detto sia la più saggia.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Chi segue cosa nei prossimi dodici mesi?", prompt: "Per ogni compito: te ne occupi tu o lo lasci a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Quanto pensate che farà tornare qualcuno una seconda volta?", prompt: "Quanto pensate che questa iniziativa farà tornare qualcuno una seconda volta?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete il testo di lancio (max 80 parole)", prompt: "Deve far capire a chi non c'è mai stato perché dovrebbe venire, e a chi c'è già stato perché dovrebbe tornare.", hint: "Nomina una cosa concreta che il visitatore farà o vedrà. Se hai letto il registro, usa un nome vero: niente formule da depliant.", minCaratteri: 120 },
    riflessione: { titolo: "Ripensando a questo museo…", prompt: "C'è qualcosa che secondo voi non andava toccato? E qualcosa che andava cambiato da anni e nessuno aveva cambiato?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Dopo il primo anno, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "L'ordine conta: da dove è più saggio cominciare?" },
  },
};

// =====================================================================
// MISSIONE 08 — "La città senz'acqua" (Montebrico)
// =====================================================================

const W_M1: Materiale = { id: "M1", titolo: "Consumi per quartiere (litri/abitante/giorno)", aree: [], costo: 0, contenuto: "Colline: 6.200 ab., 310 l pro capite (villette con giardino e piscine). Centro: 14.800 ab., 128 l (palazzi storici). San Rocco: 19.400 ab., 142 l (edilizia popolare anni '70). Fiera: 11.300 ab., 119 l (palazzine anni 2000). Borgate: 9.300 ab., 155 l (case sparse, orti). Media nazionale di riferimento: 215 l/ab/giorno — la città consuma sotto la media, tranne Colline." };
const W_M2: Materiale = { id: "M2", titolo: "Consumi per tipo di utenza (% del totale)", aree: [], costo: 0, contenuto: "Domestico 58%, agricolo 17%, industriale 11%, edifici pubblici 8%, perdite di rete 6% dichiarato." };
const W_M3: Materiale = {
  id: "M3", titolo: "Le voci del gruppo tecnico", aree: [], costo: 0,
  contenuto: "Attorno al tavolo, letture diverse degli stessi numeri. Testuali:",
  estratti: [
    { chi: "L'assessora all'ambiente", testo: "I numeri parlano chiaro: Colline consuma il doppio degli altri. Si parte da lì." },
    { chi: "Il dirigente dei lavori pubblici", testo: "Attenzione, quel 6% di perdite è una stima del 2019. Non lo misura nessuno da allora." },
    { chi: "La responsabile dei servizi sociali", testo: "A San Rocco ci sono 19.400 persone. Se chiudete l'acqua di notte, chi ha un serbatoio se ne accorge e chi non ce l'ha resta a secco." },
    { chi: "Un agricoltore, invitato", testo: "Il mio 17% lo uso in tre settimane. Se me lo tagliate adesso il raccolto è perso, se me lo tagliate a settembre non me ne accorgo nemmeno." },
    { chi: "Il sindaco", testo: "Io venerdì firmo. Ditemi cosa firmo." },
  ],
};
const W_M4: Materiale = { id: "M4", titolo: "Rilievo delle perdite di rete (giugno, mai pubblicato)", aree: ["edilizia-architettura", "informatica-digitale"], costo: 1, contenuto: "Misurazione notturna su 8 settori: la perdita reale è il 22%, non il 6% stimato nel 2019. Concentrata su due condotte del 1961 nel settore ovest. Riparazione: 4 settimane, 340.000 €. Il 22% significa che più di un quinto dell'acqua non arriva a nessuno: recuperarne anche metà vale più di qualunque restrizione ai cittadini." };
const W_M5: Materiale = { id: "M5", titolo: "Composizione del consumo di Colline", aree: ["agrifood-ambiente", "energia-sostenibilita"], costo: 1, contenuto: "Dei 310 l pro capite: 96 l uso domestico interno (in linea con gli altri quartieri), 214 l per irrigazione di giardini e riempimento piscine. A Colline non si consuma di più in casa: si consuma fuori." };
const W_M6: Materiale = { id: "M6", titolo: "Studio sui serbatoi domestici", aree: ["edilizia-architettura", "giurisprudenza-pa"], costo: 1, contenuto: "A San Rocco l'82% degli alloggi non ha serbatoio di accumulo; a Colline ce l'ha il 91%. Una chiusura notturna della rete non colpisce tutti allo stesso modo: chi ha il serbatoio non se ne accorge." };
const W_M7: Materiale = { id: "M7", titolo: "Il ciclo dell'agricoltura locale", aree: ["agrifood-ambiente"], costo: 1, contenuto: "Le colture della zona hanno il fabbisogno concentrato tra il 10 luglio e il 5 agosto. Dopo il 20 agosto il consumo agricolo crolla naturalmente dell'80%. Siamo al 14 agosto: tagliare l'agricolo adesso ha effetto quasi nullo sul risparmio e grosso sul raccolto." };
const W_M8: Materiale = { id: "M8", titolo: "Consumi degli edifici pubblici, dettaglio", aree: ["giurisprudenza-pa", "energia-sostenibilita"], costo: 1, contenuto: "L'8% si divide in: 3,1% impianti sportivi (di cui la piscina comunale, chiusa da giugno ma con ricircolo attivo), 2,4% scuole (vuote ad agosto, ma con irrigazione dei giardini programmata), 1,6% uffici, 0,9% fontane ornamentali. Quasi tutto l'8% è acqua che esce per nessuno: risparmio a costo zero, senza colpire un cittadino." };
const W_M9: Materiale = { id: "M9", titolo: "Le previsioni meteo, per esteso", aree: ["scienze-ricerca"], costo: 1, contenuto: "Modello a 6 settimane: probabilità di precipitazioni significative 15-20%. Nota metodologica: l'affidabilità dei modelli oltre le 3 settimane è bassa; il documento stesso raccomanda di rivedere le stime ogni 10 giorni. Il «niente piogge per sei settimane» è più incerto di come viene raccontato." };
const W_M10: Materiale = { id: "M10", titolo: "Precedenti ordinanze in altri comuni", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Tre casi: divieto di irrigazione (efficacia alta, contenzioso alto); riduzione di pressione notturna (efficacia media, poche proteste ma danni ai vecchi impianti); tariffa progressiva sui consumi eccedenti (efficacia alta ma richiede 3 mesi per entrare in vigore)." };
const W_M11: Materiale = { id: "M11", titolo: "Il quadro normativo dell'ordinanza sindacale", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "L'ordinanza contingibile e urgente deve essere proporzionata e temporanea, e non può discriminare per quartiere se non su base tecnica documentata. Tradotto: si può colpire un tipo di uso (irrigazione, piscine), non un quartiere." };
const W_M12: Materiale = { id: "M12", titolo: "Costi e tempi degli interventi", aree: ["economia-management", "edilizia-architettura"], costo: 1, contenuto: "Riparazione condotte settore ovest: −11% del totale, 4 settimane, 340.000 €. Divieto irrigazione e piscine: −8%, immediato, 0 €. Chiusura notturna della rete: −6%, immediato, 0 €. Stop irrigazione scuole + ricircolo piscina + fontane: −5%, immediato, 0 €. Campagna informativa: −2% (stimato, incerto), 2 settimane, 18.000 €. Tariffa progressiva: −9%, 3 mesi, 25.000 €." };
const W_M13: Materiale = { id: "M13", titolo: "La lettera di un cittadino di San Rocco", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "«Tre anni fa avete chiuso l'acqua di notte per due settimane. Al quarto piano non arrivava nemmeno di giorno. Ho una figlia con una malattia renale che deve bere e lavarsi. Nessuno ci ha avvisati con più di ventiquattro ore.»" };

const W_MANDATI: Mandato[] = [
  {
    id: "perdite", label: "«Il problema è quanto se ne perde»", frase: "Prima di chiedere sacrifici, tappiamo i buchi.",
    aree: ["edilizia-architettura", "informatica-digitale"],
    vincolo: { id: "chiusura_settore", testo: "La riparazione richiede di chiudere un settore per 3 giorni: 9.000 persone senz'acqua per lavori." },
    consulenze: [
      consulenza("W_dirigente", "Consulenza: il dirigente dei lavori pubblici", "edilizia-architettura", "C'è un rilievo di giugno mai pubblicato: le perdite reali sono il 22%, non il 6%. Prima di chiudere l'acqua ai cittadini, guardate quanta se ne perde sottoterra."),
      consulenza("W_idraulico", "Consulenza: un ingegnere idraulico", "informatica-digitale", "Le perdite sono su due condotte del 1961 nel settore ovest. Ripararle vale l'11% del totale: più di qualunque restrizione ai cittadini, ma servono 4 settimane."),
    ],
  },
  {
    id: "usofuori", label: "«Il problema è quanto se ne usa fuori casa»", frase: "Giardini e piscine non sono un bisogno.",
    aree: ["agrifood-ambiente", "giurisprudenza-pa"],
    vincolo: { id: "ricorso", testo: "Arriva un ricorso di un consorzio di proprietari: l'ordinanza va motivata meglio." },
    consulenze: [
      consulenza("W_legale", "Consulenza: un legale del Comune", "giurisprudenza-pa", "L'ordinanza può colpire un uso — irrigazione, piscine — non un quartiere. Se scrivete «Colline» invece di «giardini», cade al primo ricorso."),
      consulenza("W_agronomo", "Consulenza: un agronomo", "agrifood-ambiente", "A Colline i 310 litri non sono consumo domestico: 214 sono giardini e piscine. Colpire quell'uso è chirurgico; colpire il quartiere è ingiusto e illegittimo."),
    ],
  },
  {
    id: "chipaga", label: "«Il problema è chi paga il conto»", frase: "Ogni misura colpisce qualcuno più di altri.",
    aree: [],
    vincolo: { id: "sanitarie", testo: "Emergono 31 utenze con necessità sanitarie che non possono subire interruzioni." },
    consulenze: [
      consulenza("W_sociali", "Consulenza: la responsabile dei servizi sociali", "salute-professioni-sanitarie", "A San Rocco l'82% non ha un serbatoio. Una chiusura notturna «uguale per tutti» la pagano solo loro: chi ha l'accumulo non se ne accorge nemmeno."),
      consulenza("W_medico", "Consulenza: un medico", "salute-professioni-sanitarie", "Ci sono utenze che non possono restare senz'acqua: dialisi, malattie renali. Vanno censite e protette prima di firmare qualunque cosa."),
    ],
  },
  {
    id: "misurare", label: "«Il problema è che non stiamo misurando»", frase: "Decidiamo su dati vecchi di sei anni.",
    aree: ["scienze-ricerca", "informatica-digitale"],
    vincolo: { id: "misuratori", testo: "Installare i misuratori richiede 10 giorni: il sindaco firma venerdì comunque." },
    consulenze: [
      consulenza("W_ricercatrice", "Consulenza: una ricercatrice", "scienze-ricerca", "Il «6% di perdite» è del 2019 e la previsione meteo a sei settimane è debole: il documento stesso dice di rivederla ogni dieci giorni. Non firmate una sentenza, firmate una cosa rivedibile."),
      consulenza("W_contatori", "Consulenza: un tecnico dei contatori", "informatica-digitale", "Metà di questi numeri sono stime. Con dieci giorni installo i misuratori e sapete davvero dove va l'acqua — ma il sindaco firma venerdì lo stesso."),
    ],
  },
  {
    id: "pernessuno", label: "«Il problema è l'acqua che esce per nessuno»", frase: "Scuole vuote, piscina chiusa, fontane accese.",
    aree: ["energia-sostenibilita", "giurisprudenza-pa"],
    vincolo: { id: "concessionari", testo: "Tre impianti sono gestiti da concessionari privati: servono accordi, non ordinanze." },
    consulenze: [
      consulenza("W_impianti", "Consulenza: il responsabile degli impianti", "energia-sostenibilita", "Le scuole vuote hanno l'irrigazione programmata, la piscina chiusa ha il ricircolo acceso, le fontane vanno. È il 5% che esce per nessuno: si ferma subito, a costo zero."),
      consulenza("W_custode", "Consulenza: il custode delle scuole", "energia-sostenibilita", "I giardini delle scuole si innaffiano da soli anche ad agosto, con dentro nessuno. Basta staccare i timer: nessun cittadino se ne accorge."),
    ],
  },
];

const MD08: MissioneDef = {
  meta: {
    slug: SLUG_ACQUA,
    titolo: "La città senz'acqua",
    sottotitolo: "Montebrico, un'ordinanza da firmare entro venerdì",
    descrizione:
      "Montebrico, 61.000 abitanti. L'invaso che rifornisce la città è al 38% della capacità (media di agosto: 71%), e non pioverà per settimane. Il sindaco deve firmare un'ordinanza entro venerdì: ridurre i consumi del 20% «senza colpire sempre gli stessi». Tu sei nel gruppo tecnico, con davanti i dati di consumo di tutta la città. Ma i dati sembrano dire una cosa e ne dicono un'altra: il quartiere che consuma di più non è quello che spreca di più, e la perdita più grande non è in casa di nessuno. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["scienze-ricerca", "energia-sostenibilita", "informatica-digitale", "giurisprudenza-pa", "edilizia-architettura", "agrifood-ambiente"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [W_M1, W_M2, W_M3],
  materialiGettone: [W_M4, W_M5, W_M6, W_M7, W_M8, W_M9, W_M10, W_M11, W_M12, W_M13],
  mandati: W_MANDATI,
  prioritaVoci: [
    { id: "invaso", label: "L'invaso è al 38% della capacità", aree: ["scienze-ricerca"], affidabilita: 0.95 },
    { id: "colline_310", label: "Colline consuma 310 litri pro capite", aree: ["agrifood-ambiente"], affidabilita: 0.9 },
    { id: "colline_spreca", label: "Colline spreca più degli altri", aree: ["agrifood-ambiente"], affidabilita: 0.25 },
    { id: "perdite_6", label: "Le perdite di rete sono il 6%", aree: ["edilizia-architettura"], affidabilita: 0.2 },
    { id: "non_piove", label: "Non pioverà per sei settimane", aree: ["scienze-ricerca"], affidabilita: 0.3 },
    { id: "agricolo_17", label: "Il consumo agricolo è il 17% del totale", aree: ["agrifood-ambiente"], affidabilita: 0.6 },
  ],
  ruoli: [
    { id: "cantieri", label: "Seguire i cantieri sulle condotte", area: "edilizia-architettura" },
    { id: "cittadini", label: "Tenere i rapporti con i cittadini", area: "giurisprudenza-pa" },
    { id: "controlli", label: "Controllare che le misure vengano rispettate", area: "informatica-digitale" },
    { id: "dati", label: "Aggiornare i dati ogni dieci giorni", area: "scienze-ricerca" },
    { id: "sanitarie", label: "Gestire le utenze con necessità sanitarie", area: "salute-professioni-sanitarie" },
  ],
  passi: [
    { id: "mappatura_perdite", label: "Completare la mappatura delle perdite" },
    { id: "sostituire_condotte", label: "Sostituire le condotte più vecchie" },
    { id: "misuratori_permanenti", label: "Installare misuratori permanenti" },
    { id: "incentivare_serbatoi", label: "Incentivare i serbatoi dove mancano" },
    { id: "rivedere_tariffa", label: "Rivedere la tariffa" },
    { id: "alberi", label: "Piantare alberi per l'isola di calore" },
    { id: "censire_sanitarie", label: "Censire le utenze sanitarie" },
    { id: "pubblica_dati", label: "Pubblicare i dati di consumo aperti" },
  ],
  budget: { totale: () => 0, unita: "€", passo: 1000, voci: () => [] },
  piano: {
    unitaSoldi: "€",
    obiettivo: 20,
    unitaObiettivo: "punti",
    lavori: (letti) => {
      const lavori: Lavoro[] = [];
      if (letti.has("M4")) lavori.push({ id: "riparazione", label: "Avviare la riparazione delle condotte (settore ovest)", aree: ["edilizia-architettura", "informatica-digitale"], costo: 340000, giorni: 28, risparmio: 11, gate: "M4" });
      lavori.push({ id: "divieto_irrigazione", label: "Divieto di irrigazione dei giardini e riempimento piscine", aree: ["agrifood-ambiente", "giurisprudenza-pa"], costo: 0, giorni: 0, risparmio: 8 });
      lavori.push({ id: "chiusura_notturna", label: "Chiusura notturna della rete, uguale per tutti", aree: ["giurisprudenza-pa"], costo: 0, giorni: 0, risparmio: 6 });
      if (letti.has("M8")) lavori.push({ id: "consumi_pubblici", label: "Stop ai consumi pubblici inutili (scuole, piscina, fontane)", aree: ["energia-sostenibilita", "giurisprudenza-pa"], costo: 0, giorni: 0, risparmio: 5, gate: "M8" });
      lavori.push({ id: "taglio_agricolo", label: "Taglio dell'acqua agricola", aree: ["agrifood-ambiente"], costo: 0, giorni: 0, risparmio: 3 });
      lavori.push({ id: "campagna", label: "Campagna informativa (effetto incerto)", aree: ["comunicazione-media"], costo: 18000, giorni: 14, risparmio: 2 });
      lavori.push({ id: "tariffa", label: "Tariffa progressiva (entra in vigore in 3 mesi)", aree: ["giurisprudenza-pa"], costo: 25000, giorni: 90, risparmio: 9 });
      return lavori;
    },
  },
  scarto: (letti) => [
    { id: "chiusura_notturna", label: "Chiusura notturna della rete, uguale per tutta la città", aree: ["giurisprudenza-pa"], qualita: 0.05, trappola: true, avviso: letti.has("M6") ? "Lo studio sui serbatoi (che hai letto): a Colline il 91% ha un serbatoio, a San Rocco l'82% no. «Uguale per tutti» significa che la paga solo chi non ha l'accumulo." : undefined },
    { id: "ordinanza_colline", label: "Ordinanza che limita i consumi nel quartiere Colline", aree: ["giurisprudenza-pa"], qualita: 0.1, avviso: letti.has("M11") ? "Il quadro normativo (che hai letto): un'ordinanza può colpire un uso, non un quartiere. Cadrebbe al primo ricorso." : undefined },
    { id: "rinviare", label: "Rinviare tutto in attesa di dati migliori", aree: ["scienze-ricerca"], qualita: 0.15 },
    { id: "taglio_agricolo", label: "Taglio dell'acqua agricola", aree: ["agrifood-ambiente"], qualita: 0.2, avviso: letti.has("M7") ? "Il ciclo agricolo (che hai letto): a metà agosto il fabbisogno è quasi finito. Un sacrificio grosso per un risparmio quasi nullo." : undefined },
    { id: "tariffa", label: "Tariffa progressiva sui consumi", aree: ["giurisprudenza-pa"], qualita: 0.3 },
    { id: "divieto_irrigazione", label: "Divieto di irrigazione dei giardini e riempimento piscine", aree: ["agrifood-ambiente"], qualita: 0.85 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["Giovedì, 17:40. Il sindaco entra senza bussare: «Domattina alle nove firmo. Cosa firmo?»"];
    if (m) parti.push(m.vincolo.testo);
    if (!letti.has("M4")) parti.push("E il dirigente dei lavori pubblici deposita agli atti un rilievo di giugno mai pubblicato: le perdite di rete sono al 22%, non al 6%. Ma il piano è già impostato su altro.");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Sala riunioni del Comune, 14 agosto, trentasei gradi. Sul proiettore c'è una tabella con cinque righe: i quartieri di Montebrico e quanta acqua consuma ciascuno.\n\nL'assessora la indica: «Colline, trecentodieci litri a testa. Gli altri stanno sotto centosessanta. Direi che il problema è evidente.» Il dirigente dei lavori pubblici non dice niente, ma non sembra d'accordo.",
    introS2: "Il sindaco firma venerdì: avete quattro giorni. Quattro giorni sono cinque verifiche: un rilievo da tirare fuori dal cassetto, un tecnico da sentire, una tabella da disaggregare, una norma da leggere.\n\nCinque. Quello che non verificate, lo deciderete su una stima del 2019.",
    introS4: "Venerdì, 8:20. Il sindaco ha la penna in mano e davanti a sé un foglio bianco con l'intestazione del Comune. Quello che scrivete lo leggeranno sessantunmila persone, e una di loro ha una figlia che deve bere e lavarsi.",
    introS5: "L'ordinanza è firmata. Nelle prossime settimane si vedrà se il 20% arriva davvero. Ma una cosa la sapete già: quali numeri avete davvero verificato, e quali avete solo creduto.",
    materiali: { titolo: "Prima di tutto: cosa dicono i dati?", prompt: "Apri i documenti che vuoi leggere. C'è il consumo per quartiere, quello per tipo di utenza e le voci del gruppo tecnico.", hint: "Fermati su come sono scritti i numeri: un «dichiarato» accanto a una percentuale è la parola più importante della tabella." },
    priorita: { titolo: "Alcune di queste i dati le DIMOSTRANO, altre sono interpretazioni. Ordinatele.", prompt: "Da «più solida» a «più fragile». Attenzione: consumare non è sprecare, e una stima del 2019 non è una misura di oggi.", hint: "Una misura diretta vale più di una stima vecchia, e una stima più di un'interpretazione." },
    mandato: { titolo: "Il sindaco chiede su cosa state lavorando. Una frase.", prompt: "È la lettura del problema che deciderà cosa andrete a verificare.", hint: "Nessuna è quella giusta. Ma i dati sembrano dire una cosa e ne dicono un'altra." },
    informazioni: { titolo: "Avete 5 gettoni. Cosa andate a verificare?", prompt: "Ogni verifica costa un gettone e non torna indietro. Aprila per leggerla: quello che non verifichi, lo decidi su una stima del 2019.", hint: "Puoi restare sulla tua ipotesi o guardarti intorno: a volte il dato che conta è quello che nessuno ha più misurato." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di non verificare: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Serve il 20% in meno. Componete il pacchetto di misure.", prompt: "Non c'è un tetto da non superare: c'è un traguardo da raggiungere. La somma dei risparmi delle misure che scegli deve arrivare a 20 punti — rispettando i tempi dell'emergenza e senza far pagare sempre gli stessi.", hint: "Guarda anche tempo e costo di ogni misura: una che entra in vigore fra tre mesi non serve a questa emergenza." },
    scarto: { titolo: "Tre misure non reggono. Tagliatene due.", prompt: "Rinuncia a due delle misure sul tavolo. Attenzione: la più «equa» sulla carta può essere la più ingiusta nei fatti.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Chi segue cosa da domani?", prompt: "Per ogni compito: te ne occupi tu o lo lasci a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scriverla: quanto arriverà davvero al 20%?", prompt: "Quanto pensate che questo pacchetto di misure arriverà davvero al 20% di risparmio?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete il testo dell'ordinanza (max 120 parole)", prompt: "Cosa cambia per i cittadini, per quanto tempo, e perché proprio queste misure. La leggeranno in sessantunmila.", hint: "Indica una scadenza e un riesame, cita solo numeri che hai verificato, niente allarmismi né appelli generici.", minCaratteri: 150 },
    riflessione: { titolo: "Ripensando a questi quattro giorni…", prompt: "C'è stato un numero che all'inizio sembrava dire una cosa e poi ne diceva un'altra? E vi è capitato di essere sicuri di qualcosa prima di averlo verificato?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Passata l'emergenza, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "Il problema vero era che nessuno stava misurando." },
  },
};

// =====================================================================
// MISSIONE 09 — "Il palco cambia programma" (Sant'Elia)
// =====================================================================

const N_M1: Materiale = { id: "M1", titolo: "Il programma e le risorse", aree: [], costo: 0, contenuto: "21:00 banda locale (30', confermata). 21:40 gruppo teatrale «I Rimasti» (40', confermato). 22:30 Filarmonica di Sant'Elia (60', ma 23 elementi su 34). 23:40 fuochi d'artificio (15', pagati). Risorse: piazza col palco montato, service audio-luci pagato fino all'una, 6 volontari, 2 addetti alla sicurezza, un bar della Pro Loco." };
const N_M2: Materiale = {
  id: "M2", titolo: "Le telefonate del pomeriggio", aree: [], costo: 0,
  contenuto: "Attorno al tavolo della Pro Loco, letture diverse dello stesso guaio. Testuali:",
  estratti: [
    { chi: "Il direttore della Filarmonica", testo: "Con ventitré non facciamo il programma. Tre pezzi, quattro al massimo. Ma preferirei non salire proprio, piuttosto che fare brutta figura." },
    { chi: "La presidente della Pro Loco", testo: "I fuochi sono pagati. Se salta tutto il resto, almeno quelli li facciamo." },
    { chi: "Nadia, del gruppo teatrale", testo: "Noi possiamo allungare, abbiamo altri venti minuti pronti. Ma è roba in dialetto stretto." },
    { chi: "Il maresciallo", testo: "L'autorizzazione della piazza scade all'una. All'una spegnete, qualunque cosa stiate facendo." },
    { chi: "L'animatrice del centro estivo", testo: "I nostri duecento ragazzi vengono di sicuro. Metà non parla italiano." },
  ],
};
const N_M3: Materiale = { id: "M3", titolo: "Il budget, chiuso", aree: [], costo: 0, contenuto: "14.200 € già impegnati e in gran parte spesi. Residuo disponibile: 380 €. Nessuna integrazione possibile: il contributo comunale è vincolato al preventivo approvato." };
const N_M4: Materiale = { id: "M4", titolo: "Il regolamento dell'autorizzazione di pubblico spettacolo", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "L'autorizzazione copre il programma depositato in Comune il 30 giugno. Le variazioni di contenuto sono ammesse; quelle che modificano capienza, orari o disposizione del pubblico richiedono una nuova comunicazione con 48 ore di preavviso. Ne mancano ventiquattro. Tradotto: qualunque idea che sposti la gente o cambi l'orario è irrealizzabile." };
const N_M5: Materiale = { id: "M5", titolo: "Cosa sa fare la Filarmonica con 23 elementi", aree: ["musica-spettacolo"], costo: 1, contenuto: "L'organico ridotto esclude i pezzi sinfonici ma consente il repertorio bandistico e quattro arrangiamenti già eseguiti l'anno scorso, di cui uno molto noto. Il direttore lo sa ma non l'ha proposto: si vergogna di «fare il minore». Chi lo legge può proporre un compromesso che salva la Filarmonica invece di eliminarla." };
const N_M6: Materiale = { id: "M6", titolo: "Il centro estivo internazionale", aree: ["scienze-educazione"], costo: 1, contenuto: "200 ragazzi tra 14 e 19 anni, 11 nazionalità, il 54% non parla italiano. Sono in paese da due settimane e hanno già preparato, per conto loro, quattro brani corali in cinque lingue: 18 minuti. Costa zero, riempie un buco, e trasforma il problema del pubblico in un contenuto." };
const N_M7: Materiale = { id: "M7", titolo: "Il gruppo teatrale, in dettaglio", aree: ["musica-spettacolo", "lingue-relazioni-internazionali"], costo: 1, contenuto: "I venti minuti in più sono un pezzo comico in dialetto stretto. Funziona benissimo con il pubblico locale e non funziona affatto con chi non è del posto. Nadia: «Se ci sono i ragazzi stranieri, quei venti minuti sono venti minuti di silenzio»." };
const N_M8: Materiale = { id: "M8", titolo: "Il contratto del service audio-luci", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Pagato fino all'01:00. Ogni ora aggiuntiva: 340 €. Il residuo di cassa è 380 €: si può comprare esattamente un'ora, e resterebbero 40 €. Ma l'autorizzazione della piazza scade all'una comunque. I soldi ci sono, il permesso no." };
const N_M9: Materiale = { id: "M9", titolo: "L'edizione dell'anno scorso", aree: ["musica-spettacolo"], costo: 1, contenuto: "870 presenti. Il momento più applaudito non fu il concerto: fu quando la banda accompagnò a sorpresa il coro dei bambini della parrocchia. Cinque minuti, non erano in programma." };
const N_M10: Materiale = { id: "M10", titolo: "La comunicazione già uscita", aree: ["comunicazione-media"], costo: 1, contenuto: "400 locandine affisse, un post condiviso 210 volte, un annuncio sul giornale locale. Tutte riportano «Concerto della Filarmonica, ore 22:30». Chi arriva alle 22:30 si aspetta quello." };
const N_M11: Materiale = { id: "M11", titolo: "La disponibilità dei volontari", aree: ["musica-spettacolo"], costo: 1, contenuto: "6 volontari, tutti già assegnati (bar, transenne, accoglienza). Nessuno è libero per gestire un cambio di programma sul posto. Due sono disponibili solo fino alle 23:00." };
const N_M12: Materiale = { id: "M12", titolo: "Il precedente dell'edizione 2019", aree: ["musica-spettacolo"], costo: 1, contenuto: "Quell'anno saltò il gruppo principale e si decise di non dire niente fino all'ultimo, sperando in una sostituzione. Il pubblico lo scoprì alle 22:30, in piazza. Le lamentele non furono per il cambio di programma: furono per non essere stati avvisati." };
const N_M13: Materiale = { id: "M13", titolo: "Il meteo", aree: [], costo: 1, contenuto: "Probabilità di rovesci tra le 22:00 e le 23:30: 35%. Il piano pioggia previsto a giugno era «spostare tutto sotto il porticato del municipio»: capienza 250 persone su 900 attese." };

const N_MANDATI: Mandato[] = [
  {
    id: "serata_comunque", label: "«La serata va avanti comunque»", frase: "il pubblico non deve accorgersi del buco.",
    aree: ["ristorazione-turismo"],
    vincolo: { id: "teatro_ritardo", testo: "Il gruppo teatrale arriva in ritardo: uno degli attori è fuori paese fino alle 21:30." },
    consulenze: [
      consulenza("N_presidente", "Consulenza: la presidente della Pro Loco", "ristorazione-turismo", "La gente viene per stare in piazza, non per il programma perfetto. Se il bar gira e i fuochi partono, la serata è salva anche senza il concerto grande."),
      consulenza("N_bar", "Consulenza: il gestore del bar", "ristorazione-turismo", "Un intervallo lungo tra un pezzo e l'altro non è un problema: è quando la gente compra e chiacchiera. Il buco musicale si può riempire anche così."),
    ],
  },
  {
    id: "filarmonica_sale", label: "«La Filarmonica sale lo stesso»", frase: "il paese ha una banda e stasera suona.",
    aree: ["musica-spettacolo"],
    vincolo: { id: "prove", testo: "Il direttore chiede due ore di prova nel pomeriggio, ma la piazza è occupata dal montaggio." },
    consulenze: [
      consulenza("N_direttore", "Consulenza: il direttore della Filarmonica", "musica-spettacolo", "Con ventitré possiamo fare quattro pezzi già rodati l'anno scorso, uno molto noto. Non è il programma, ma è dignitoso. Il problema non è la musica, è che mi vergogno a salire in minoranza."),
      consulenza("N_maestro", "Consulenza: un maestro di musica", "musica-spettacolo", "Un organico ridotto che fa bene quattro pezzi vale più di uno completo che ne sbaglia dieci. E far sparire la banda del paese dalla sua festa è un messaggio pessimo."),
    ],
  },
  {
    id: "entrano_ragazzi", label: "«Facciamo entrare i ragazzi del centro»", frase: "duecento persone che sono qui e nessuno le ha considerate.",
    aree: ["lingue-relazioni-internazionali", "musica-spettacolo"],
    vincolo: { id: "consenso_tutori", testo: "Serve il consenso dei tutori per far salire dei minori sul palco: 4 ore per raccoglierlo." },
    consulenze: [
      consulenza("N_animatrice", "Consulenza: l'animatrice del centro estivo", "lingue-relazioni-internazionali", "Hanno già pronti diciotto minuti di coro in cinque lingue per la festa di fine soggiorno. Sono qui da due settimane, non costano niente, e riempirebbero esattamente il buco delle 22:30."),
      consulenza("N_interprete", "Consulenza: un'interprete", "lingue-relazioni-internazionali", "Metà della piazza stasera non parla italiano. Un coro in cinque lingue non è un riempitivo: è l'unico momento in cui quei duecento ragazzi si sentono parte della festa."),
    ],
  },
  {
    id: "finisca_bene", label: "«Prima di tutto che finisca bene»", frase: "novecento persone in piazza, un temporale possibile.",
    aree: [],
    vincolo: { id: "piano_pioggia", testo: "Il piano pioggia previsto regge 250 persone su 900 attese." },
    consulenze: [
      consulenza("N_maresciallo", "Consulenza: il maresciallo", "sicurezza-difesa", "Il programma è quello depositato, e all'una si spegne. Se dà pioggia e novecento persone corrono sotto un porticato da duecentocinquanta, quello è il vero problema della serata."),
      consulenza("N_sicurezza", "Consulenza: il responsabile sicurezza", "musica-spettacolo", "Con un 35% di rovesci serve decidere prima cosa si fa se piove, non mentre piove. Un annuncio calmo alle 21 vale più di duecento persone che scappano alle 22:40."),
    ],
  },
  {
    id: "diciamo_subito", label: "«Diciamo subito come stanno le cose»", frase: "il pubblico si arrabbia se lo scopre in piazza.",
    aree: ["comunicazione-media"],
    vincolo: { id: "dichiarazione", testo: "Il giornale locale chiede una dichiarazione entro le 18:00 per l'edizione di domani." },
    consulenze: [
      consulenza("N_giornalista", "Consulenza: un giornalista locale", "comunicazione-media", "Se lo dite voi entro le sei, domani esce «la festa si adatta». Se lo scopre la gente in piazza, esce «pasticcio alla festa». La differenza la fate voi adesso."),
      consulenza("N_social", "Consulenza: l'addetto ai social", "comunicazione-media", "Duemilaquattrocento persone seguono la pagina. Un post chiaro adesso raggiunge chi non è ancora uscito di casa: è meglio saperlo dal divano che davanti al palco."),
    ],
  },
];

const MD09: MissioneDef = {
  meta: {
    slug: SLUG_PALCO,
    titolo: "Il palco cambia programma",
    sottotitolo: "La Notte di Mezzagosto, ventiquattr'ore per salvarla",
    descrizione:
      "Festa di paese a Sant'Elia, il 16 agosto, in piazza. Il programma è chiuso da maggio e ruota attorno al concerto della Filarmonica. Sono le 15:40 del 15 agosto quando arriva la telefonata: undici elementi bloccati in trasferta, non rientrano prima del 17. Con ventitré elementi il programma non si può eseguire. E in paese ci sono duecento ragazzi di un centro estivo internazionale che nessuno ha considerato. Il budget è chiuso. Non c'è niente da analizzare e tutto da decidere: cosa scegli di proteggere quando devi rinunciare a qualcosa. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["musica-spettacolo", "arte-design-moda", "ristorazione-turismo", "sicurezza-difesa", "comunicazione-media", "lingue-relazioni-internazionali"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [N_M1, N_M2, N_M3],
  materialiGettone: [N_M4, N_M5, N_M6, N_M7, N_M8, N_M9, N_M10, N_M11, N_M12, N_M13],
  mandati: N_MANDATI,
  prioritaVoci: [
    { id: "piazza_piena", label: "Che la piazza sia piena e la gente stia bene", aree: ["ristorazione-turismo"] },
    { id: "filarmonica_figura", label: "Che la Filarmonica non ci faccia una figuraccia", aree: ["musica-spettacolo"] },
    { id: "ragazzi_parte", label: "Che i ragazzi del centro estivo si sentano parte del paese", aree: ["scienze-educazione"] },
    { id: "tutto_sicuro", label: "Che sia tutto sicuro e finisca senza problemi", aree: [] },
    { id: "serata_ricordo", label: "Che sia una serata che qualcuno si ricorderà", aree: ["arte-design-moda", "musica-spettacolo"] },
  ],
  ruoli: [
    { id: "avvisare", label: "Avvisare il pubblico del cambio", area: "comunicazione-media" },
    { id: "direttore", label: "Stare con il direttore della Filarmonica", area: "musica-spettacolo" },
    { id: "ragazzi", label: "Organizzare i ragazzi del centro estivo", area: "lingue-relazioni-internazionali" },
    { id: "tempi", label: "Tenere i tempi durante la serata", area: "ristorazione-turismo" },
    { id: "pioggia", label: "Gestire il piano pioggia", area: "musica-spettacolo" },
  ],
  passi: [
    { id: "piano_b", label: "Prevedere sempre un piano B per il gruppo principale" },
    { id: "coinvolgere_centro", label: "Coinvolgere il centro estivo fin da maggio" },
    { id: "programma_flessibile", label: "Depositare un programma più flessibile" },
    { id: "piano_pioggia_veri", label: "Rifare il piano pioggia su numeri veri" },
    { id: "piu_volontari", label: "Trovare più volontari" },
    { id: "fondo_imprevisti", label: "Chiedere un fondo per gli imprevisti" },
    { id: "procedura_annunci", label: "Scrivere una procedura per gli annunci al pubblico" },
    { id: "ringraziare", label: "Ringraziare chi ha salvato la serata" },
  ],
  budget: {
    totale: () => 160,
    unita: "minuti",
    passo: 5,
    voci: (m, letti) => {
      const voci: VoceBudget[] = [
        { id: "banda", label: "Banda locale", aree: ["musica-spettacolo"], costoIndicativo: 30 },
        { id: "teatro", label: "Gruppo teatrale", aree: ["musica-spettacolo"], costoIndicativo: 40 },
        { id: "teatro_esteso", label: "Teatro esteso (+20', in dialetto stretto)", aree: ["musica-spettacolo", "lingue-relazioni-internazionali"], costoIndicativo: 20 },
      ];
      if (letti.has("M5")) voci.push({ id: "filarmonica_ridotta", label: "Filarmonica ridotta, quattro pezzi", aree: ["musica-spettacolo"], costoIndicativo: 25, soloSe: "M5" });
      voci.push({ id: "filarmonica_completa", label: "Filarmonica, programma completo (non eseguibile con 23 elementi)", aree: ["musica-spettacolo"], costoIndicativo: 60 });
      if (letti.has("M6")) voci.push({ id: "coro_centro", label: "Coro del centro estivo (5 lingue)", aree: ["lingue-relazioni-internazionali", "musica-spettacolo"], costoIndicativo: 18, soloSe: "M6" });
      voci.push({ id: "intervallo", label: "Intervallo con il bar", aree: ["ristorazione-turismo"], costoIndicativo: 15 });
      voci.push({ id: "ringraziamento", label: "Momento di ringraziamento e spiegazione", aree: ["comunicazione-media"], costoIndicativo: 5 });
      voci.push({ id: "fuochi", label: "Fuochi d'artificio", aree: ["arte-design-moda"], costoIndicativo: 15 });
      return voci;
    },
  },
  scarto: (letti) => [
    { id: "spostare_orari", label: "Spostare tutto un'ora avanti e allungare fino alle due", aree: ["musica-spettacolo"], qualita: 0.05, trappola: true, avviso: letti.has("M4") ? "Il regolamento dell'autorizzazione (che hai letto): cambiare gli orari richiede 48 ore di preavviso e ne mancano ventiquattro, e la piazza scade all'una comunque. I 380 € per l'ora di service non servono a niente." : undefined },
    { id: "cancellare_niente", label: "Cancellare la Filarmonica e non dire niente fino a stasera", aree: ["musica-spettacolo"], qualita: 0.1, avviso: letti.has("M12") ? "Il precedente del 2019 (che hai letto): la gente non si arrabbiò per il cambio, si arrabbiò per averlo scoperto in piazza." : undefined },
    { id: "musica_registrata", label: "Sostituire la Filarmonica con musica registrata", aree: ["musica-spettacolo"], qualita: 0.2 },
    { id: "filarmonica_ridotta_idea", label: "Far salire la Filarmonica ridotta con quattro pezzi", aree: ["musica-spettacolo"], qualita: 0.85 },
    { id: "coro_idea", label: "Chiedere ai ragazzi del centro estivo di fare i loro brani", aree: ["lingue-relazioni-internazionali"], qualita: 0.8 },
    { id: "teatro_idea", label: "Allungare il teatro di venti minuti", aree: ["musica-spettacolo"], qualita: 0.4, avviso: letti.has("M7") ? "Il dettaglio sul teatro (che hai letto): quei venti minuti sono in dialetto stretto, e con metà piazza che non parla italiano sono venti minuti di silenzio." : undefined },
  ],
  introStanza3: (m, letti) => {
    const parti = ["Sono le 18:20. Il sole è ancora alto e in piazza stanno provando le luci."];
    if (m) parti.push(m.vincolo.testo);
    if (!letti.has("M4") || !letti.has("M13")) parti.push("Il maresciallo passa dalla Pro Loco: «Mi raccomando, il programma è quello depositato. E avete visto che danno pioggia?»");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Sono le 15:40 del 15 agosto. Siete in cinque nella saletta della Pro Loco, con il ventilatore che gira e il programma della serata stampato sul tavolo.\n\nIl telefono della presidente squilla. Risponde, ascolta, dice «va bene, capisco», riattacca e vi guarda: «Il pullman della Filarmonica si è fermato a Foligno. Ne mancano undici. Non tornano prima del diciassette.»\n\nFuori qualcuno sta già montando le transenne.",
    introS2: "Sono le 16:00. Prima di decidere qualsiasi cosa potete fare cinque telefonate: chiamare qualcuno, leggere un contratto, controllare un permesso, verificare una disponibilità.\n\nCinque, perché alle 18:00 bisogna aver deciso: dopo, chi doveva sapere non lo saprà in tempo.",
    introS4: "Sono le 19:10. Sul telefono c'è la pagina della festa: duemilaquattrocento persone la seguono, e sulle locandine c'è scritto «Concerto della Filarmonica, ore 22:30».\n\nQuello che scrivete adesso lo leggeranno prima di uscire di casa.",
    introS5: "La serata è decisa. Domani si saprà com'è andata. Ma una cosa la sapete già: cosa avete scelto di proteggere, quando avete capito che qualcosa dovevate lasciarlo andare.",
    materiali: { titolo: "Prima di tutto: cosa avete tra le mani?", prompt: "Apri i documenti: il programma con le risorse, le telefonate del pomeriggio e il budget.", hint: "Fermati sulle telefonate: il direttore della Filarmonica sta dicendo due cose diverse nella stessa frase." },
    priorita: { titolo: "Cinque cose che questa serata dovrebbe essere. Cosa proteggete per primo?", prompt: "Mettile in ordine. Non c'è un ordine giusto: conta cosa scegli di proteggere sapendo già che dovrai rinunciare a qualcosa.", hint: "La prima scelta pesa più delle altre." },
    mandato: { titolo: "La presidente vi chiede una frase per capire dove andiamo. Quale?", prompt: "È la scelta di campo che deciderà cosa andate a verificare e cosa vi troverete davanti.", hint: "Salvare la serata e salvare la Filarmonica non sono la stessa cosa." },
    informazioni: { titolo: "Avete 5 gettoni. Cosa andate a verificare?", prompt: "Ogni telefonata costa un gettone e non torna indietro. Aprila per leggerla: quello che non chiedi adesso, lo decidi a intuito.", hint: "La risorsa che salva la serata potrebbe essere già in paese, e a costo zero." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di non verificare: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Restano 160 minuti di programma tra le 21:00 e le 23:40. Compositelo.", prompt: "Distribuisci i minuti tra gli spazi della serata: il programma deve reggere fino ai fuochi e finire entro l'una. C'è un margine di ±10.", hint: "Un buon programma parla al pubblico che c'è davvero stasera, non a quello di sempre." },
    scarto: { titolo: "Tre idee non stanno in piedi. Tagliatene due.", prompt: "Rinuncia a due delle idee sul tavolo, e di' perché. Attenzione: la più ovvia davanti a un buco può essere la più impossibile.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Da adesso alle nove di stasera, chi fa cosa?", prompt: "Per ogni compito: te ne occupi tu o lo lasci a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scriverlo: come la prenderà la gente?", prompt: "Quanto pensate che il pubblico prenderà bene questo cambio di programma?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete il messaggio al pubblico (max 100 parole)", prompt: "Cosa è successo, cosa vedranno stasera, e perché vale la pena venire lo stesso.", hint: "Di' la verità nella prima frase e nomina una cosa concreta e nuova. Niente «cause di forza maggiore» né entusiasmo posticcio.", minCaratteri: 120 },
    riflessione: { titolo: "Cosa avete deciso di proteggere, alla fine?", prompt: "E c'è qualcosa che avete lasciato andare e che vi dispiace?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Per l'edizione dell'anno prossimo, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "Il guaio di stasera è nato a maggio, non alle 15:40." },
  },
};

// =====================================================================
// MISSIONE 10 — "La classe che non partecipa" (la guida del quartiere)
// =====================================================================

const C_M1: Materiale = { id: "M1", titolo: "Le schede dei sette e lo stato del lavoro", aree: [], costo: 0, contenuto: "Yuri: parla in continuazione, propone idee ogni giorno, non ne finisce nessuna (61 messaggi su 140). Sofia: ha fatto la copertina, l'unica cosa finita, ma da due settimane non scrive più. Amine: parla tre lingue, servirebbe per le traduzioni, non ha mai scritto in chat, presente e in silenzio. Giada: chiede cosa fare, e quando glielo dici lo fa bene, poi si ferma. Tommaso: ha detto due volte «tanto poi la fa qualcun altro», ma è l'unico che ha trovato gli indirizzi (compresi tre sbagliati). Elisa: ha saltato gli ultimi tre incontri, nessuno sa perché. Stato: copertina fatta, 11 indirizzi (3 sbagliati), mappa e testi e traduzioni non iniziati. Mancano due settimane." };
const C_M2: Materiale = {
  id: "M2", titolo: "Estratti dalla chat di gruppo", aree: [], costo: 0,
  contenuto: "Centoquaranta messaggi. Alcuni, testuali:",
  estratti: [
    { chi: "Yuri (lunedì, 23:41)", testo: "raga ho un'idea pazzesca, e se facessimo anche un video??" },
    { chi: "Giada (martedì)", testo: "ok ma io cosa devo fare esattamente? scrivete voi i testi o li scrivo io?" },
    { chi: "Tommaso (martedì)", testo: "tanto alla fine la prof ci passa comunque" },
    { chi: "Sofia (due settimane fa, ultimo messaggio)", testo: "ho caricato la copertina nella cartella. fatemi sapere." },
    { chi: "Elisa (tre settimane fa)", testo: "scusate se non ci sono, ho un casino a casa" },
  ],
};
const C_M3: Materiale = { id: "M3", titolo: "Cosa chiede il progetto", aree: [], costo: 0, contenuto: "Consegna tra 14 giorni: mappa del quartiere, 25 indirizzi verificati con orari e contatti, quattro testi introduttivi, traduzioni in due lingue, impaginazione. Valutazione: individuale sul contributo di ciascuno, collettiva sul risultato." };
const C_M4: Materiale = { id: "M4", titolo: "La conversazione con Amine, se qualcuno gliela chiede", aree: ["lingue-relazioni-internazionali", "scienze-educazione"], costo: 1, contenuto: "Amine è arrivato in Italia due anni fa. Parla arabo, francese e italiano. Non scrive in chat perché ha paura di sbagliare a scrivere in italiano davanti agli altri. Parlando non ha nessun problema. Nessuno gliel'ha mai chiesto. La risorsa più importante del progetto era già dentro il gruppo, muta per imbarazzo." };
const C_M5: Materiale = { id: "M5", titolo: "Il messaggio privato di Elisa", aree: ["salute-professioni-sanitarie", "scienze-educazione"], costo: 1, contenuto: "«Sto seguendo mia nonna, è caduta il mese scorso. Sono a casa da sola con lei tutti i pomeriggi. Non l'ho detto perché non voglio che pensiate che mi tiro indietro.» Può lavorare, ma solo la mattina e da casa. Non è disimpegno: è un vincolo che nessuno conosceva." };
const C_M6: Materiale = { id: "M6", titolo: "Cosa ha detto davvero Tommaso", aree: ["scienze-educazione"], costo: 1, contenuto: "La frase intera, riportata da chi c'era: «Tanto poi la fa qualcun altro, come l'anno scorso, che ho fatto tutto io e alla fine il voto era uguale per tutti.» Non è cinismo: è un precedente." };
const C_M7: Materiale = { id: "M7", titolo: "La verifica degli indirizzi", aree: [], costo: 1, contenuto: "Dei tre sbagliati: uno è chiuso da un anno, uno ha cambiato via, uno esiste ma con orari diversi. Tommaso li ha presi da un elenco online del 2021. Il metodo era sbagliato, non la persona." };
const C_M8: Materiale = { id: "M8", titolo: "La nota della professoressa, per iscritto", aree: ["scienze-educazione"], costo: 1, contenuto: "«Valuto il contributo di ciascuno, non chi ha lavorato di più. Se qualcuno fa tutto da solo, gli altri non hanno un contributo da valutare — e il voto individuale ne risente. Anche il suo.» Fare tutto da soli non è generoso: è la scelta che danneggia tutti, incluso chi la fa." };
const C_M9: Materiale = { id: "M9", titolo: "Il centro di accoglienza", aree: ["lingue-relazioni-internazionali", "salute-professioni-sanitarie"], costo: 1, contenuto: "A chi serve davvero la guida: 40 persone arrivate negli ultimi sei mesi, la maggioranza parla arabo o francese. La responsabile: «La cosa più utile sarebbe sapere dove si mangia con pochi soldi e dove si va se ci si sente male». Le due lingue giuste sono proprio quelle di Amine, e il contenuto va ripensato." };
const C_M10: Materiale = { id: "M10", titolo: "Come lavora Giada", aree: ["scienze-educazione"], costo: 1, contenuto: "Giada non è passiva: esegue benissimo compiti definiti e si blocca su compiti vaghi. Nelle tre occasioni in cui ha ricevuto un'istruzione precisa, ha consegnato in tempo e bene. Non serve motivarla, serve darle un compito con dei confini." };
const C_M11: Materiale = { id: "M11", titolo: "Le idee di Yuri, elencate", aree: ["arte-design-moda"], costo: 1, contenuto: "Undici proposte in tre settimane. Due sono ottime (una mappa disegnata a mano invece che stampata; una pagina di frasi utili con la pronuncia). Nove sono irrealizzabili in due settimane. Nessuno le ha mai selezionate: accolte con «bella idea» e poi dimenticate. Yuri non ha bisogno di essere frenato: ha bisogno che qualcuno scelga." };
const C_M12: Materiale = { id: "M12", titolo: "Il calendario reale delle disponibilità", aree: [], costo: 1, contenuto: "Quando i sette possono davvero lavorare: solo due fasce coincidono per tutti in due settimane. Tutto il resto va fatto in sottogruppi o da soli. Un piano che presuppone incontri di gruppo continui non può esistere." };
const C_M13: Materiale = { id: "M13", titolo: "Il precedente dell'anno scorso", aree: [], costo: 1, contenuto: "Il progetto della 3ªA: una persona fece l'80% del lavoro, il gruppo consegnò in tempo, il voto collettivo fu alto. Tre studenti su sei, quell'anno, non impararono niente — e uno di loro era Tommaso." };

const C_MANDATI: Mandato[] = [
  {
    id: "capire_perche", label: "«Prima capisco perché»", frase: "nessuno è pigro senza motivo.",
    aree: ["salute-professioni-sanitarie"],
    vincolo: { id: "tre_giorni", testo: "Parlare con tutti richiede tre giorni dei quattordici." },
    consulenze: [
      consulenza("C_sostegno", "Consulenza: la prof di sostegno", "scienze-educazione", "Prima di dividere i compiti, guarda chi non partecipa e chiediti perché. Quasi sempre dietro un silenzio c'è un ostacolo concreto, non pigrizia."),
      consulenza("C_educatrice", "Consulenza: un'educatrice", "salute-professioni-sanitarie", "Chi salta gli incontri e chi tace non sono lo stesso problema. Prima capisci la causa, poi decidi: motivare qualcuno che ha un vincolo reale non serve a niente."),
    ],
  },
  {
    id: "compito_preciso", label: "«Prima do a ciascuno un compito preciso»", frase: "il problema è che nessuno sa cosa fare.",
    aree: [],
    vincolo: { id: "riassegnano", testo: "Due assegnano il proprio compito a qualcun altro: il piano va rifatto." },
    consulenze: [
      consulenza("C_tutor", "Consulenza: un tutor", "scienze-educazione", "Metà del gruppo non è svogliata: è persa. Un compito scritto, con confini e una scadenza, sblocca chi si ferma perché non sa da dove iniziare."),
      consulenza("C_referente", "Consulenza: la referente del progetto", "scienze-educazione", "«Fate voi» non è un compito. «Tu i tre indirizzi della via centrale entro venerdì» lo è. La differenza tra un gruppo fermo e uno che si muove sta tutta lì."),
    ],
  },
  {
    id: "sistemo_lavoro", label: "«Prima sistemo il lavoro»", frase: "tra quattordici giorni si consegna.",
    aree: [],
    vincolo: { id: "venticinque", testo: "Gli indirizzi da verificare sono 25, non 11: il lavoro è il triplo del previsto." },
    consulenze: [
      consulenza("C_centro", "Consulenza: la responsabile del centro", "ristorazione-turismo", "La guida serve a chi è appena arrivato: dove si mangia con pochi soldi, dove si va se ci si sente male. Undici indirizzi a caso non bastano, ne servono venticinque veri."),
      consulenza("C_grafico", "Consulenza: un grafico", "arte-design-moda", "Una copertina bella su contenuti sbagliati è tempo perso. Prima si verificano gli indirizzi e si scrivono i testi, poi si impagina: l'ordine conta."),
    ],
  },
  {
    id: "far_parlare", label: "«Prima faccio parlare chi non parla»", frase: "metà del gruppo non ha mai detto la sua.",
    aree: [],
    vincolo: { id: "amine_non_davanti", testo: "Amine accetta di parlare solo se non è davanti a tutti." },
    consulenze: [
      consulenza("C_mediatrice", "Consulenza: una mediatrice", "lingue-relazioni-internazionali", "Chi tace in un gruppo spesso ha di più da dare, non di meno. Ma glielo devi chiedere a quattr'occhi: davanti a tutti il silenzio si difende."),
      consulenza("C_amine", "Consulenza: Amine, se glielo chiedi tu", "lingue-relazioni-internazionali", "Parlo arabo, francese e italiano. Non scrivo in chat perché ho paura di sbagliare a scrivere davanti agli altri. Ma tradurre lo so fare: nessuno me l'ha mai chiesto."),
    ],
  },
  {
    id: "mettere_regole", label: "«Prima mettiamo delle regole»", frase: "senza regole ognuno fa come gli pare.",
    aree: [],
    vincolo: { id: "rifiutano_regole", testo: "Il gruppo rifiuta le prime regole proposte: «non sei mica il prof»." },
    consulenze: [
      consulenza("C_rappresentante", "Consulenza: il rappresentante di classe", "scienze-educazione", "Le regole calate dall'alto in un gruppo di pari non reggono un giorno. Se le decidete insieme, anche solo due o tre, allora si rispettano."),
      consulenza("C_prof", "Consulenza: la prof", "scienze-educazione", "Io non entro: se entro io, il progetto diventa mio. Ma una cosa te la dico: le scadenze intermedie scritte valgono più di qualsiasi regola di comportamento."),
    ],
  },
];

const MD10: MissioneDef = {
  meta: {
    slug: SLUG_CLASSE,
    titolo: "La classe che non partecipa",
    sottotitolo: "Sette studenti, una guida da consegnare, due settimane",
    descrizione:
      "Il progetto di alternanza della 4ªA: sette studenti devono realizzare in cinque settimane una guida del quartiere per chi ci arriva da fuori, che verrà stampata in 300 copie e distribuita davvero. Siamo alla terza settimana e il gruppo ha prodotto una copertina, undici indirizzi (tre sbagliati) e centoquaranta messaggi in chat. La professoressa non entra: «se ci entro io, il progetto diventa mio». Gli altri sei ti hanno chiesto di tenere le fila. È l'unica missione in cui il problema sono le persone e la risorsa scarsa è l'attenzione — e in cui si scopre, solo informandosi, che il gruppo non è pigro: tre persone hanno un motivo concreto per non partecipare, e nessuno gliel'ha chiesto. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["scienze-educazione", "salute-professioni-sanitarie", "lingue-relazioni-internazionali", "comunicazione-media", "sicurezza-difesa", "ristorazione-turismo"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [C_M1, C_M2, C_M3],
  materialiGettone: [C_M4, C_M5, C_M6, C_M7, C_M8, C_M9, C_M10, C_M11, C_M12, C_M13],
  mandati: C_MANDATI,
  prioritaVoci: [
    { id: "chi_fa_cosa", label: "Non è chiaro chi deve fare cosa", aree: ["scienze-educazione"] },
    { id: "chi_parla_chi_no", label: "C'è chi parla molto e chi non parla affatto", aree: ["scienze-educazione"] },
    { id: "chi_manca", label: "Qualcuno non c'è e non sappiamo perché", aree: ["salute-professioni-sanitarie", "scienze-educazione"] },
    { id: "gia_deciso", label: "Qualcuno ha già deciso che tanto non serve impegnarsi", aree: ["scienze-educazione"] },
    { id: "lavoro_poco", label: "Il lavoro fatto finora è poco e in parte sbagliato", aree: [] },
    { id: "mai_insieme", label: "Non ci vediamo mai tutti insieme", aree: ["scienze-educazione"] },
  ],
  ruoli: [], // non usato: questa missione usa assegnaPersone
  assegnaPersone: {
    compiti: [
      { id: "indirizzi", label: "Verificare e completare i 25 indirizzi", area: "" },
      { id: "testi", label: "Scrivere i quattro testi", area: "comunicazione-media" },
      { id: "mappa", label: "Fare la mappa", area: "arte-design-moda" },
      { id: "traduzioni", label: "Curare le traduzioni", area: "lingue-relazioni-internazionali" },
      { id: "impaginazione", label: "Impaginare la guida", area: "arte-design-moda" },
    ],
    persone: [
      { id: "io", nome: "Me ne occupo io" },
      { id: "yuri", nome: "Yuri" },
      { id: "sofia", nome: "Sofia" },
      { id: "amine", nome: "Amine" },
      { id: "giada", nome: "Giada" },
      { id: "tommaso", nome: "Tommaso" },
      { id: "elisa", nome: "Elisa" },
    ],
  },
  passi: [
    { id: "chiedere_cosa_sa", label: "Chiedere a ciascuno cosa sa fare prima di dividere" },
    { id: "scadenze_intermedie", label: "Fissare scadenze intermedie" },
    { id: "scrivere_compiti", label: "Scrivere i compiti invece che dirli" },
    { id: "modo_partecipare", label: "Trovare un modo di partecipare per chi non c'è" },
    { id: "poche_idee", label: "Scegliere poche idee e portarle a termine" },
    { id: "verificare_fonti", label: "Verificare le fonti prima di usarle" },
    { id: "quattrocchi", label: "Parlare a quattr'occhi con chi tace" },
    { id: "chiedere_prof", label: "Chiedere aiuto alla prof quando serve" },
  ],
  budget: {
    totale: () => 9,
    unita: "giornate",
    passo: 1,
    voci: (m, letti) => {
      const voci: VoceBudget[] = [
        { id: "verificare_indirizzi", label: "Verificare e completare i 25 indirizzi", aree: [], costoIndicativo: 2 },
        { id: "scrivere_testi", label: "Scrivere i quattro testi", aree: ["comunicazione-media"], costoIndicativo: 2 },
        { id: "fare_mappa", label: "Fare la mappa", aree: ["arte-design-moda"], costoIndicativo: 1 },
        { id: "curare_traduzioni", label: "Curare le traduzioni", aree: ["lingue-relazioni-internazionali"], costoIndicativo: 1 },
        { id: "impaginare", label: "Impaginare", aree: ["arte-design-moda"], costoIndicativo: 1 },
        { id: "parlare_uno_a_uno", label: "Parlare uno a uno con chi non partecipa", aree: ["scienze-educazione", "salute-professioni-sanitarie"], costoIndicativo: 2 },
      ];
      if (letti.has("M10")) voci.push({ id: "rifare_piano", label: "Rifare il piano con compiti definiti", aree: ["scienze-educazione"], costoIndicativo: 1, soloSe: "M10" });
      if (letti.has("M11")) voci.push({ id: "scegliere_idee", label: "Scegliere quali idee di Yuri realizzare", aree: ["arte-design-moda"], costoIndicativo: 1, soloSe: "M11" });
      if (letti.has("M5")) voci.push({ id: "compito_elisa", label: "Trovare un compito compatibile per Elisa", aree: ["salute-professioni-sanitarie", "scienze-educazione"], costoIndicativo: 1, soloSe: "M5" });
      return voci;
    },
  },
  scarto: (letti) => [
    { id: "faccio_da_solo", label: "Mi metto sotto io e finisco la guida: mancano nove giorni, non c'è tempo per altro", aree: [], qualita: 0.05, trappola: true, avviso: letti.has("M8") ? "La nota della prof (che hai letto): la valutazione è sul contributo di ciascuno. Chi fa tutto lascia gli altri senza contributo da valutare — e abbassa anche il proprio voto." : undefined },
    { id: "dire_prof", label: "Dire alla prof che il gruppo non collabora", aree: [], qualita: 0.15, avviso: undefined },
    { id: "escludere", label: "Escludere chi non partecipa e dividersi il lavoro tra i volenterosi", aree: [], qualita: 0.1 },
    { id: "parlare_spariti", label: "Parlare uno a uno con chi è sparito", aree: ["salute-professioni-sanitarie", "scienze-educazione"], qualita: 0.85 },
    { id: "compiti_scritti", label: "Assegnare a ciascuno un compito scritto con scadenza", aree: ["scienze-educazione"], qualita: 0.8 },
    { id: "ridurre_progetto", label: "Ridurre il progetto a quello che si riesce davvero a fare", aree: [], qualita: 0.6 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["Giovedì, nove giorni alla consegna. Ricevi un messaggio dalla prof: due righe."];
    if (m) parti.push(m.vincolo.testo);
    if (!letti.has("M4")) parti.push("E in chat qualcuno propone di usare un traduttore automatico per le due lingue. Amine, come sempre, non dice niente.");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "Aula 12, quinta ora, la prof è uscita. Siete in sette intorno a due banchi accostati e nessuno parla.\n\nSul portatile di Sofia c'è la cartella del progetto: dentro, una copertina bella e un file di testo con undici indirizzi. Yuri rompe il silenzio: «Raga, e se facessimo anche un video?»\n\nRestano quattordici giorni. E gli altri sei hanno chiesto a te di tenere le fila — non perché tu sia il capo, ma perché qualcuno doveva farlo.",
    introS2: "Hai quattordici giorni e sei persone. Prima di muovere qualsiasi cosa puoi fare cinque cose: una conversazione a quattr'occhi, un messaggio privato, una domanda alla prof, una verifica del lavoro fatto.\n\nCinque. Non puoi parlare con tutti di tutto: dovrai scegliere a chi dedicare attenzione, che qui è la cosa che scarseggia.",
    introS4: "Domenica sera. Nove giorni sono diventati sette. Apri la chat: centoquaranta messaggi sopra il tuo, e il cursore che lampeggia.\n\nQuello che scrivi adesso lo leggeranno tutti e sei, compreso chi non risponde mai.",
    introS5: "Il messaggio è partito. Nei prossimi giorni si vedrà se il gruppo si muove. Ma due cose le hai già capite: quando eri più utile, e cosa c'era dietro a qualcuno che prima ti sembrava solo svogliato.",
    materiali: { titolo: "Prima di tutto: chi sono i sette e a che punto è il lavoro?", prompt: "Apri le schede del gruppo, gli estratti della chat e cosa chiede il progetto.", hint: "Guarda chi non ha mai scritto un messaggio: è l'unica assenza totale in centoquaranta messaggi, ed è l'informazione più forte della chat." },
    priorita: { titolo: "Guardando il gruppo, quali sono i problemi? Mettili in ordine.", prompt: "Da quello che pesa di più. La prima scelta conta più delle altre.", hint: "Non tutti i silenzi sono uguali: qualcuno tace, qualcuno manca, qualcuno si è arreso." },
    mandato: { titolo: "Come pensi di muoverti? Dillo in una frase.", prompt: "È l'approccio che deciderà cosa vai a scoprire e cosa ti troverai davanti.", hint: "Far funzionare il lavoro e far funzionare il gruppo non sempre coincidono." },
    informazioni: { titolo: "Hai 5 gettoni. Cosa vale la pena chiedere?", prompt: "Ogni conversazione o verifica costa un gettone e non torna indietro. Aprila per leggerla: l'attenzione è la cosa che scarseggia.", hint: "Tre delle sette persone hanno un motivo concreto per non partecipare. Nessuno gliel'ha chiesto." },
    nonApprofondire: { titolo: "Una persona a cui hai deciso di non dedicare tempo: perché?", prompt: "Due o tre righe. È una domanda scomoda: conta che tu sappia perché hai scelto di lasciare qualcuno fuori dalla tua attenzione.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Restano nove giorni e sei persone oltre a te. Distribuisci il lavoro.", prompt: "Nove giornate sono le TUE: quanto dedichi a ciascuna cosa, sapendo che gli altri fanno il resto. Il lavoro deve completarsi, ma il gruppo deve anche partecipare.", hint: "Prendersi tutto il lavoro esecutivo funziona per la guida e fallisce per tutto il resto." },
    scarto: { titolo: "Tre modi di procedere non funzionano. Tagliane due.", prompt: "Rinuncia a due, e di' perché. Attenzione: la scelta più generosa e più efficace nel breve può essere quella che danneggia di più.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Sei persone, cinque cose da fare. Chi fa cosa?", prompt: "Assegna ogni compito a una persona del gruppo o a te stesso. La persona giusta al posto giusto vale più di chi lavora di più.", hint: "Quello che hai scoperto informandoti serve proprio qui: dai a ciascuno ciò che sa fare o può fare davvero." },
    previsione: { titolo: "Prima di scriverlo: quanto muoverà il gruppo?", prompt: "Quanto pensi che questo messaggio farà muovere il gruppo?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivi il messaggio al gruppo (max 120 parole)", prompt: "Cosa serve, da chi, entro quando. E qualcosa che riguardi il fatto che siete in sette.", hint: "Assegna cose precise a persone precise con una scadenza. Niente rimproveri al gruppo in blocco, niente richieste vaghe. Lascia una porta aperta a chi è sparito.", minCaratteri: 150 },
    riflessione: { titolo: "In quale momento di queste settimane eri più utile?", prompt: "E c'è stato un momento in cui hai capito qualcosa di qualcuno che prima ti sembrava solo svogliato?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Se doveste rifarlo, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "Quasi tutto quello che è andato storto è cominciato prima di iniziare il lavoro." },
  },
};

// =====================================================================
// MISSIONE 11 — "Il viaggio impossibile" (la 5ªD)
// =====================================================================

const V_M1: Materiale = { id: "M1", titolo: "Il preventivo dell'agenzia", aree: [], costo: 0, contenuto: "3 giorni / 2 notti, 178 € a testa: treno andata e ritorno (orario standard), ostello in camere da 6, colazione inclusa, un ingresso museale, trasporto locale con abbonamento giornaliero. Non incluso: pranzi, cene, ingressi extra." };
const V_M2: Materiale = {
  id: "M2", titolo: "Le voci del gruppo", aree: [], costo: 0,
  contenuto: "Attorno alla cartellina, letture diverse. Testuali:",
  estratti: [
    { chi: "La vicepreside", testo: "Il viaggio si fa se partecipa almeno l'80% della classe. Diciotto su ventidue. Sotto quella soglia si annulla." },
    { chi: "Elena, del gruppo organizzatore", testo: "A 178 siamo già sotto il tetto. Con i 12 euro che avanzano ci prendiamo un secondo ingresso." },
    { chi: "Un genitore rappresentante", testo: "Vi chiedo solo di non fare cose per cui poi qualcuno debba chiedere dei soldi in più all'ultimo." },
    { chi: "Nadir, in corridoio", testo: "Ma tanto l'ostello quasi sicuramente non è accessibile, no? Non vi mettete nei guai per me." },
    { chi: "La segreteria", testo: "La conferma all'agenzia va data entro undici giorni, con l'elenco definitivo." },
  ],
};
const V_M3: Materiale = { id: "M3", titolo: "Il tetto e i conti", aree: [], costo: 0, contenuto: "190 € massimi a testa, preventivo a 178 €. Margine reale: 12 € a testa, cioè 264 € sul gruppo. Quattro compagni hanno segnalato un'esigenza: Nadir (sedia a rotelle, serve accessibilità), Chiara (celiaca certificata), Marco (la famiglia arriva a 150 €, chiede riservatezza), Sara (deve rientrare per le 17 dell'ultimo giorno)." };
const V_M4: Materiale = { id: "M4", titolo: "La verifica di accessibilità dell'ostello", aree: ["mobilita-sostenibile", "salute-professioni-sanitarie"], costo: 1, contenuto: "L'ostello indicato non è accessibile: due rampe di scale, nessun ascensore, bagni non attrezzati. Esiste un'alternativa accessibile a 400 metri: +9 € a testa (198 sul gruppo), stesse camere da 6, colazione inclusa. Costa 9 dei 12 euro di margine, e riguarda una persona sola." };
const V_M5: Materiale = { id: "M5", titolo: "Le condizioni del treno", aree: ["mobilita-sostenibile"], costo: 1, contenuto: "Il treno del preventivo arriva l'ultimo giorno alle 18:40; Sara deve essere a casa per le 17:00. Esiste un treno precedente: stesso prezzo, ma parte 2 ore prima e taglia l'ultima mattinata a tutti. Oppure Sara torna da sola con un treno anticipato: +31 € di biglietto singolo." };
const V_M6: Materiale = { id: "M6", titolo: "La questione dei pasti", aree: ["agrifood-ambiente", "salute-professioni-sanitarie", "ristorazione-turismo"], costo: 1, contenuto: "Pranzi e cene non inclusi: stima 12-15 € al giorno, cioè 36-45 € fuori dal preventivo, a carico delle famiglie. Per Chiara, mangiare senza glutine fuori casa costa in media il 30% in più e richiede locali attrezzati: senza organizzazione, o spende molto di più o non mangia. Il viaggio non costa 178 €, ne costa 215-225. E nessuno l'ha detto a Marco." };
const V_M7: Materiale = { id: "M7", titolo: "La lettera della famiglia di Marco", aree: ["scienze-educazione", "giurisprudenza-pa"], costo: 1, contenuto: "«Oltre i 150 non riusciamo, e non vogliamo che nostro figlio si senta a disagio. Se è un problema, resterà a casa dicendo che non gli andava.» La frase che spiega perché certe persone non chiedono niente." };
const V_M8: Materiale = { id: "M8", titolo: "Il fondo di solidarietà d'istituto", aree: ["giurisprudenza-pa", "economia-management"], costo: 1, contenuto: "Esiste, copre fino al 40% della quota per famiglie che ne fanno richiesta, la domanda si presenta in segreteria ed è riservata: nessuno in classe lo viene a sapere. Va presentata entro dieci giorni. Quest'anno non l'ha chiesta nessuno. Risolve interamente il caso di Marco, a costo zero per il gruppo — ma bisogna sapere che esiste, e dirglielo senza farlo sentire un caso da assistere." };
const V_M9: Materiale = { id: "M9", titolo: "Cosa si può fare in quella città", aree: ["ristorazione-turismo", "arte-design-moda"], costo: 1, contenuto: "Sei possibilità con costi: museo principale 8 € (già incluso), quartiere storico a piedi gratis, mercato coperto gratis, museo scientifico 6 €, giro in battello 11 €, laboratorio artigiano 9 € su prenotazione (max 25 persone). Serve per capire dove finiscono i 12 € di margine." };
const V_M10: Materiale = { id: "M10", titolo: "La normativa sui viaggi d'istruzione", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Le uscite didattiche devono garantire la partecipazione di tutti gli studenti: le barriere architettoniche o economiche note e non affrontate possono costituire discriminazione. Se un solo studente è escluso per una barriera evitabile, il viaggio non è conforme. Non è sensibilità: è una condizione di legittimità." };
const V_M11: Materiale = { id: "M11", titolo: "La regola dell'80%", aree: ["economia-management"], costo: 1, contenuto: "Servono almeno 18 partecipanti. Se Nadir, Marco, Chiara e Sara restassero a casa, i partecipanti sarebbero 18: esattamente la soglia. Il viaggio si farebbe comunque. Il dato più freddo della missione, e il più utile per vedere cosa si sta scegliendo davvero." };
const V_M12: Materiale = { id: "M12", titolo: "Il precedente della 5ªB, due anni fa", aree: ["salute-professioni-sanitarie"], costo: 1, contenuto: "Uno studente in sedia a rotelle non partecipò «per scelta sua». Nella relazione di fine anno si legge che l'ostello non era accessibile e che nessuno glielo comunicò: gli fu chiesto se voleva venire, e lui disse di no. Chiarisce cosa significa davvero la frase di Nadir in corridoio." };
const V_M13: Materiale = { id: "M13", titolo: "La disponibilità dell'agenzia", aree: ["economia-management", "mobilita-sostenibile"], costo: 1, contenuto: "L'agenzia può cambiare ostello senza penale entro undici giorni, e con 25 partecipanti (compresi due accompagnatori) applica una riduzione di 4 € a testa. Sono 22 studenti + 2 accompagnatori = 24: con un accompagnatore in più si scende a 174 €. Guadagno nascosto: libera 4 € a testa, cioè 88 € sul gruppo — quasi metà del costo dell'ostello accessibile." };

const V_MANDATI: Mandato[] = [
  {
    id: "nessuno_resta", label: "«Nessuno resta a casa»", frase: "prima si garantisce che tutti possano venire.",
    aree: ["mobilita-sostenibile", "salute-professioni-sanitarie"],
    vincolo: { id: "camere_quattro", testo: "L'ostello accessibile ha solo camere da 4: la distribuzione dei ventidue va rifatta." },
    consulenze: [
      consulenza("V_accessibilita", "Consulenza: un referente accessibilità", "mobilita-sostenibile", "L'accessibilità non è un extra da concedere: è la condizione perché il viaggio sia legittimo. Se l'ostello non è accessibile, non è «peccato per Nadir», è un viaggio non conforme."),
      consulenza("V_segreteria_a", "Consulenza: la segreteria", "giurisprudenza-pa", "Cambiare ostello si può, senza penale, entro undici giorni. Ma l'elenco definitivo va dato con la conferma: decidete chi viene prima, non dopo."),
    ],
  },
  {
    id: "viaggio_bello", label: "«Il viaggio dev'essere bello»", frase: "è l'ultimo anno, deve valerne la pena.",
    aree: ["ristorazione-turismo", "arte-design-moda"],
    vincolo: { id: "laboratorio_venticinque", testo: "Il laboratorio artigiano accetta max 25 persone e va prenotato subito." },
    consulenze: [
      consulenza("V_operatrice", "Consulenza: un'operatrice turistica", "ristorazione-turismo", "Il museo è già incluso, il quartiere storico e il mercato sono gratis. Con dodici euro a testa non si compra un viaggio migliore: si sceglie una cosa in più, non tre."),
      consulenza("V_exstudente", "Consulenza: un ex studente", "arte-design-moda", "Di quel viaggio non ci si ricorda l'ingresso al museo: ci si ricorda una cosa fatta insieme. Ma se qualcuno resta a casa, non è «bello per la classe», è bello per una parte."),
    ],
  },
  {
    id: "nessuno_spende", label: "«Nessuno deve spendere più del previsto»", frase: "i costi nascosti sono la cosa più ingiusta.",
    aree: ["economia-management"],
    vincolo: { id: "altri_tre", testo: "Emerge che altri tre studenti sono in difficoltà economica e non l'hanno detto." },
    consulenze: [
      consulenza("V_genitore", "Consulenza: un genitore rappresentante", "economia-management", "Il preventivo dice 178, ma coi pasti sono più di 200. Chi arriva a 150 non ce la fa, e non lo dirà mai in classe. Il costo vero va detto prima, non alla partenza."),
      consulenza("V_segreteria_c", "Consulenza: la segreteria", "giurisprudenza-pa", "C'è un fondo d'istituto che copre fino al 40% della quota, riservato. Nessuno in classe lo saprebbe. Ma va chiesto entro dieci giorni, e quest'anno non l'ha fatto nessuno."),
    ],
  },
  {
    id: "prima_chiediamo", label: "«Prima chiediamo, poi decidiamo»", frase: "nessuno di loro dirà cosa gli serve davvero.",
    aree: ["salute-professioni-sanitarie"],
    vincolo: { id: "quattro_giorni", testo: "Parlare con tutti richiede quattro giorni degli undici disponibili." },
    consulenze: [
      consulenza("V_sostegno", "Consulenza: la prof di sostegno", "scienze-educazione", "«Se è complicato resto» non vuol dire «non voglio venire»: vuol dire «non voglio essere un problema». Sono due cose opposte, e le distingui solo se glielo chiedi bene."),
      consulenza("V_nadir", "Consulenza: Nadir, se glielo chiedi tu", "salute-professioni-sanitarie", "Lo so che l'ostello di solito non è accessibile, per questo l'ho detto io per primo. Ma se lo fosse, io ci verrei eccome. Non voglio che vi mettiate nei guai, tutto qui."),
    ],
  },
  {
    id: "tornare_conti", label: "«Facciamo tornare i conti e poi si vede»", frase: "senza numeri chiari ogni discussione è aria.",
    aree: ["economia-management", "mobilita-sostenibile"],
    vincolo: { id: "conferma_anticipo", testo: "L'agenzia chiede la conferma definitiva con tre giorni di anticipo in più." },
    consulenze: [
      consulenza("V_agenzia", "Consulenza: l'agenzia", "economia-management", "Con 25 partecipanti scendo di 4 € a testa: siete in 24, ne basta uno in più. Sono 88 € liberati, quasi l'ostello accessibile. E l'ostello lo cambio senza penale entro undici giorni."),
      consulenza("V_amministrativa", "Consulenza: la segreteria amministrativa", "mobilita-sostenibile", "Il margine vero è 12 € a testa, non i dodici che avanzano da spendere: sono la stessa cifra, ma uno la vedi come «gita più bella» e l'altro come «chi resta fuori». Dipende cosa ci metti dentro."),
    ],
  },
];

const MD11: MissioneDef = {
  meta: {
    slug: SLUG_VIAGGIO,
    titolo: "Il viaggio impossibile",
    sottotitolo: "La 5ªD, tre giorni, e chi rischia di restare a casa",
    descrizione:
      "Il viaggio d'istituto della 5ªD: ventidue studenti, tre giorni, 190 € a testa tutto compreso. Diciotto giorni alla partenza, e la professoressa che doveva organizzare è in maternità. Il gruppo del viaggio — tre studenti, di cui tu — ha in mano un preventivo, una lista di nomi e quattro fogli con le esigenze particolari che nessuno ha letto fino in fondo. Un viaggio scolastico sembra un problema di incastri: non lo è. È un problema di chi ci sta dentro e chi no, e con 190 € a testa non ci sta tutto — ogni cosa che aggiungi per qualcuno la togli a qualcun altro, e le due persone che rischiano di restare fuori non lo diranno mai da sole. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
    tipo: "cross-area",
  },
  areeCandidate: ["ristorazione-turismo", "mobilita-sostenibile", "lingue-relazioni-internazionali", "salute-professioni-sanitarie", "agrifood-ambiente", "economia-management"],
  ruoliStanza: 3,
  daScartare: 2,
  quantiPassi: 3,
  materialiLiberi: [V_M1, V_M2, V_M3],
  materialiGettone: [V_M4, V_M5, V_M6, V_M7, V_M8, V_M9, V_M10, V_M11, V_M12, V_M13],
  mandati: V_MANDATI,
  prioritaVoci: [
    { id: "nadir_accessibile", label: "Nadir: l'ostello dev'essere accessibile", aree: ["mobilita-sostenibile", "salute-professioni-sanitarie"] },
    { id: "chiara_glutine", label: "Chiara: deve poter mangiare senza glutine", aree: ["salute-professioni-sanitarie", "agrifood-ambiente"] },
    { id: "marco_150", label: "Marco: la famiglia arriva a 150 e non oltre", aree: ["economia-management"] },
    { id: "sara_17", label: "Sara: deve rientrare per le 17", aree: ["mobilita-sostenibile"] },
    { id: "altri_diciotto", label: "Gli altri diciotto: che il viaggio sia bello", aree: ["ristorazione-turismo"] },
    { id: "viaggio_si_fa", label: "Che il viaggio si faccia: servono almeno diciotto", aree: ["economia-management"] },
  ],
  ruoli: [
    { id: "agenzia", label: "Parlare con l'agenzia", area: "economia-management" },
    { id: "fondo", label: "Andare in segreteria per il fondo", area: "giurisprudenza-pa" },
    { id: "pasti", label: "Organizzare i pasti", area: "agrifood-ambiente" },
    { id: "nadir", label: "Dirlo a Nadir", area: "salute-professioni-sanitarie" },
    { id: "conti", label: "Tenere i conti", area: "economia-management" },
  ],
  passi: [
    { id: "esigenze_prima", label: "Chiedere le esigenze prima di scegliere la struttura" },
    { id: "fondo_a_tutti", label: "Far conoscere il fondo di solidarietà a tutti" },
    { id: "verificare_accessibilita", label: "Verificare sempre l'accessibilità prima del preventivo" },
    { id: "pasti_preventivo", label: "Mettere i costi dei pasti nel preventivo" },
    { id: "margine_imprevisti", label: "Prevedere un margine per gli imprevisti" },
    { id: "strutture_accessibili", label: "Scegliere strutture accessibili per principio" },
    { id: "esigenze_riservato", label: "Chiedere le esigenze in modo riservato" },
    { id: "raccontare", label: "Raccontare com'è andata a chi organizzerà il prossimo" },
  ],
  budget: { totale: () => 0, unita: "€", passo: 1, voci: () => [] },
  piano: {
    unitaSoldi: "€",
    // Requisito: la CAPIENZA del budget dipende da M13 (sconto agenzia, +88 €).
    budgetSoldi: (letti) => (letti.has("M13") ? 352 : 264),
    lavori: (letti) => {
      const lavori: Lavoro[] = [];
      if (letti.has("M4")) lavori.push({ id: "ostello_accessibile", label: "Ostello accessibile (+9 € a testa)", aree: ["mobilita-sostenibile", "salute-professioni-sanitarie"], costo: 198, giorni: 0, gate: "M4" });
      if (letti.has("M5")) lavori.push({ id: "treno_gruppo", label: "Treno di gruppo anticipato per Sara (costa una mattinata, non soldi)", aree: ["mobilita-sostenibile"], costo: 0, giorni: 0, gate: "M5" });
      lavori.push({ id: "treno_singolo", label: "Biglietto singolo anticipato per Sara (+31 €)", aree: ["mobilita-sostenibile"], costo: 31, giorni: 0 });
      if (letti.has("M6")) lavori.push({ id: "pasti_glutine", label: "Organizzazione dei pasti senza glutine (+45 €)", aree: ["agrifood-ambiente", "salute-professioni-sanitarie"], costo: 45, giorni: 0, gate: "M6" });
      if (letti.has("M8")) lavori.push({ id: "fondo_marco", label: "Domanda al fondo di solidarietà per Marco (0 €, riservata)", aree: ["giurisprudenza-pa", "economia-management"], costo: 0, giorni: 0, gate: "M8" });
      lavori.push({ id: "secondo_ingresso", label: "Secondo ingresso museale (+132 €)", aree: ["ristorazione-turismo"], costo: 132, giorni: 0 });
      lavori.push({ id: "laboratorio", label: "Laboratorio artigiano (+198 €)", aree: ["arte-design-moda", "ristorazione-turismo"], costo: 198, giorni: 0 });
      lavori.push({ id: "battello", label: "Giro in battello (+242 €)", aree: ["ristorazione-turismo"], costo: 242, giorni: 0 });
      lavori.push({ id: "fondo_imprevisti", label: "Fondo per gli imprevisti (40 €)", aree: ["economia-management"], costo: 40, giorni: 0 });
      return lavori;
    },
  },
  scarto: (letti) => [
    { id: "chiedi_nadir", label: "Chiedere a Nadir se preferisce non venire, visto che l'ha già detto lui", aree: ["salute-professioni-sanitarie"], qualita: 0.05, trappola: true, avviso: (letti.has("M10") || letti.has("M12")) ? "Quello che hai letto (la normativa / il precedente della 5ªB): due anni fa un altro studente in sedia a rotelle «scelse di non partecipare», e l'ostello non era accessibile. Chiedere a qualcuno se vuole restare fuori non è chiederglielo: è dirglielo." : undefined },
    { id: "nove_tranne_marco", label: "Far pagare 9 € in più a tutti tranne a Marco", aree: ["economia-management"], qualita: 0.1 },
    { id: "colletta", label: "Fare una colletta in classe per chi non arriva", aree: ["economia-management"], qualita: 0.1 },
    { id: "rinviare_anno", label: "Spostare il viaggio all'anno prossimo", aree: [], qualita: 0.15 },
    { id: "accompagnatore", label: "Chiedere un accompagnatore in più per avere lo sconto", aree: ["economia-management"], qualita: 0.85 },
    { id: "rinuncia_ingresso", label: "Rinunciare al secondo ingresso e mettere quei soldi sull'ostello", aree: ["mobilita-sostenibile"], qualita: 0.8 },
  ],
  introStanza3: (m, letti) => {
    const parti = ["Martedì, sette giorni alla conferma. La segreteria vi chiama per l'elenco definitivo."];
    if (m) parti.push(m.vincolo.testo);
    if (!letti.has("M4")) parti.push("Nadir vi ferma all'uscita: «Ho guardato il sito dell'ostello. Ci sono due rampe di scale. Ve l'ho detto che era complicato.»");
    return parti.join("\n\n");
  },
  testi: {
    introS1: "La cartellina è sul banco, con l'elastico ancora chiuso. Dentro: un preventivo, una lista di ventidue nomi, e quattro fogli con le esigenze particolari.\n\nElena apre il preventivo per prima: «Centosettantotto. Siamo dentro, ottima notizia». Tu apri gli altri quattro fogli. Il primo è di Nadir, e in fondo c'è una riga scritta a penna, più piccola del resto: «se è complicato non fa niente, resto».",
    introS2: "Undici giorni alla conferma. Prima di decidere potete verificare cinque cose: telefonare all'agenzia, controllare un ostello, leggere un regolamento, parlare con la segreteria, chiedere a qualcuno.\n\nCinque. Quello che non chiedete adesso, deciderete a occhio — e a occhio, di solito, resta fuori sempre lo stesso tipo di persona.",
    introS4: "Giovedì sera. La conferma parte domani. Resta una cosa da fare: scrivere alla classe cosa avete deciso.\n\nLo leggeranno in ventidue. Quattro di loro cercheranno il proprio nome.",
    introS5: "La conferma è partita. Tra diciotto giorni si parte. Ma una cosa la sapete già: chi c'è dentro, e cosa avete lasciato andare per far stare tutti.",
    materiali: { titolo: "Prima di tutto: chi sono, e quanto costa?", prompt: "Apri il preventivo, le voci del gruppo e i conti con i quattro fogli delle esigenze.", hint: "Fermati sulla riga a penna di Nadir e su quella in corridoio: sta dicendo due volte la stessa cosa, e nessuna delle due è quello che pensa davvero." },
    priorita: { titolo: "Quattro persone hanno un'esigenza, e i soldi non bastano per tutto. Da chi partite?", prompt: "Mettile in ordine. La prima scelta pesa più delle altre.", hint: "Alcune esigenze si possono rimandare, altre decidono se una persona viene o no." },
    mandato: { titolo: "Elena vi chiede con che criterio decidere. Quale?", prompt: "È il criterio che deciderà cosa andate a verificare e cosa vi troverete davanti.", hint: "Con 190 € a testa non ci sta tutto: ogni cosa che aggiungi la togli a qualcun altro." },
    informazioni: { titolo: "Avete 5 gettoni. Cosa verificate?", prompt: "Ogni verifica costa un gettone e non torna indietro. Aprila per leggerla: quello che non chiedi adesso, lo decidi a occhio.", hint: "Il piano che fa venire tutti e ventidue esiste, ma è nascosto in cinque documenti diversi." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di non verificare: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Il margine è 12 € a testa, cioè 264 € sul gruppo. Componete il piano.", prompt: "Scegliete cosa aggiungere entro il margine. Se avete trovato lo sconto dell'agenzia, il margine sale a 352 €. Ogni scelta per qualcuno la togliete a qualcun altro.", hint: "Le cose che fanno venire tutti valgono più di quelle che rendono il viaggio più bello per venti." },
    scarto: { titolo: "Tre soluzioni non stanno in piedi. Tagliatene due.", prompt: "Rinuncia a due, e di' perché. Attenzione: la più rispettosa in apparenza può essere la più ingiusta nei fatti.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Chi si occupa di cosa nei prossimi sette giorni?", prompt: "Per ogni compito: te ne occupi tu o lo lasci a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scriverlo: nessuno si sentirà un problema?", prompt: "Quanto siete sicuri che nessuno, leggendo questo messaggio, si sentirà un problema da risolvere?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete il messaggio alla classe (max 120 parole)", prompt: "Cosa avete deciso, quanto costa, e cosa succede adesso.", hint: "Presenta le scelte come normali, non come favori. Nessun nome accanto a una difficoltà. L'accessibilità è una caratteristica della struttura, non una concessione.", minCaratteri: 150 },
    riflessione: { titolo: "C'è stato un momento in cui avete capito che qualcuno diceva il contrario di quello che voleva?", prompt: "E c'è qualcosa a cui avete rinunciato che vi dispiace?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "Per il prossimo viaggio della scuola, i primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "Il problema non era questo viaggio: era il modo in cui si organizzano i viaggi." },
  },
};

// ─────────────────────────────────────────── registro delle missioni

const DEFS: MissioneDef[] = [MD01, MD02, MD03, MD04, MD05, MD06, MD07, MD08, MD09, MD10, MD11];
const DEF_BY_SLUG = new Map(DEFS.map((d) => [d.meta.slug, d]));

// Tutti i mandati di tutte le missioni. Gli id dei mandati sono unici a livello
// globale, così mandatoScelto(get) può risolverli senza conoscere lo slug.
const MANDATI_TUTTI: Mandato[] = DEFS.flatMap((d) => d.mandati);

export function getMandato(id: string | undefined): Mandato | null {
  return MANDATI_TUTTI.find((m) => m.id === id) ?? null;
}

// ─────────────────────────────────────────── derivazioni dalle risposte

export function mandatoScelto(get: LeggiRisposta): Mandato | null {
  const p = get("s1_mandato") as PayloadSceltaSingola | undefined;
  return getMandato(p?.opzioneId);
}

// Materiali effettivamente letti: aperti gratis nella Stanza 1 (s1_materiali) +
// comprati coi gettoni nella Stanza 2 (s2_informazioni). Base delle conseguenze.
export function materialiLetti(get: LeggiRisposta): Set<string> {
  const set = new Set<string>();
  const p1 = get("s1_materiali") as PayloadEsplora | undefined;
  for (const id of p1?.letti ?? []) set.add(id);
  const p2 = get("s2_informazioni") as PayloadSeleziona | undefined;
  for (const id of p2?.selezionati ?? []) set.add(id);
  return set;
}

// Dossier acquistabili nella Stanza 2: i materiali a gettone della missione + le
// 2 consulenze del mandato scelto.
export function dossierStanza2(def: MissioneDef, mandato: Mandato | null): Materiale[] {
  return mandato ? [...def.materialiGettone, ...mandato.consulenze] : [...def.materialiGettone];
}

// Valuta un piano di lavori (Missione 04) sulle DUE grandezze e sulle dipendenze.
// Logica pura (nessun punteggio): riusata identica da UI (client) e scoring
// (server). `giorni` tiene conto della seconda squadra: i lavori parallelizzabili
// selezionati girano in contemporanea (contano per il massimo, non per la somma).
export function valutaPiano(step: StepPianificaLavori, selezionati: string[]): {
  soldi: number;
  giorni: number;
  risparmio: number;
  dipendenzeMancanti: { lavoro: string; mancanti: string[] }[];
  secondaSquadra: boolean;
} {
  const sel = new Set(selezionati);
  const scelti = step.lavori.filter((l) => sel.has(l.id));
  const secondaSquadra = sel.has("seconda_squadra");
  const soldi = scelti.reduce((s, l) => s + l.costo, 0);
  const risparmio = scelti.reduce((s, l) => s + (l.risparmio ?? 0), 0);

  const parall = scelti.filter((l) => l.parallelizzabile);
  const seriali = scelti.filter((l) => !l.parallelizzabile && l.id !== "seconda_squadra");
  let giorni = seriali.reduce((s, l) => s + l.giorni, 0);
  if (parall.length > 0) giorni += secondaSquadra ? Math.max(...parall.map((l) => l.giorni)) : parall.reduce((s, l) => s + l.giorni, 0);

  const dipendenzeMancanti: { lavoro: string; mancanti: string[] }[] = [];
  for (const l of scelti) {
    const mancanti = (l.richiede ?? []).filter((id) => !sel.has(id));
    if (mancanti.length > 0) dipendenzeMancanti.push({ lavoro: l.id, mancanti });
  }
  return { soldi, giorni, risparmio, dipendenzeMancanti, secondaSquadra };
}

// ─────────────────────────────────────────── costruzione della missione

// Applica i tag di STILE (assi.ts) a un array di opzioni, per id. Non tocca gli
// `assi` già presenti (es. quelli uniformi delle consulenze) se l'id non è nella
// mappa. Restituisce copie superficiali solo per le opzioni taggate.
function taggaAssi<T extends { id: string; assi?: TagAsse[] }>(arr: T[], mappa: Record<string, TagAsse[]> | undefined): T[] {
  if (!mappa) return arr;
  return arr.map((o) => (mappa[o.id] ? { ...o, assi: mappa[o.id] } : o));
}

function costruisciMissioneDef(def: MissioneDef, get: LeggiRisposta): EscapeMission {
  const mandato = mandatoScelto(get);
  const letti = materialiLetti(get);
  const t = def.testi;
  const idRuoli = `s${def.ruoliStanza}_ruoli`;
  const am = ASSI_MISSIONI[def.meta.slug]; // tag di stile della missione

  const stepMateriali: Step = { id: "s1_materiali", stanza: 1, tipo: "esplora_libero", titolo: t.materiali.titolo, prompt: t.materiali.prompt, hint: t.materiali.hint, materiali: taggaAssi(def.materialiLiberi, am?.materiali) };
  const stepPriorita: Step = { id: "s1_priorita", stanza: 1, tipo: "ordina_priorita", titolo: t.priorita.titolo, prompt: t.priorita.prompt, hint: t.priorita.hint, elementi: def.prioritaVoci };
  const stepMandato: Step = { id: "s1_mandato", stanza: 1, tipo: "scelta_singola", titolo: t.mandato.titolo, prompt: t.mandato.prompt, hint: t.mandato.hint, opzioni: def.mandati.map((m) => ({ id: m.id, label: `${m.label} — ${m.frase}`, aree: m.aree, qualita: 0.7, assi: am?.mandati?.[m.id] ?? m.assi })) };

  const stepInformazioni: Step = { id: "s2_informazioni", stanza: 2, tipo: "seleziona_informazioni", titolo: t.informazioni.titolo, prompt: t.informazioni.prompt, hint: t.informazioni.hint, budget: 5, dossier: taggaAssi(dossierStanza2(def, mandato), am?.materiali) };
  const stepNonApprofondire: Step = { id: "s2_non_approfondire", stanza: 2, tipo: "decisione_scritta", titolo: t.nonApprofondire.titolo, prompt: t.nonApprofondire.prompt, hint: t.nonApprofondire.hint, minCaratteri: 0, facoltativo: true };

  const budgetSoldiRisolto = def.piano ? (typeof def.piano.budgetSoldi === "function" ? def.piano.budgetSoldi(letti) : def.piano.budgetSoldi) : undefined;
  const stepBudget: Step = def.piano
    ? { id: "s3_budget", stanza: 3, tipo: "pianifica_lavori", titolo: t.budget.titolo, prompt: t.budget.prompt, hint: t.budget.hint, unitaSoldi: def.piano.unitaSoldi, budgetSoldi: budgetSoldiRisolto, budgetGiorni: def.piano.budgetGiorni, obiettivo: def.piano.obiettivo, unitaObiettivo: def.piano.unitaObiettivo, lavori: taggaAssi(def.piano.lavori(letti), am?.lavori) }
    : { id: "s3_budget", stanza: 3, tipo: "alloca_budget", titolo: t.budget.titolo, prompt: t.budget.prompt, hint: t.budget.hint, totale: def.budget.totale(mandato, letti), unita: def.budget.unita, passo: def.budget.passo, voci: taggaAssi(def.budget.voci(mandato, letti), am?.voci) };
  const stepScarto: Step = { id: "s3_scarto", stanza: 3, tipo: "scarta_opzione", titolo: t.scarto.titolo, prompt: t.scarto.prompt, hint: t.scarto.hint, daScartare: def.daScartare, opzioni: taggaAssi(def.scarto(letti), am?.scarto) };

  const stepPrevisione: Step = { id: "s4_previsione", stanza: 4, tipo: "previsione_poi_esito", titolo: t.previsione.titolo, prompt: t.previsione.prompt, domanda: t.previsione.domanda };
  const stepProposta: Step = { id: "s4_proposta", stanza: 4, tipo: "decisione_scritta", titolo: t.proposta.titolo, prompt: t.proposta.prompt, hint: t.proposta.hint, minCaratteri: t.proposta.minCaratteri };

  const stepRuoli: Step = def.assegnaPersone
    ? { id: idRuoli, stanza: def.ruoliStanza, tipo: "assegna_persone", titolo: t.ruoli.titolo, prompt: t.ruoli.prompt, hint: t.ruoli.hint, compiti: taggaAssi(def.assegnaPersone.compiti, am?.compiti), persone: def.assegnaPersone.persone }
    : { id: idRuoli, stanza: def.ruoliStanza, tipo: "assegna_ruoli", titolo: t.ruoli.titolo, prompt: t.ruoli.prompt, hint: t.ruoli.hint, ruoli: taggaAssi(def.ruoli, am?.ruoli) };

  const stepRiflessione: Step = { id: "s5_riflessione", stanza: 5, tipo: "riflessione", titolo: t.riflessione.titolo, prompt: t.riflessione.prompt, hint: t.riflessione.hint, minCaratteri: t.riflessione.minCaratteri };
  const stepPassi: Step = { id: "s5_passi", stanza: 5, tipo: "pianifica_passi", titolo: t.passi.titolo, prompt: t.passi.prompt, hint: t.passi.hint, passi: taggaAssi(def.passi, am?.passi), quanti: def.quantiPassi };

  const stanza3Step = def.ruoliStanza === 3 ? [stepBudget, stepScarto, stepRuoli] : [stepBudget, stepScarto];
  const stanza4Step = def.ruoliStanza === 4 ? [stepPrevisione, stepProposta, stepRuoli] : [stepPrevisione, stepProposta];

  return {
    ...def.meta,
    areeCandidate: def.areeCandidate,
    stanze: [
      { numero: 1, titolo: "Il problema", intro: t.introS1, step: [stepMateriali, stepPriorita, stepMandato] },
      { numero: 2, titolo: "Cosa volete sapere", intro: t.introS2, step: [stepInformazioni, stepNonApprofondire] },
      { numero: 3, titolo: "Il vincolo", intro: def.introStanza3(mandato, letti), step: stanza3Step },
      { numero: 4, titolo: "La decisione", intro: t.introS4, step: stanza4Step },
      { numero: 5, titolo: "La riflessione", intro: t.introS5, step: [stepRiflessione, stepPassi] },
    ],
  };
}

// Metadati del catalogo.
export const MISSIONI: MissioneMeta[] = DEFS.map((d) => d.meta);

// Registro area→missione, derivato dalle `areeCandidate` già dichiarate su ogni
// missione (NON un mapping nuovo: è la stessa fonte, esposta in forma leggera).
// `tipo` distingue la missione cross-area (Missione 01, che elenca tutte e 18 le
// aree) dalle mono-tematiche: chi vuole «la missione che somiglia a un'area»
// preferisce una mono-tematica dove quell'area è centrale. Usato dai test (T3).
export const REGISTRO_MISSIONI_AREE: { slug: string; titolo: string; tipo: EscapeMission["tipo"]; areeCandidate: string[] }[] =
  DEFS.map((d) => ({ slug: d.meta.slug, titolo: d.meta.titolo, tipo: d.meta.tipo, areeCandidate: d.areeCandidate }));

// Risolve la missione per slug. Con `get` costruisce il contenuto dinamico dalle
// risposte; senza, la risoluzione di base (catalogo / intro d'avvio).
export function getMissione(slug: string, get?: LeggiRisposta): EscapeMission | undefined {
  const def = DEF_BY_SLUG.get(slug);
  if (!def) return undefined;
  return costruisciMissioneDef(def, get ?? (() => undefined));
}

// Definizione grezza della missione (server: usata da restituzione.ts).
export function getMissioneDef(slug: string): MissioneDef | undefined {
  return DEF_BY_SLUG.get(slug);
}

export type { MissioneDef };

// Elenco piatto degli step di una missione (comodo per il player e il motore).
export function stepDellaMissione(mission: EscapeMission): Step[] {
  return mission.stanze.flatMap((s) => s.step);
}

// Accessore che legge da una Map (usata lato server: risposte dal DB).
export function accessoreDaMappa(mappa: Map<string, Payload>): LeggiRisposta {
  return (id) => mappa.get(id);
}
