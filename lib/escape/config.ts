// KIREO Escape — contenuto delle missioni (client-safe: solo prompt, opzioni,
// etichette d'area, materiali; nessun numero di punteggio, che vive solo in
// scoring.ts lato server). La prima missione è "Il progetto per il quartiere",
// versione 2: le scelte aprono e chiudono porte. Il mandato scelto nella
// Stanza 1 decide quali consulenze esistono nella 2 e quale vincolo arriva
// nella 3; l'informazione costa gettoni e non si recupera.
//
// Il contenuto NON è più statico: costruisciMissione(get) risolve gli step
// dinamici (dossier della Stanza 2, voci/totale del budget, avvisi dello
// scarto, testo del vincolo) a partire dalle risposte già date, tramite un
// accessore puro `(id) => payload`. Lo stesso risolutore è usato dal player
// (client) e dal motore di scoring (server): un'unica fonte di verità.

import type {
  EscapeMission,
  LeggiRisposta,
  Mandato,
  Materiale,
  MissioneMeta,
  OpzioneScarto,
  Passo,
  Payload,
  PayloadSceltaSingola,
  PayloadEsplora,
  PayloadSeleziona,
  Ruolo,
  Step,
  VoceBudget,
} from "./tipi";

export const SLUG_QUARTIERE = "progetto-quartiere";

// ─────────────────────────────────────────── MATERIALI

// Sempre disponibili (Stanza 1, costo 0). Aree lasciate vuote: il segnale di
// curiosità della Stanza 1 è trasversale (metodo: "hai voluto guardare i dati
// e ascoltare le persone"), non un'affinità d'area — quella arriva dalla
// Stanza 2, dove i gettoni si spendono su materiali etichettati per area.
export const M1: Materiale = {
  id: "M1",
  titolo: "Scheda del quartiere",
  aree: [],
  costo: 0,
  contenuto:
    "8.400 abitanti; età media 47 anni; 22% over 65; 19% under 18; 31% delle famiglie con un solo genitore; disoccupazione giovanile 28%. Due fermate bus, nessuna metro. Un solo spazio pubblico aperto: il campetto parrocchiale.",
};

export const M2: Materiale = {
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

export const M3: Materiale = {
  id: "M3",
  titolo: "Il bando del Comune",
  aree: [],
  costo: 0,
  contenuto:
    "180.000 € una tantum; assegnazione novennale; obbligo di apertura al pubblico almeno 20 ore a settimana; obbligo di sostenibilità economica dal terzo anno. Punteggio premiante per: occupazione giovanile creata, efficienza energetica, accessibilità.",
};

export const MATERIALI_LIBERI: Materiale[] = [M1, M2, M3];

// Consultabili a gettone (Stanza 2, costo 1). Etichettati per area: aprirli
// dirige la curiosità (e ha conseguenze concrete nelle stanze 3 e 4).
export const M4: Materiale = {
  id: "M4",
  titolo: "Perizia strutturale",
  aree: ["edilizia-architettura"],
  costo: 1,
  contenuto:
    "La copertura in lamiera ha travi ammalorate su 340 dei 900 m². Messa in sicurezza stimata 55.000 €; senza intervento quella porzione è inagibile. Chi non legge questa perizia scopre il problema solo dopo, a budget già speso.",
};
export const M5: Materiale = {
  id: "M5",
  titolo: "Diagnosi energetica",
  aree: ["energia-sostenibilita"],
  costo: 1,
  contenuto:
    "Consumo stimato a regime 38.000 kWh/anno ≈ 11.000 €/anno. Con cappotto + fotovoltaico da 20 kW: investimento 46.000 €, rientro in 6 anni, bolletta a 3.400 €/anno.",
};
export const M6: Materiale = {
  id: "M6",
  titolo: "Vincolo della Soprintendenza",
  aree: ["studi-umanistici-beni-culturali", "giurisprudenza-pa"],
  costo: 1,
  contenuto:
    "La facciata e le capriate originali sono tutelate: non si possono coprire né sostituire, solo consolidare. Ogni progetto che le nasconde viene respinto.",
};
export const M7: Materiale = {
  id: "M7",
  titolo: "Piano economico di gestione",
  aree: ["economia-management"],
  costo: 1,
  contenuto:
    "Costi fissi annui a regime: utenze 11.000, assicurazione 2.400, pulizie 7.200, coordinatore part-time 14.000. Totale ≈ 34.600 €/anno da coprire dal terzo anno.",
};
export const M8: Materiale = {
  id: "M8",
  titolo: "Indagine sui bisogni giovanili",
  aree: ["scienze-educazione", "salute-professioni-sanitarie"],
  costo: 1,
  contenuto:
    "214 questionari agli under 25: 68% «non c'è niente da fare la sera»; 41% cerca un posto per studiare; 29% si sente solo spesso o sempre; 12% ha lasciato la scuola.",
};
export const M9: Materiale = {
  id: "M9",
  titolo: "Analisi del commercio locale",
  aree: ["economia-management", "ristorazione-turismo"],
  costo: 1,
  contenuto:
    "14 attività chiuse in 5 anni entro 400 m, 3 aperte. Nessun bar aperto dopo le 20. Due panifici storici ancora attivi.",
};
export const M10: Materiale = {
  id: "M10",
  titolo: "Report ambientale",
  aree: ["agrifood-ambiente", "scienze-ricerca"],
  costo: 1,
  contenuto:
    "0,9 m² di verde per abitante contro i 9 raccomandati. Il suolo del cortile retrostante (300 m²) è idoneo alla coltivazione. Isola di calore rilevata a +3,8 °C rispetto alla media cittadina.",
};
export const M11: Materiale = {
  id: "M11",
  titolo: "Dossier accessibilità e mobilità",
  aree: ["mobilita-sostenibile", "salute-professioni-sanitarie"],
  costo: 1,
  contenuto:
    "Nessuno scivolo per carrozzine sui tre ingressi; marciapiede antistante largo 90 cm. Il 22% del quartiere è over 65 e ci sono due strutture per disabili entro 600 m.",
};
export const M12: Materiale = {
  id: "M12",
  titolo: "Rilevazione sulla sicurezza percepita",
  aree: ["sicurezza-difesa"],
  costo: 1,
  contenuto:
    "4 segnalazioni di vandalismo sull'edificio negli ultimi 12 mesi; illuminazione pubblica assente sul lato nord; il 54% dei residenti evita la via dopo le 21.",
};
export const M13: Materiale = {
  id: "M13",
  titolo: "Mappa delle competenze del quartiere",
  aree: ["lingue-relazioni-internazionali", "arte-design-moda", "musica-spettacolo", "meccanica-meccatronica", "informatica-digitale"],
  costo: 1,
  contenuto:
    "Censimento informale: 3 insegnanti in pensione; una sarta con laboratorio; un ex tecnico del suono; 2 meccanici; una comunità bangladese di ~300 persone con due mediatori linguistici; un gruppo musicale che prova in garage.",
};
export const M14: Materiale = {
  id: "M14",
  titolo: "Precedenti: cosa è successo altrove",
  aree: ["scienze-ricerca", "comunicazione-media"],
  costo: 1,
  contenuto:
    "Tre casi reali: un progetto fallito dopo 18 mesi per costi di gestione sottostimati; uno riuscito grazie a un patto con le scuole; uno che ha funzionato solo dopo aver cambiato completamente destinazione al secondo anno.",
};

export const MATERIALI_GETTONE: Materiale[] = [M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14];

// ─────────────────────────────────────────── MANDATI (bivio 1.3)

function consulenza(id: string, titolo: string, area: string, contenuto: string): Materiale {
  return { id, titolo, aree: [area], costo: 1, contenuto };
}

export const MANDATI: Mandato[] = [
  {
    id: "educativo",
    label: "«Un posto per crescere»",
    frase: "Un posto pensato per i ragazzi: studio, sostegno, un pomeriggio sicuro.",
    aree: ["scienze-educazione", "salute-professioni-sanitarie"],
    vincolo: {
      id: "minori",
      testo:
        "Ogni attività continuativa con minori richiede spazi separati certificati e personale qualificato: +38.000 € e uno dei tre locali grandi non è più utilizzabile per il resto.",
    },
    consulenze: [
      consulenza("C_pedagogista", "Consulenza: pedagogista", "scienze-educazione", "Servono spazi distinti per fasce d'età e figure con titolo. Il doposcuola funziona solo se stabile e continuativo, non a singhiozzo."),
      consulenza("C_educatore", "Consulenza: educatore", "salute-professioni-sanitarie", "Il 29% dei ragazzi si sente solo: conta la presenza di adulti di riferimento, più che le attrezzature. Ambienti accoglienti, non asettici."),
    ],
  },
  {
    id: "economico",
    label: "«Un posto che produce»",
    frase: "Un posto che riporta attività, lavoro e gente che spende nel quartiere.",
    aree: ["economia-management", "ristorazione-turismo"],
    vincolo: {
      id: "sostenibilita",
      testo:
        "La sostenibilità dal terzo anno va dimostrata con un piano firmato: servono 34.600 €/anno di ricavi propri o l'assegnazione decade.",
    },
    consulenze: [
      consulenza("C_commercialista", "Consulenza: commercialista", "economia-management", "Un mix di ricavi (affitti a ore, bar, corsi a pagamento) regge meglio di un'unica fonte. Prevedi un margine per i mesi vuoti."),
      consulenza("C_ristoratore", "Consulenza: ristoratrice", "ristorazione-turismo", "Un piccolo bar-caffetteria di quartiere può fare da traino, ma serve un orario serale: qui dopo le 20 non è aperto niente."),
    ],
  },
  {
    id: "ambientale",
    label: "«Un posto che respira»",
    frase: "Un posto che porta verde, ombra e aria pulita dove ora c'è solo cemento.",
    aree: ["agrifood-ambiente", "energia-sostenibilita"],
    vincolo: {
      id: "budget",
      testo: "Il capitolo verde del bilancio comunale è stato ridotto: dei 180.000 € ne restano 141.000.",
    },
    consulenze: [
      consulenza("C_agronomo", "Consulenza: agronoma", "agrifood-ambiente", "Il cortile (300 m²) è coltivabile subito: orti condivisi e alberi abbattono l'isola di calore di +3,8 °C. Serve però qualcuno che li curi tutto l'anno."),
      consulenza("C_energetico", "Consulenza: tecnico energetico", "energia-sostenibilita", "Cappotto + fotovoltaico da 20 kW: 46.000 € che rientrano in 6 anni e tagliano la bolletta da 11.000 a 3.400 €/anno."),
    ],
  },
  {
    id: "creativo",
    label: "«Un posto dove si fa»",
    frase: "Un posto per fare cose con le mani e con l'arte: musica, laboratori, creatività.",
    aree: ["musica-spettacolo", "arte-design-moda", "meccanica-meccatronica"],
    vincolo: {
      id: "acustica",
      testo: "Insonorizzazione obbligatoria per attività musicali oltre le 20: 29.000 €, oppure orario limitato alle 19.",
    },
    consulenze: [
      consulenza("C_suono", "Consulenza: tecnico del suono", "musica-spettacolo", "Una sala prova insonorizzata serve davvero: senza, le attività musicali serali sono impossibili e i vicini protestano."),
      consulenza("C_artigiana", "Consulenza: artigiana", "arte-design-moda", "Un laboratorio condiviso (sartoria, stampa, riparazioni) può autofinanziarsi in parte con piccoli corsi. La sarta del quartiere è disponibile a insegnare."),
    ],
  },
  {
    id: "comunita",
    label: "«Un posto di tutti»",
    frase: "Un posto accessibile e sicuro, che tenga insieme le tante anime del quartiere.",
    aree: ["mobilita-sostenibile", "sicurezza-difesa", "lingue-relazioni-internazionali"],
    vincolo: {
      id: "barriere",
      testo: "Adeguamento accessibilità obbligatorio su tutti e tre gli ingressi + servizi: 34.000 €, non finanziabili altrove.",
    },
    consulenze: [
      consulenza("C_mediatrice", "Consulenza: mediatrice culturale", "lingue-relazioni-internazionali", "La comunità bangladese (~300 persone) partecipa se coinvolta fin dall'inizio, con i suoi due mediatori. Spazi neutri e multilingue, non «per stranieri»."),
      consulenza("C_accessibilita", "Consulenza: tecnica dell'accessibilità", "mobilita-sostenibile", "Scivoli sui tre ingressi, servizi a norma e illuminazione del lato nord: senza, metà quartiere resta di fatto escluso."),
    ],
  },
];

export function getMandato(id: string | undefined): Mandato | null {
  return MANDATI.find((m) => m.id === id) ?? null;
}

// ─────────────────────────────────────────── derivazioni dalle risposte

// Mandato scelto nello step s1_mandato (bivio 1.3).
export function mandatoScelto(get: LeggiRisposta): Mandato | null {
  const p = get("s1_mandato") as PayloadSceltaSingola | undefined;
  return getMandato(p?.opzioneId);
}

// Insieme dei materiali che lo studente ha effettivamente letto: quelli aperti
// gratis nella Stanza 1 (s1_materiali) + quelli comprati con i gettoni nella
// Stanza 2 (s2_informazioni). È la base delle conseguenze (chi non ha letto M4
// scopre il tetto tardi, ecc.).
export function materialiLetti(get: LeggiRisposta): Set<string> {
  const set = new Set<string>();
  const p1 = get("s1_materiali") as PayloadEsplora | undefined;
  for (const id of p1?.letti ?? []) set.add(id);
  const p2 = get("s2_informazioni") as PayloadSeleziona | undefined;
  for (const id of p2?.selezionati ?? []) set.add(id);
  return set;
}

const TOTALE_BASE = 180000;
const TOTALE_TAGLIO_VERDE = 141000;

export function totaleBudget(mandato: Mandato | null): number {
  return mandato?.vincolo.id === "budget" ? TOTALE_TAGLIO_VERDE : TOTALE_BASE;
}

// Dossier acquistabili nella Stanza 2: gli 11 materiali a gettone + le 2
// consulenze specifiche del mandato scelto (13 opzioni per 5 gettoni).
export function dossierStanza2(mandato: Mandato | null): Materiale[] {
  return mandato ? [...MATERIALI_GETTONE, ...mandato.consulenze] : [...MATERIALI_GETTONE];
}

// Voci del budget (Stanza 3.1). Alcune compaiono solo se lo studente ha letto
// il materiale corrispondente; l'adeguamento del vincolo compare solo per i
// mandati il cui vincolo è una spesa (educativo/creativo/comunità).
export function vociBudget(mandato: Mandato | null, letti: Set<string>): VoceBudget[] {
  const voci: VoceBudget[] = [
    { id: "tetto", label: "Messa in sicurezza del tetto", aree: ["edilizia-architettura"], costoIndicativo: 55000 },
    { id: "impianti", label: "Impianti e allacci (luce, acqua, riscaldamento)", aree: [], costoIndicativo: 25000 },
    { id: "arredi", label: "Arredi e attrezzature", aree: [], costoIndicativo: 20000 },
  ];

  // Adeguamento del vincolo ricevuto — solo se il vincolo è una spesa concreta.
  if (mandato) {
    const spesaVincolo: Record<string, { label: string; area: string; costo: number } | undefined> = {
      minori: { label: "Spazi certificati per i minori (vincolo del Comune)", area: "scienze-educazione", costo: 38000 },
      acustica: { label: "Insonorizzazione della sala musica (vincolo del Comune)", area: "musica-spettacolo", costo: 29000 },
      barriere: { label: "Adeguamento accessibilità dei tre ingressi (vincolo del Comune)", area: "mobilita-sostenibile", costo: 34000 },
    };
    const v = spesaVincolo[mandato.vincolo.id];
    if (v) voci.push({ id: "adeguamento_vincolo", label: v.label, aree: [v.area], costoIndicativo: v.costo });
  }

  voci.push({ id: "comunicazione", label: "Comunicazione e apertura al quartiere", aree: ["comunicazione-media"], costoIndicativo: 12000 });
  voci.push({ id: "orto", label: "Orto e cortile verde", aree: ["agrifood-ambiente"], costoIndicativo: 15000 });
  voci.push({ id: "accessibilita", label: "Segnaletica e accessibilità di base", aree: ["mobilita-sostenibile"], costoIndicativo: 10000 });

  if (letti.has("M7")) {
    voci.push({ id: "fondo_gestione", label: "Fondo per i costi di gestione (dal terzo anno)", aree: ["economia-management"], costoIndicativo: 20000, soloSe: "M7" });
  }
  if (letti.has("M5")) {
    voci.push({ id: "fotovoltaico", label: "Cappotto + fotovoltaico da 20 kW (rientra in 6 anni)", aree: ["energia-sostenibilita"], costoIndicativo: 46000, soloSe: "M5" });
  }
  return voci;
}

// Opzioni dello scarto (Stanza 3.2). La facciata è la trappola: chi ha letto
// M6 riceve un avviso esplicito (ricompensa per aver letto); chi non l'ha letta
// scoprirà nel finale che l'avrebbe fatta respingere.
export function opzioniScarto(letti: Set<string>): OpzioneScarto[] {
  return [
    {
      id: "facciata_pannelli",
      label: "Rivestire la facciata con pannelli moderni, per dare un'immagine nuova",
      aree: ["studi-umanistici-beni-culturali"],
      qualita: 0.05,
      trappola: true,
      avviso: letti.has("M6")
        ? "Dalla perizia della Soprintendenza: facciata e capriate sono tutelate. Un rivestimento farebbe respingere la domanda."
        : undefined,
    },
    { id: "insegna_effetto", label: "Grande insegna luminosa e arredo urbano d'effetto", aree: ["comunicazione-media"], qualita: 0.4 },
    { id: "spazio_flessibile", label: "Uno spazio interno flessibile, riconfigurabile per usi diversi", aree: ["edilizia-architettura"], qualita: 0.85 },
  ];
}

const RUOLI: Ruolo[] = [
  { id: "conti", label: "Tenere i conti", area: "economia-management" },
  { id: "scuole", label: "Parlare con le scuole", area: "scienze-educazione" },
  { id: "lavori", label: "Seguire i lavori", area: "edilizia-architettura" },
  { id: "raccontare", label: "Raccontare il progetto fuori", area: "comunicazione-media" },
  { id: "giornate", label: "Far funzionare le giornate", area: "salute-professioni-sanitarie" },
];

const PASSI: Passo[] = [
  { id: "sicurezza", label: "Mettere in sicurezza il tetto" },
  { id: "convenzione", label: "Firmare la convenzione col Comune e sistemare gli adempimenti" },
  { id: "lavori", label: "Avviare i lavori essenziali (impianti, spazi)" },
  { id: "coordinatore", label: "Trovare la persona che coordina le attività" },
  { id: "quartiere", label: "Presentare il progetto al quartiere e ascoltare" },
  { id: "attivita", label: "Far partire le prime attività" },
  { id: "fondi", label: "Cercare fondi e bandi aggiuntivi" },
  { id: "inaugurazione", label: "Organizzare l'inaugurazione" },
];

// Le 6 voci del sondaggio di priorità (1.2), ciascuna su 1-3 aree.
const PRIORITA = [
  { id: "ragazzi", label: "I ragazzi non hanno dove stare né dove studiare", aree: ["scienze-educazione", "salute-professioni-sanitarie"] },
  { id: "lavoro", label: "Serve lavoro, servono attività che portino gente", aree: ["economia-management", "ristorazione-turismo"] },
  { id: "verde", label: "Serve verde: qui non si respira", aree: ["agrifood-ambiente", "energia-sostenibilita"] },
  { id: "fare", label: "Serve un posto per fare cose: musica, mani, creatività", aree: ["musica-spettacolo", "arte-design-moda", "meccanica-meccatronica"] },
  { id: "aperto", label: "Serve che questo posto sia sicuro e aperto a tutti", aree: ["sicurezza-difesa", "mobilita-sostenibile"] },
  { id: "edificio", label: "Serve che l'edificio non cada a pezzi e sia riconoscibile", aree: ["edilizia-architettura", "studi-umanistici-beni-culturali"] },
];

// ─────────────────────────────────────────── testo dinamico

const INTRO_S1 =
  "Sono le 18:40 e siete in sette intorno a un tavolo, nella sala parrocchiale. Sul tavolo c'è il bando del Comune, scaduto tra ventidue giorni. Fuori, l'ex mercato è chiuso da undici anni: undici anni di serrande abbassate su novecento metri quadri.\n\nAvete una possibilità sola. E prima di scrivere qualsiasi cosa, dovete capire a quale problema state rispondendo — perché il quartiere non ne ha uno, ne ha sei, e non potete risolverli tutti con 180.000 euro.";

const INTRO_S2 =
  "Avete undici giorni prima di consegnare. Undici giorni sono cinque approfondimenti, non di più: ogni documento va richiesto, ogni consulente va incontrato, e il tempo è quello che è.\n\nScegliete cosa vale la pena sapere. Quello che non chiedete oggi, non lo saprete quando dovrete decidere.";

const INTRO_S4 = "Quattro giorni. La proposta va scritta. Sono le vostre parole quelle che leggerà la commissione.";

const INTRO_S5 =
  "La proposta è partita. Non saprete l'esito per due mesi. Ma una cosa la sapete già adesso: come avete lavorato.";

// Stanza 3: testo comune + il vincolo del mandato + il colpo del tetto (diverso
// a seconda che la perizia M4 sia stata letta o no).
export function introStanza3(mandato: Mandato | null, letti: Set<string>): string {
  const parti = ["Mancano nove giorni. Arriva una mail dall'ufficio tecnico del Comune. La aprite in sette, in piedi."];
  if (mandato) parti.push(`«${mandato.vincolo.testo}»`);
  parti.push(
    letti.has("M4")
      ? "Come sapevate dalla perizia, restano da mettere in sicurezza 340 m². Avendolo previsto, potete procedere per lotti: 55.000 € in due annualità."
      : "Dalla verifica d'ufficio: 340 m² di copertura risultano inagibili. Messa in sicurezza obbligatoria: 55.000 €.",
  );
  return parti.join("\n\n");
}

// ─────────────────────────────────────────── costruzione della missione

const AREE_CANDIDATE = [
  "informatica-digitale", "salute-professioni-sanitarie", "ristorazione-turismo", "meccanica-meccatronica",
  "agrifood-ambiente", "arte-design-moda", "musica-spettacolo", "energia-sostenibilita", "edilizia-architettura",
  "economia-management", "giurisprudenza-pa", "mobilita-sostenibile", "scienze-educazione", "comunicazione-media",
  "scienze-ricerca", "sicurezza-difesa", "lingue-relazioni-internazionali", "studi-umanistici-beni-culturali",
];

const META: MissioneMeta = {
  slug: SLUG_QUARTIERE,
  titolo: "Il progetto per il quartiere",
  sottotitolo: "L'ex mercato di Via Sanzio, da rigenerare",
  descrizione:
    "L'ex mercato coperto di Via Sanzio, 900 m², chiuso da undici anni. Il Comune lo assegna per nove anni a chi presenta il progetto migliore: c'è un bando, ci sono 180.000 € e una scadenza. Tu sei nel gruppo che scrive la proposta — non decidi da solo, ma la firmi tu. Le tue scelte apriranno e chiuderanno porte: quello che non vorrai sapere ti mancherà quando dovrai decidere. Niente cronometro, niente sconfitta: puoi riprendere quando vuoi.",
  tipo: "cross-area",
};

// Costruisce la missione risolta a partire dalle risposte già date (accessore
// puro). Gli step dinamici (Stanza 2 dossier, Stanza 3 voci/totale/scarto,
// intro del vincolo) dipendono dal mandato e dai materiali letti. Senza mandato
// (catalogo / prima dell'avvio) restituisce la risoluzione di base.
export function costruisciMissione(get: LeggiRisposta): EscapeMission {
  const mandato = mandatoScelto(get);
  const letti = materialiLetti(get);

  const stanza1: Step[] = [
    {
      id: "s1_materiali",
      stanza: 1,
      tipo: "esplora_libero",
      titolo: "Prima di tutto: cosa c'è sul tavolo?",
      prompt: "Apri i documenti che vuoi leggere. Non sei obbligato ad aprirli tutti — ma quello che leggi adesso ti aiuta a capire a chi stai rispondendo.",
      hint: "Ciò che scegli di leggere lascia traccia: dice dove va la tua curiosità.",
      materiali: MATERIALI_LIBERI,
    },
    {
      id: "s1_priorita",
      stanza: 1,
      tipo: "ordina_priorita",
      titolo: "Il quartiere ha detto sei cose diverse. Da cosa partiresti?",
      prompt: "Mettile in ordine, dalla più importante. Le prime scelte pesano di più.",
      elementi: PRIORITA,
    },
    {
      id: "s1_mandato",
      stanza: 1,
      tipo: "scelta_singola",
      titolo: "Il gruppo vi chiede di scrivere il mandato in una frase. Quale?",
      prompt: "È la scelta che decide il resto: da qui in poi tutto ruota attorno a questo.",
      hint: "Non ce n'è una giusta. Scegli quella in cui credi di più.",
      opzioni: MANDATI.map((m) => ({ id: m.id, label: `${m.label} — ${m.frase}`, aree: m.aree, qualita: 0.7 })),
    },
  ];

  const stanza2: Step[] = [
    {
      id: "s2_informazioni",
      stanza: 2,
      tipo: "seleziona_informazioni",
      titolo: "Avete 5 gettoni. Su cosa li spendete?",
      prompt: "Ogni approfondimento costa un gettone e non torna indietro. Aprilo per leggerlo: quello che non apri, non lo saprai quando dovrai decidere.",
      hint: "Puoi restare nel tuo campo o guardarti intorno: sono due stili diversi, nessuno è migliore.",
      budget: 5,
      dossier: dossierStanza2(mandato),
    },
    {
      id: "s2_non_approfondire",
      stanza: 2,
      tipo: "decisione_scritta",
      titolo: "Una cosa che avete deciso di NON approfondire: perché?",
      prompt: "Due o tre righe. Non c'è una risposta giusta: conta che tu sappia perché hai rinunciato a saperlo.",
      hint: "Puoi anche lasciarlo vuoto — ma provarci dice qualcosa di come decidi.",
      minCaratteri: 0,
      facoltativo: true,
    },
  ];

  const stanza3: Step[] = [
    {
      id: "s3_budget",
      stanza: 3,
      tipo: "alloca_budget",
      titolo: "Distribuite il budget tra le voci",
      prompt: "Il colpo del tetto ha cambiato i conti. Metti le risorse dove servono davvero: non puoi coprire tutto.",
      hint: "Dove metti i soldi quando sei stretto racconta le tue priorità più delle parole.",
      totale: totaleBudget(mandato),
      voci: vociBudget(mandato, letti),
    },
    {
      id: "s3_scarto",
      stanza: 3,
      tipo: "scarta_opzione",
      titolo: "Tre cose non ci stanno più. Quali due tagliate?",
      prompt: "Rinuncia a due delle tre. Tieni ciò che per il progetto è davvero essenziale.",
      hint: "Ciò che tieni conta più di ciò che togli.",
      daScartare: 2,
      opzioni: opzioniScarto(letti),
    },
  ];

  const stanza4: Step[] = [
    {
      id: "s4_previsione",
      stanza: 4,
      tipo: "previsione_poi_esito",
      titolo: "Prima di scrivere: quanto reggerà, secondo te?",
      prompt: "Quanto pensi che la vostra proposta reggerà l'esame della commissione?",
      domanda: "La tua sensazione, prima di scrivere",
    },
    {
      id: "s4_proposta",
      stanza: 4,
      tipo: "decisione_scritta",
      titolo: "Scrivete la proposta",
      prompt: "Cosa diventa l'ex mercato, per chi, e come sta in piedi dal terzo anno? Scrivetelo come lo leggerebbe la commissione.",
      hint: "Non servono paroloni: concretezza, coerenza col mandato e col vincolo ricevuto.",
      minCaratteri: 300,
    },
    {
      id: "s4_ruoli",
      stanza: 4,
      tipo: "assegna_ruoli",
      titolo: "Siete in sette. Chi fa cosa nei primi sei mesi?",
      prompt: "Per ogni compito: te ne occupi tu o lo lascia a un altro del gruppo? Quello che ti prendi è quello che ti senti di saper fare.",
      ruoli: RUOLI,
    },
  ];

  const stanza5: Step[] = [
    {
      id: "s5_riflessione",
      stanza: 5,
      tipo: "riflessione",
      titolo: "Ripensando a questi ventidue giorni…",
      prompt: "Qual è il momento in cui ti sei sentito più nel tuo? E quello in cui ti sei sentito più fuori posto?",
      hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.",
      minCaratteri: 120,
    },
    {
      id: "s5_passi",
      stanza: 5,
      tipo: "pianifica_passi",
      titolo: "Se il progetto viene approvato, i primi tre passi?",
      prompt: "Scegli tre passi e mettili in ordine: quale per primo, quale per secondo, quale per terzo.",
      hint: "L'ordine conta: da dove è più saggio cominciare?",
      passi: PASSI,
      quanti: 3,
    },
  ];

  return {
    ...META,
    areeCandidate: AREE_CANDIDATE,
    stanze: [
      { numero: 1, titolo: "Il problema", intro: INTRO_S1, step: stanza1 },
      { numero: 2, titolo: "Cosa volete sapere", intro: INTRO_S2, step: stanza2 },
      { numero: 3, titolo: "Il vincolo", intro: introStanza3(mandato, letti), step: stanza3 },
      { numero: 4, titolo: "La decisione", intro: INTRO_S4, step: stanza4 },
      { numero: 5, titolo: "La riflessione", intro: INTRO_S5, step: stanza5 },
    ],
  };
}

// Metadati del catalogo (una sola missione per ora).
export const MISSIONI: MissioneMeta[] = [META];

// Risolve la missione per slug. Con `get` costruisce il contenuto dinamico
// dalle risposte; senza, la risoluzione di base (catalogo / intro d'avvio).
export function getMissione(slug: string, get?: LeggiRisposta): EscapeMission | undefined {
  if (slug !== SLUG_QUARTIERE) return undefined;
  return costruisciMissione(get ?? (() => undefined));
}

// Elenco piatto degli step di una missione (comodo per il player e il motore).
export function stepDellaMissione(mission: EscapeMission): Step[] {
  return mission.stanze.flatMap((s) => s.step);
}

// Accessore che legge da una Map (usata lato server: risposte dal DB).
export function accessoreDaMappa(mappa: Map<string, Payload>): LeggiRisposta {
  return (id) => mappa.get(id);
}
