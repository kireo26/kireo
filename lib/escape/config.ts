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
  EscapeMission,
  Lavoro,
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
  Ruolo,
  Step,
  StepPianificaLavori,
  VoceBudget,
} from "./tipi";

export const SLUG_QUARTIERE = "progetto-quartiere";
export const SLUG_MEDIATECA = "crisi-mediateca";
export const SLUG_SERRA = "guasto-serra";
export const SLUG_CANTIERE = "cantiere-scuola";

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
    totale: (m: Mandato | null) => number;
    unita: string;
    passo: number;
    voci: (m: Mandato | null, letti: Set<string>) => VoceBudget[];
  };
  // Se presente, la Stanza 3.1 è un "pianifica_lavori" (doppio budget soldi+
  // giorni + dipendenze) invece di un "alloca_budget". L'id dello step resta
  // comunque "s3_budget" (canonico). Missione 04.
  piano?: {
    budgetSoldi: number;
    budgetGiorni: number;
    lavori: (letti: Set<string>) => Lavoro[];
  };
  scarto: (letti: Set<string>) => OpzioneScarto[];
  introStanza3: (m: Mandato | null, letti: Set<string>) => string;
  testi: DefTesti;
};

function consulenza(id: string, titolo: string, area: string, contenuto: string): Materiale {
  return { id, titolo, aree: [area], costo: 1, contenuto };
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
const Q_M8: Materiale = { id: "M8", titolo: "Indagine sui bisogni giovanili", aree: ["scienze-educazione", "salute-professioni-sanitarie"], costo: 1, contenuto: "214 questionari agli under 25: 68% «non c'è niente da fare la sera»; 41% cerca un posto per studiare; 29% si sente solo spesso o sempre; 12% ha lasciato la scuola." };
const Q_M9: Materiale = { id: "M9", titolo: "Analisi del commercio locale", aree: ["economia-management", "ristorazione-turismo"], costo: 1, contenuto: "14 attività chiuse in 5 anni entro 400 m, 3 aperte. Nessun bar aperto dopo le 20. Due panifici storici ancora attivi." };
const Q_M10: Materiale = { id: "M10", titolo: "Report ambientale", aree: ["agrifood-ambiente", "scienze-ricerca"], costo: 1, contenuto: "0,9 m² di verde per abitante contro i 9 raccomandati. Il suolo del cortile retrostante (300 m²) è idoneo alla coltivazione. Isola di calore rilevata a +3,8 °C rispetto alla media cittadina." };
const Q_M11: Materiale = { id: "M11", titolo: "Dossier accessibilità e mobilità", aree: ["mobilita-sostenibile", "salute-professioni-sanitarie"], costo: 1, contenuto: "Nessuno scivolo per carrozzine sui tre ingressi; marciapiede antistante largo 90 cm. Il 22% del quartiere è over 65 e ci sono due strutture per disabili entro 600 m." };
const Q_M12: Materiale = { id: "M12", titolo: "Rilevazione sulla sicurezza percepita", aree: ["sicurezza-difesa"], costo: 1, contenuto: "4 segnalazioni di vandalismo sull'edificio negli ultimi 12 mesi; illuminazione pubblica assente sul lato nord; il 54% dei residenti evita la via dopo le 21." };
const Q_M13: Materiale = { id: "M13", titolo: "Mappa delle competenze del quartiere", aree: ["lingue-relazioni-internazionali", "arte-design-moda", "musica-spettacolo", "meccanica-meccatronica", "informatica-digitale"], costo: 1, contenuto: "Censimento informale: 3 insegnanti in pensione; una sarta con laboratorio; un ex tecnico del suono; 2 meccanici; una comunità bangladese di ~300 persone con due mediatori linguistici; un gruppo musicale che prova in garage." };
const Q_M14: Materiale = { id: "M14", titolo: "Precedenti: cosa è successo altrove", aree: ["scienze-ricerca", "comunicazione-media"], costo: 1, contenuto: "Tre casi reali: un progetto fallito dopo 18 mesi per costi di gestione sottostimati; uno riuscito grazie a un patto con le scuole; uno che ha funzionato solo dopo aver cambiato completamente destinazione al secondo anno." };

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
    aree: ["mobilita-sostenibile", "sicurezza-difesa", "lingue-relazioni-internazionali"],
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
      "L'ex mercato coperto di Via Sanzio, 900 m², chiuso da undici anni. Il Comune lo assegna per nove anni a chi presenta il progetto migliore: c'è un bando, ci sono 180.000 € e una scadenza. Tu sei nel gruppo che scrive la proposta — non decidi da solo, ma la firmi tu. Le tue scelte apriranno e chiuderanno porte: quello che non vorrai sapere ti mancherà quando dovrai decidere. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
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
    { id: "aperto", label: "Serve che questo posto sia sicuro e aperto a tutti", aree: ["sicurezza-difesa", "mobilita-sostenibile"] },
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
          minori: { label: "Spazi certificati per i minori (vincolo del Comune)", area: "scienze-educazione", costo: 38000 },
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
    { id: "facciata_pannelli", label: "Rivestire la facciata con pannelli moderni, per dare un'immagine nuova", aree: ["studi-umanistici-beni-culturali"], qualita: 0.05, trappola: true, avviso: letti.has("M6") ? "Dalla perizia della Soprintendenza: facciata e capriate sono tutelate. Un rivestimento farebbe respingere la domanda." : undefined },
    { id: "insegna_effetto", label: "Grande insegna luminosa e arredo urbano d'effetto", aree: ["comunicazione-media"], qualita: 0.4 },
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
    materiali: { titolo: "Prima di tutto: cosa c'è sul tavolo?", prompt: "Apri i documenti che vuoi leggere. Non sei obbligato ad aprirli tutti — ma quello che leggi adesso ti aiuta a capire a chi stai rispondendo.", hint: "Ciò che scegli di leggere lascia traccia: dice dove va la tua curiosità." },
    priorita: { titolo: "Il quartiere ha detto sei cose diverse. Da cosa partiresti?", prompt: "Mettile in ordine, dalla più importante. Le prime scelte pesano di più." },
    mandato: { titolo: "Il gruppo vi chiede di scrivere il mandato in una frase. Quale?", prompt: "È la scelta che decide il resto: da qui in poi tutto ruota attorno a questo.", hint: "Non ce n'è una giusta. Scegli quella in cui credi di più." },
    informazioni: { titolo: "Avete 5 gettoni. Su cosa li spendete?", prompt: "Ogni approfondimento costa un gettone e non torna indietro. Aprilo per leggerlo: quello che non apri, non lo saprai quando dovrai decidere.", hint: "Puoi restare nel tuo campo o guardarti intorno: sono due stili diversi, nessuno è migliore." },
    nonApprofondire: { titolo: "Una cosa che avete deciso di NON approfondire: perché?", prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.", hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi." },
    budget: { titolo: "Distribuite il budget tra le voci", prompt: "Il colpo del tetto ha cambiato i conti. Metti le risorse dove servono davvero: non puoi coprire tutto.", hint: "Dove metti i soldi quando sei stretto racconta le tue priorità più delle parole." },
    scarto: { titolo: "Tre cose non ci stanno più. Quali due tagliate?", prompt: "Rinuncia a due delle tre. Tieni ciò che per il progetto è davvero essenziale.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Siete in sette. Chi fa cosa nei primi sei mesi?", prompt: "Per ogni compito: te ne occupi tu o lo lascia a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scrivere: quanto reggerà, secondo te?", prompt: "Quanto pensi che la vostra proposta reggerà l'esame della commissione?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete la proposta", prompt: "Cosa diventa l'ex mercato, per chi, e come sta in piedi dal terzo anno? Scrivetelo come lo leggerebbe la commissione.", hint: "Non servono paroloni: concretezza, coerenza col mandato e col vincolo ricevuto.", minCaratteri: 300 },
    riflessione: { titolo: "Ripensando a questi ventidue giorni…", prompt: "Qual è il momento in cui ti sei sentito più nel tuo? E quello in cui ti sei sentito più fuori posto?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
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
const D_M5: Materiale = { id: "M5", titolo: "Bilancio della Mediateca", aree: ["giurisprudenza-pa"], costo: 1, contenuto: "Costi annui 412.000 €; trasferimento comunale 340.000 € (era 395.000 tre anni fa); disavanzo 72.000 €. La decisione ha una ragione vera: non è arroganza, è un buco." };
const D_M6: Materiale = { id: "M6", titolo: "Lettera formale dell'Associazione Passo Nuovo", aree: ["giurisprudenza-pa", "sicurezza-difesa"], costo: 1, contenuto: "Protocollata. Richiede risposta scritta entro 15 giorni, oltre i quali «si valuteranno le opportune sedi». Cita la normativa sull'accessibilità dei servizi pubblici." };
const D_M7: Materiale = { id: "M7", titolo: "Affluenza per fascia oraria e tipo di utente", aree: ["comunicazione-media", "scienze-educazione"], costo: 1, contenuto: "La mattina è semivuota (18% di occupazione), il pomeriggio è satura (94%). Il conflitto è tutto in quattro ore al giorno. Forse non serve dividere lo spazio: forse serve distribuire il tempo." };
const D_M8: Materiale = { id: "M8", titolo: "Relazione del personale", aree: ["sicurezza-difesa", "scienze-educazione"], costo: 1, contenuto: "23 segnalazioni in un anno di attrito tra gruppi di utenti (rumore, occupazione dei posti, uso dei tavoli). I bibliotecari chiedono da due anni «regole d'uso chiare», mai arrivate. La tensione esisteva prima della decisione." };
const D_M9: Materiale = { id: "M9", titolo: "Il precedente di un'altra città", aree: ["comunicazione-media", "studi-umanistici-beni-culturali"], costo: 1, contenuto: "Una biblioteca fece la stessa scelta: dopo 8 mesi tornò indietro, non per le proteste ma perché le postazioni a pagamento restarono vuote al 70%. Il ricavo previsto non arrivò." };
const D_M10: Materiale = { id: "M10", titolo: "Analisi delle reazioni online", aree: ["comunicazione-media"], costo: 1, contenuto: "340 commenti: 61% negativi, 12% positivi, 27% richieste di chiarimento. Il 44% dei commenti negativi contiene un'informazione sbagliata (molti credono che la mediateca chiuda del tutto). Il picco è stato il giorno 2, ora sta calando." };
const D_M11: Materiale = { id: "M11", titolo: "Verbale del Consiglio di quartiere", aree: ["giurisprudenza-pa", "lingue-relazioni-internazionali"], costo: 1, contenuto: "La decisione fu presentata come «ipotesi di lavoro» in una riunione di aprile con 9 presenti. Nessuno votò. Nessuno la comunicò." };
const D_M12: Materiale = { id: "M12", titolo: "Nota interna dell'assessorato", aree: ["comunicazione-media", "giurisprudenza-pa"], costo: 1, contenuto: "«Si rappresenta che, in assenza di un riscontro pubblico entro cinque giorni, questa amministrazione riterrà opportuno chiarire pubblicamente che la riorganizzazione è iniziativa autonoma della direzione della Mediateca.» Tradotto: il Comune è pronto a scaricarvi." };
const D_M13: Materiale = { id: "M13", titolo: "Linee guida sulla comunicazione dei servizi pubblici", aree: ["comunicazione-media", "lingue-relazioni-internazionali"], costo: 1, contenuto: "Quattro principi con esempi: dire prima cosa cambia per chi legge; non usare parole che nessuno userebbe parlando; ammettere ciò che non si sa ancora; indicare sempre un canale per chiedere." };

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
    aree: ["giurisprudenza-pa", "scienze-educazione"],
    vincolo: { id: "diffida", testo: "La diffida dell'associazione è protocollata: avete quindici giorni per una risposta formale, non un post." },
    consulenze: [
      consulenza("D_legale", "Consulenza: un legale del Comune", "giurisprudenza-pa", "Il regolamento impone il 60% di superficie libera. Sotto quella soglia la decisione è impugnabile: non è una questione di opinioni, è una norma."),
      consulenza("D_referente", "Consulenza: una referente dell'associazione", "scienze-educazione", "Non chiediamo di bloccare tutto: chiediamo che l'area gratuita resti accessibile davvero, anche a chi ha una carrozzina e a chi non ha quattro euro."),
    ],
  },
  {
    id: "ascolto", label: "«È un problema di ascolto»", frase: "Non è stato chiesto niente a nessuno, prima di decidere.",
    aree: ["scienze-educazione", "lingue-relazioni-internazionali"],
    vincolo: { id: "tempo", testo: "Il sondaggio che vorreste fare richiede tre settimane. La risposta, però, serve giovedì." },
    consulenze: [
      consulenza("D_mediatrice", "Consulenza: una mediatrice", "lingue-relazioni-internazionali", "Le persone accettano quasi tutto se sentono di essere state ascoltate prima. Anche solo un incontro pubblico, fatto sul serio, cambia il clima."),
      consulenza("D_insegnante", "Consulenza: un'insegnante", "scienze-educazione", "Per molti dei miei studenti quella è l'unica sala studio possibile. Se cambia, ditelo a loro per primi, non sui giornali."),
    ],
  },
  {
    id: "identita", label: "«È un problema di identità»", frase: "La Mediateca sta smettendo di essere ciò che è: un luogo di tutti.",
    aree: ["studi-umanistici-beni-culturali", "comunicazione-media"],
    vincolo: { id: "articolo", testo: "Esce il pezzo sul quotidiano: «La biblioteca che vende i suoi tavoli»." },
    consulenze: [
      consulenza("D_direttrice", "Consulenza: la direttrice storica", "studi-umanistici-beni-culturali", "Una biblioteca pubblica non è un coworking. Nel momento in cui un posto a sedere ha un prezzo, cambia cosa quel posto significa per la città."),
      consulenza("D_docente", "Consulenza: un docente di beni culturali", "studi-umanistici-beni-culturali", "Il valore di questi luoghi è che chiunque può entrarci senza dover dimostrare nulla. È quello che li distingue da un ufficio."),
    ],
  },
  {
    id: "convivenza", label: "«È un problema di convivenza»", frase: "Il vero attrito è tra utenti diversi che usano lo stesso spazio.",
    aree: ["sicurezza-difesa", "scienze-educazione"],
    vincolo: { id: "regole", testo: "Terza lite in sala in una settimana. Il personale chiede regole scritte, subito." },
    consulenze: [
      consulenza("D_capo_personale", "Consulenza: il capo del personale", "sicurezza-difesa", "Chiediamo regole d'uso chiare da due anni: chi può fare cosa, dove si parla e dove no. Senza, ogni giorno è una trattativa tra sconosciuti."),
      consulenza("D_spazi", "Consulenza: un esperto di gestione degli spazi", "scienze-educazione", "Non serve un muro: serve dividere gli usi. Zone silenziose e zone di lavoro, fasce orarie diverse. Lo spazio c'è, manca la regola."),
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
    { id: "lettera", label: "C'è una lettera formale che aspetta risposta", aree: ["giurisprudenza-pa", "sicurezza-difesa"] },
    { id: "attrito", label: "Due gruppi di utenti non riescono a stare nello stesso spazio", aree: ["sicurezza-difesa", "scienze-educazione"] },
    { id: "identita", label: "Una mediateca pubblica che fa pagare tradisce quello che è", aree: ["studi-umanistici-beni-culturali", "comunicazione-media"] },
  ],
  ruoli: [
    { id: "stampa", label: "Parlare con la stampa", area: "comunicazione-media" },
    { id: "comune", label: "Tenere i rapporti con il Comune", area: "giurisprudenza-pa" },
    { id: "studenti", label: "Incontrare gli studenti", area: "scienze-educazione" },
    { id: "testo", label: "Scrivere il testo della risposta", area: "lingue-relazioni-internazionali" },
    { id: "regolamento", label: "Sistemare il regolamento interno", area: "sicurezza-difesa" },
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
      voci.push({ id: "rivedere_spazi", label: "Rivedere il progetto degli spazi", aree: ["sicurezza-difesa"] });
      if (letti.has("M12")) voci.push({ id: "concordare_comune", label: "Concordare la posizione con il Comune", aree: ["giurisprudenza-pa"], soloSe: "M12" });
      voci.push({ id: "scrivere_regole", label: "Scrivere le regole d'uso mancanti", aree: ["sicurezza-difesa"] });
      voci.push({ id: "informare_personale", label: "Informare il personale prima di tutti gli altri", aree: ["comunicazione-media"] });
      return voci;
    },
  },
  scarto: (letti) => [
    { id: "confermare_spiegare", label: "Confermare la decisione e limitarsi a spiegarla meglio", aree: ["giurisprudenza-pa"], qualita: 0.05, trappola: true, avviso: letti.has("M4") ? "Il regolamento (art. 7, che hai letto) impone almeno il 60% di superficie libera: qui scende al 48%. Confermare così com'è è illegittimo, non solo impopolare." : undefined },
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
    { id: "spiegare", label: "Spiegare al pubblico dell'open day", area: "arte-design-moda" },
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
      voci.push({ id: "preparare_spiegazione", label: "Preparare la spiegazione per l'open day", aree: ["arte-design-moda"] });
      return voci;
    },
  },
  scarto: (letti) => [
    { id: "raddoppiare", label: "Raddoppiare la durata dell'irrigazione della sezione B", aree: ["meccanica-meccatronica"], qualita: 0.05, trappola: true, avviso: letti.has("M6") ? "Il manuale della pompa (che hai letto): sotto 0,8 bar la valvola non si apre affatto. Raddoppiare zero fa zero." : undefined },
    { id: "dire_apposto", label: "Dire all'open day che è tutto a posto", aree: ["arte-design-moda"], qualita: 0.1 },
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
const K_M4: Materiale = { id: "M4", titolo: "Relazione sull'impianto elettrico", aree: ["informatica-digitale", "sicurezza-difesa", "meccanica-meccatronica"], costo: 1, contenuto: "Quadro del 1988, nessun differenziale sulle linee della palestra, cavi in canaline non ignifughe. NON certificabile: senza rifacimento il collaudo finale non passa e la palestra non riapre, comunque siano andati gli altri lavori. Costo 62.000 €, 25 giorni. Va fatto PRIMA del controsoffitto, perché i cavi passano lì sopra." };
const K_M5: Materiale = { id: "M5", titolo: "Perizia sulla copertura", aree: ["edilizia-architettura"], costo: 1, contenuto: "Le infiltrazioni vengono da 40 m² di guaina degenerata sull'angolo nord (conferma il custode). Rifacimento 34.000 €, 15 giorni. Se non si fa PRIMA del controsoffitto nuovo, l'acqua rovinerà il controsoffitto nuovo entro il primo inverno." };
const K_M6: Materiale = { id: "M6", titolo: "Preventivo del controsoffitto", aree: ["edilizia-architettura", "sicurezza-difesa"], costo: 1, contenuto: "Smontaggio del vecchio e nuovo in fibra minerale antisfondamento: 71.000 €, 20 giorni. È il lavoro che ha causato la chiusura. Senza, la palestra resta chiusa." };
const K_M7: Materiale = { id: "M7", titolo: "Diagnosi energetica", aree: ["energia-sostenibilita"], costo: 1, contenuto: "Caldaia a gasolio del 2003: 19.000 €/anno di riscaldamento. Sostituzione con pompa di calore: 48.000 €, 18 giorni, spesa a regime 7.400 €/anno. NON è obbligatoria per il collaudo. Rientro in circa 6 anni." };
const K_M8: Materiale = { id: "M8", titolo: "Preventivo della pavimentazione sportiva", aree: ["edilizia-architettura", "meccanica-meccatronica"], costo: 1, contenuto: "Parquet sportivo omologato 39.000 €, 12 giorni; alternativa in PVC sportivo 21.000 €, 6 giorni, durata inferiore. Va posato per ULTIMO, dopo tutti i lavori in quota, altrimenti si rovina." };
const K_M9: Materiale = { id: "M9", titolo: "Dossier accessibilità degli spogliatoi", aree: ["mobilita-sostenibile", "sicurezza-difesa"], costo: 1, contenuto: "Gradino di 18 cm all'ingresso spogliatoi, porte da 70 cm, nessun servizio attrezzato. Adeguamento 27.000 €, 14 giorni. Nell'istituto ci sono quattro studenti con disabilità motoria. Obbligo normativo in caso di ristrutturazione significativa: il collaudo può rilevarlo." };
const K_M10: Materiale = { id: "M10", titolo: "Cronoprogramma della ditta", aree: ["meccanica-meccatronica", "edilizia-architettura"], costo: 1, contenuto: "Cinque operai, una sola squadra: i lavori vanno in fila, non in parallelo, salvo che spogliatoi e palestra si possono fare in contemporanea con due squadre (la seconda costa +18.000 €). Giorni disponibili: 83." };
const K_M11: Materiale = { id: "M11", titolo: "Regolamento del finanziamento comunale", aree: ["sicurezza-difesa", "edilizia-architettura"], costo: 1, contenuto: "Art. 4: collaudo entro il 5 settembre, pena revoca. Art. 9: le varianti in corso d'opera superiori al 10% richiedono una nuova approvazione, con 20 giorni di istruttoria. Tradotto: cambiare idea a metà cantiere costa venti giorni che non hai." };
const K_M12: Materiale = { id: "M12", titolo: "Storico delle manutenzioni", aree: ["edilizia-architettura"], costo: 1, contenuto: "2009: rifacimento parziale della guaina, «da completare l'anno successivo». Mai completato. 2015: preventivo per l'elettrico, mai approvato. 2019: segnalazione infiltrazioni dal custode, archiviata. Il crollo non è stato un incidente, è stato un calendario." };
const K_M13: Materiale = { id: "M13", titolo: "Nota della ditta sui tempi di consegna", aree: ["meccanica-meccatronica"], costo: 1, contenuto: "I pannelli antisfondamento del controsoffitto hanno 35 giorni di consegna dall'ordine. Se l'ordine non parte entro la prima settimana, il lavoro slitta a fine agosto e trascina tutto il resto." };

const K_MANDATI: Mandato[] = [
  {
    id: "sicurezza", label: "«Prima che nessuno si faccia male»", frase: "La sicurezza viene prima di tutto il resto.",
    aree: ["sicurezza-difesa", "edilizia-architettura"],
    vincolo: { id: "ispezione", testo: "Verifica ispettiva a sorpresa a metà cantiere: se trovano difformità, sospensione di 10 giorni." },
    consulenze: [
      consulenza("K_rspp", "Consulenza: l'RSPP", "sicurezza-difesa", "Il controsoffitto è un problema di teste, non di comodità. Finché non è a norma, per me la palestra non riapre — e lo metto per iscritto."),
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
    aree: ["mobilita-sostenibile", "sicurezza-difesa"],
    vincolo: { id: "idrico", testo: "L'adeguamento rivela che serve rifare anche l'impianto idrico degli spogliatoi: +19.000 €." },
    consulenze: [
      consulenza("K_accessibilita", "Consulenza: un tecnico dell'accessibilità", "mobilita-sostenibile", "Gradino di 18 cm, porte da 70: oggi quattro studenti non entrano. In una ristrutturazione significativa l'adeguamento è un obbligo, e il collaudo può rilevarlo."),
      consulenza("K_genitore", "Consulenza: un genitore", "sicurezza-difesa", "Mio figlio in tre anni di medie non è mai entrato in uno spogliatoio con i suoi compagni. Non chiedo un favore, chiedo che sia finita per tutti."),
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
    { id: "controsoffitto", label: "Il controsoffitto è caduto una volta e può cadere ancora", aree: ["sicurezza-difesa", "edilizia-architettura"] },
    { id: "elettrico", label: "L'impianto elettrico è del 1988 e non è a norma", aree: ["informatica-digitale", "sicurezza-difesa"] },
    { id: "tetto", label: "Dal tetto entra acqua da anni", aree: ["edilizia-architettura"] },
    { id: "pavimento", label: "Il pavimento è finito: non ci si può giocare", aree: ["meccanica-meccatronica", "edilizia-architettura"] },
    { id: "caldaia", label: "La caldaia consuma il doppio del necessario", aree: ["energia-sostenibilita"] },
    { id: "spogliatoi", label: "Quattro studenti non possono entrare negli spogliatoi", aree: ["mobilita-sostenibile", "sicurezza-difesa"] },
  ],
  ruoli: [
    { id: "ditta", label: "Stare dietro alla ditta ogni giorno", area: "edilizia-architettura" },
    { id: "conti", label: "Tenere i conti e le varianti", area: "informatica-digitale" },
    { id: "sicurezza", label: "Controllare la sicurezza in cantiere", area: "sicurezza-difesa" },
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
    budgetGiorni: 83,
    lavori: (letti) => {
      const richiedeControsoffitto: string[] = [];
      if (letti.has("M5")) richiedeControsoffitto.push("copertura");
      if (letti.has("M4")) richiedeControsoffitto.push("elettrico");
      const lavori: Lavoro[] = [
        { id: "elettrico", label: "Rifacimento impianto elettrico", aree: ["informatica-digitale", "sicurezza-difesa", "meccanica-meccatronica"], costo: 62000, giorni: 25, essenziale: true },
        { id: "copertura", label: "Rifacimento della copertura (angolo nord)", aree: ["edilizia-architettura"], costo: 34000, giorni: 15 },
        { id: "controsoffitto", label: "Controsoffitto nuovo antisfondamento", aree: ["edilizia-architettura", "sicurezza-difesa"], costo: 71000, giorni: 20, essenziale: true, richiede: richiedeControsoffitto },
        { id: "parquet", label: "Pavimento in parquet sportivo omologato", aree: ["edilizia-architettura", "meccanica-meccatronica"], costo: 39000, giorni: 12, parallelizzabile: true, richiede: ["controsoffitto"] },
        { id: "pvc", label: "Pavimento in PVC sportivo (più rapido)", aree: ["edilizia-architettura", "meccanica-meccatronica"], costo: 21000, giorni: 6, parallelizzabile: true, richiede: ["controsoffitto"] },
        { id: "pompa_calore", label: "Pompa di calore al posto della caldaia", aree: ["energia-sostenibilita"], costo: 48000, giorni: 18 },
        { id: "accessibilita", label: "Adeguamento accessibilità degli spogliatoi", aree: ["mobilita-sostenibile", "sicurezza-difesa"], costo: 27000, giorni: 14, parallelizzabile: true },
        { id: "fondo_imprevisti", label: "Fondo imprevisti (per le varianti)", aree: [], costo: 15000, giorni: 0 },
      ];
      if (letti.has("M10")) lavori.push({ id: "seconda_squadra", label: "Seconda squadra (lavori in parallelo)", aree: [], costo: 18000, giorni: 0, gate: "M10" });
      return lavori;
    },
  },
  scarto: (letti) => [
    { id: "accessibilita", label: "L'adeguamento degli spogliatoi (rimandato al prossimo finanziamento)", aree: ["mobilita-sostenibile"], qualita: 0.85, trappola: true, trappolaSeScartata: true, avviso: letti.has("M9") ? "Il dossier accessibilità (che hai letto): quattro studenti restano fuori, e in una ristrutturazione significativa il collaudo può rilevarlo. Non è un «di più»." : undefined },
    { id: "pompa_calore", label: "La pompa di calore (si tiene la vecchia caldaia)", aree: ["energia-sostenibilita"], qualita: 0.1 },
    { id: "parquet", label: "Il parquet omologato (si ripiega sul PVC)", aree: ["edilizia-architettura"], qualita: 0.2 },
    { id: "copertura", label: "La copertura del tetto (rimandata al prossimo anno)", aree: ["edilizia-architettura"], qualita: 0.6, avviso: letti.has("M5") ? "La perizia (che hai letto): senza rifare la guaina, l'acqua rovinerà il controsoffitto nuovo entro il primo inverno." : undefined },
    { id: "elettrico", label: "Il rifacimento dell'impianto elettrico (si tiene com'è)", aree: ["sicurezza-difesa"], qualita: 0.75, avviso: letti.has("M4") ? "La relazione (che hai letto): senza rifacimento il collaudo non passa e la palestra non riapre, comunque siano andati gli altri lavori." : undefined },
    { id: "controsoffitto", label: "Il controsoffitto nuovo (si rinvia)", aree: ["edilizia-architettura", "sicurezza-difesa"], qualita: 0.9 },
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
    budget: { titolo: "Il piano dei lavori: cosa entra, dentro soldi e giorni?", prompt: "Restano i soldi che restano e i giorni che restano. Scegli i lavori: il piano deve stare dentro 240.000 € e 83 giorni, e rispettare le dipendenze (alcuni lavori vanno fatti prima di altri).", hint: "Dove metti le risorse quando sei stretto racconta le tue priorità più delle parole." },
    scarto: { titolo: "Non ci stanno tutti. Due lavori restano fuori: quali due lasciate fuori?", prompt: "Rinuncia a due. Scegli con attenzione: qualcuno di questi «tagli» costa più di quanto sembra.", hint: "Ciò che tieni conta più di ciò che togli." },
    ruoli: { titolo: "Da qui al 5 settembre, chi segue cosa?", prompt: "Per ogni compito: te ne occupi tu o lo lascia a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare." },
    previsione: { titolo: "Prima di scriverlo: quanto sarà agibile il 12 settembre?", prompt: "Quanto pensate che la palestra sarà davvero agibile il 12 settembre, quando entrano i ragazzi?", domanda: "La tua sensazione, prima di scrivere" },
    proposta: { titolo: "Scrivete cosa avete fatto e cosa no", prompt: "Cosa avete fatto, cosa NON avete fatto e perché, e cosa resta da fare. Lo leggeranno il dirigente, il Comune e gli studenti.", hint: "Di' chiaramente cosa hai lasciato indietro e chi ne paga il prezzo. Niente toni trionfali.", minCaratteri: 250 },
    riflessione: { titolo: "Ripensando a questi mesi di cantiere…", prompt: "C'è stata una cosa che avete deciso di non fare e che vi è rimasta addosso? E un momento in cui avete capito qualcosa che gli altri non vedevano?", hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.", minCaratteri: 120 },
    passi: { titolo: "L'anno prossimo ci sarà un altro finanziamento. I primi tre passi?", prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.", hint: "L'ordine conta: da dove è più saggio cominciare?" },
  },
};

// ─────────────────────────────────────────── registro delle missioni

const DEFS: MissioneDef[] = [MD01, MD02, MD03, MD04];
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
  dipendenzeMancanti: { lavoro: string; mancanti: string[] }[];
  secondaSquadra: boolean;
} {
  const sel = new Set(selezionati);
  const scelti = step.lavori.filter((l) => sel.has(l.id));
  const secondaSquadra = sel.has("seconda_squadra");
  const soldi = scelti.reduce((s, l) => s + l.costo, 0);

  const parall = scelti.filter((l) => l.parallelizzabile);
  const seriali = scelti.filter((l) => !l.parallelizzabile && l.id !== "seconda_squadra");
  let giorni = seriali.reduce((s, l) => s + l.giorni, 0);
  if (parall.length > 0) giorni += secondaSquadra ? Math.max(...parall.map((l) => l.giorni)) : parall.reduce((s, l) => s + l.giorni, 0);

  const dipendenzeMancanti: { lavoro: string; mancanti: string[] }[] = [];
  for (const l of scelti) {
    const mancanti = (l.richiede ?? []).filter((id) => !sel.has(id));
    if (mancanti.length > 0) dipendenzeMancanti.push({ lavoro: l.id, mancanti });
  }
  return { soldi, giorni, dipendenzeMancanti, secondaSquadra };
}

// ─────────────────────────────────────────── costruzione della missione

function costruisciMissioneDef(def: MissioneDef, get: LeggiRisposta): EscapeMission {
  const mandato = mandatoScelto(get);
  const letti = materialiLetti(get);
  const t = def.testi;
  const idRuoli = `s${def.ruoliStanza}_ruoli`;

  const stepMateriali: Step = { id: "s1_materiali", stanza: 1, tipo: "esplora_libero", titolo: t.materiali.titolo, prompt: t.materiali.prompt, hint: t.materiali.hint, materiali: def.materialiLiberi };
  const stepPriorita: Step = { id: "s1_priorita", stanza: 1, tipo: "ordina_priorita", titolo: t.priorita.titolo, prompt: t.priorita.prompt, hint: t.priorita.hint, elementi: def.prioritaVoci };
  const stepMandato: Step = { id: "s1_mandato", stanza: 1, tipo: "scelta_singola", titolo: t.mandato.titolo, prompt: t.mandato.prompt, hint: t.mandato.hint, opzioni: def.mandati.map((m) => ({ id: m.id, label: `${m.label} — ${m.frase}`, aree: m.aree, qualita: 0.7 })) };

  const stepInformazioni: Step = { id: "s2_informazioni", stanza: 2, tipo: "seleziona_informazioni", titolo: t.informazioni.titolo, prompt: t.informazioni.prompt, hint: t.informazioni.hint, budget: 5, dossier: dossierStanza2(def, mandato) };
  const stepNonApprofondire: Step = { id: "s2_non_approfondire", stanza: 2, tipo: "decisione_scritta", titolo: t.nonApprofondire.titolo, prompt: t.nonApprofondire.prompt, hint: t.nonApprofondire.hint, minCaratteri: 0, facoltativo: true };

  const stepBudget: Step = def.piano
    ? { id: "s3_budget", stanza: 3, tipo: "pianifica_lavori", titolo: t.budget.titolo, prompt: t.budget.prompt, hint: t.budget.hint, budgetSoldi: def.piano.budgetSoldi, budgetGiorni: def.piano.budgetGiorni, lavori: def.piano.lavori(letti) }
    : { id: "s3_budget", stanza: 3, tipo: "alloca_budget", titolo: t.budget.titolo, prompt: t.budget.prompt, hint: t.budget.hint, totale: def.budget.totale(mandato), unita: def.budget.unita, passo: def.budget.passo, voci: def.budget.voci(mandato, letti) };
  const stepScarto: Step = { id: "s3_scarto", stanza: 3, tipo: "scarta_opzione", titolo: t.scarto.titolo, prompt: t.scarto.prompt, hint: t.scarto.hint, daScartare: def.daScartare, opzioni: def.scarto(letti) };

  const stepPrevisione: Step = { id: "s4_previsione", stanza: 4, tipo: "previsione_poi_esito", titolo: t.previsione.titolo, prompt: t.previsione.prompt, domanda: t.previsione.domanda };
  const stepProposta: Step = { id: "s4_proposta", stanza: 4, tipo: "decisione_scritta", titolo: t.proposta.titolo, prompt: t.proposta.prompt, hint: t.proposta.hint, minCaratteri: t.proposta.minCaratteri };

  const stepRuoli: Step = { id: idRuoli, stanza: def.ruoliStanza, tipo: "assegna_ruoli", titolo: t.ruoli.titolo, prompt: t.ruoli.prompt, hint: t.ruoli.hint, ruoli: def.ruoli };

  const stepRiflessione: Step = { id: "s5_riflessione", stanza: 5, tipo: "riflessione", titolo: t.riflessione.titolo, prompt: t.riflessione.prompt, hint: t.riflessione.hint, minCaratteri: t.riflessione.minCaratteri };
  const stepPassi: Step = { id: "s5_passi", stanza: 5, tipo: "pianifica_passi", titolo: t.passi.titolo, prompt: t.passi.prompt, hint: t.passi.hint, passi: def.passi, quanti: def.quantiPassi };

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
