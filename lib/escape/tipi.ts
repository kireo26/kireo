// KIREO Escape — tipi condivisi tra config (contenuto), motore di scoring
// (server) e player (client). Il contenuto è dichiarativo: ogni step e ogni
// opzione è ETICHETTATA con le aree che tocca; il calcolo dei punteggi
// (valore/peso) NON vive qui — sta in lib/escape/scoring.ts (solo server),
// così la logica di punteggio non finisce nel bundle client (anti-gaming).
//
// v2 "Il progetto per il quartiere": le scelte aprono e chiudono porte. Il
// mandato scelto nella Stanza 1 decide quali consulenze esistono nella 2 e
// quale vincolo arriva nella 3; l'informazione costa e non si recupera. Il
// contenuto degli step non è più statico: viene RISOLTO dalle risposte
// precedenti (costruisciMissione in config.ts), sia lato client (player) sia
// lato server (scoring), a partire dallo stesso accessore puro.

export type Dimensione = "interest" | "performance" | "self_efficacy" | "curiosity";

export type StepTipo =
  | "esplora_libero"
  | "scelta_singola"
  | "ordina_priorita"
  | "seleziona_informazioni"
  | "alloca_budget"
  | "scarta_opzione"
  | "previsione_poi_esito"
  | "decisione_scritta"
  | "assegna_ruoli"
  | "riflessione"
  | "pianifica_passi";

// Un'opzione/elemento etichettato con le aree che rappresenta. Molte voci
// toccano più di un'area (es. il mandato "Un posto per crescere" tocca sia
// scienze-educazione sia salute): il motore emette una prova per area.
// `affidabilita` (0..1, facoltativa) è usata solo dalle missioni in cui
// l'ordinamento è una gerarchia di affidabilità verificabile (es. Missione 03,
// "fatti misurati" vs "affermazioni da verificare"): definisce l'ordine ideale.
export type OpzioneArea = { id: string; label: string; aree: string[]; qualita?: number; affidabilita?: number };

// Materiale consultabile (M1-M14 + le consulenze di mandato). `contenuto` è il
// testo con i numeri, mostrato quando lo studente lo apre/acquista. `costo` = 0
// per i materiali sempre disponibili (Stanza 1), 1 per quelli a gettone
// (Stanza 2).
export type Materiale = {
  id: string;
  titolo: string;
  contenuto: string;
  aree: string[];
  costo: number;
  estratti?: { chi: string; testo: string }[]; // solo per il verbale (M2)
};

// Voce del budget (Stanza 3). `soloSe` la rende disponibile solo se lo studente
// ha letto quel materiale (fotovoltaico ← M5, fondo di gestione ← M7).
export type VoceBudget = {
  id: string;
  label: string;
  aree: string[];
  costoIndicativo?: number; // mostrato come guida ("≈ 55.000 €"), non vincolante
  soloSe?: string;
};

// Opzione da scartare (Stanza 3.2). `trappola` = scelta che farebbe respingere
// la domanda; `avviso` viene popolato da costruisciMissione quando lo studente
// ha letto il materiale che la smaschera (M6 → facciata tutelata).
// `trappolaSeScartata` inverte la semantica: la trappola scatta quando l'opzione
// viene SCELTA/scartata (es. Missione 04, dove "rimandare l'accessibilità" è una
// mossa che sembra sensata ma è dannosa), non quando viene tenuta.
export type OpzioneScarto = OpzioneArea & { trappola?: boolean; trappolaSeScartata?: boolean; avviso?: string };

// Un lavoro del cantiere (Missione 04): a differenza di una voce di budget, ha
// DUE grandezze — costo (€) e durata (giorni) — e può dipendere dall'ordine di
// altri lavori. `richiede` = lavori che devono essere inclusi prima (dipendenza
// d'ordine); `essenziale` = senza, il piano non raggiunge l'obiettivo (collaudo);
// `parallelizzabile` = può girare in contemporanea con altri se c'è la seconda
// squadra; `gate` = compare solo se il materiale è stato letto.
export type Lavoro = {
  id: string;
  label: string;
  aree: string[];
  costo: number;
  giorni: number;
  richiede?: string[];
  essenziale?: boolean;
  parallelizzabile?: boolean;
  gate?: string;
};

// Compito da assegnare a sé o ad altri (Stanza 4.3): quello che ci si prende è
// quello che ci si sente di saper fare.
export type Ruolo = { id: string; label: string; area: string };

// Passo di attuazione (Stanza 5.2): se ne scelgono 3 in ordine da una lista.
export type Passo = { id: string; label: string };

// Vincolo che arriva nella Stanza 3, determinato dal mandato scelto in 1.3.
// `id` è libero: alcune missioni lo ispezionano (es. Missione 01 usa "budget"
// per il taglio del totale), altre lo usano solo come chiave.
export type Vincolo = {
  id: string;
  testo: string;
};

// Mandato (Stanza 1.3 — il bivio principale). Determina aree, consulenze extra
// della Stanza 2 e il vincolo della Stanza 3.
export type Mandato = {
  id: string;
  label: string;
  frase: string;
  aree: string[];
  consulenze: Materiale[];
  vincolo: Vincolo;
};

type StepBase = { id: string; stanza: number; titolo: string; prompt: string; hint?: string };

export type StepEsploraLibero = StepBase & { tipo: "esplora_libero"; materiali: Materiale[] };
export type StepSceltaSingola = StepBase & { tipo: "scelta_singola"; opzioni: OpzioneArea[] };
export type StepOrdinaPriorita = StepBase & { tipo: "ordina_priorita"; elementi: OpzioneArea[] };
export type StepSelezionaInformazioni = StepBase & { tipo: "seleziona_informazioni"; budget: number; dossier: Materiale[] };
// `unita` è l'unità di misura del budget (es. "€", "giornate", "ore") e `passo`
// l'incremento dell'input numerico (1000 per gli euro, 1 per giornate/ore).
export type StepAllocaBudget = StepBase & { tipo: "alloca_budget"; totale: number; unita: string; passo: number; voci: VoceBudget[] };

// Pianificazione a selezione (Stanza 3.1): lo studente SELEZIONA voci con costo
// FISSO; il totale sta o non sta dentro il budget. `unitaSoldi` è l'unità del
// costo (es. "€", "cent"). Due varianti:
//  - Missione 04: doppia grandezza (soldi + giorni, `budgetGiorni` presente) +
//    dipendenze d'ordine tra i lavori;
//  - Missione 06: singola grandezza (`budgetGiorni` assente), e una voce può
//    avere COSTO NEGATIVO (libera margine invece di consumarlo).
export type StepPianificaLavori = StepBase & { tipo: "pianifica_lavori"; lavori: Lavoro[]; budgetSoldi: number; unitaSoldi: string; budgetGiorni?: number };
export type StepScartaOpzione = StepBase & { tipo: "scarta_opzione"; opzioni: OpzioneScarto[]; daScartare: number };
export type StepPrevisionePoiEsito = StepBase & { tipo: "previsione_poi_esito"; domanda: string };
export type StepDecisioneScritta = StepBase & { tipo: "decisione_scritta"; minCaratteri: number; facoltativo?: boolean };
export type StepAssegnaRuoli = StepBase & { tipo: "assegna_ruoli"; ruoli: Ruolo[] };
export type StepRiflessione = StepBase & { tipo: "riflessione"; minCaratteri: number };
export type StepPianificaPassi = StepBase & { tipo: "pianifica_passi"; passi: Passo[]; quanti: number };

export type Step =
  | StepEsploraLibero
  | StepSceltaSingola
  | StepOrdinaPriorita
  | StepSelezionaInformazioni
  | StepAllocaBudget
  | StepPianificaLavori
  | StepScartaOpzione
  | StepPrevisionePoiEsito
  | StepDecisioneScritta
  | StepAssegnaRuoli
  | StepRiflessione
  | StepPianificaPassi;

export type Stanza = { numero: number; titolo: string; intro: string; step: Step[] };

export type EscapeMission = {
  slug: string;
  titolo: string;
  sottotitolo: string;
  descrizione: string;
  tipo: "cross-area" | "mono-area";
  // Aree "candidate" della missione: passate all'AI per vincolare a queste
  // l'estrazione dalle risposte aperte. In v2 la missione tocca tutte e 18.
  areeCandidate: string[];
  stanze: Stanza[];
};

// Metadati per il catalogo (client), senza il contenuto risolto.
export type MissioneMeta = Pick<EscapeMission, "slug" | "titolo" | "sottotitolo" | "descrizione" | "tipo">;

// ── Payload delle risposte (salvati in step_response.payload) ──
export type PayloadEsplora = { letti: string[] };
export type PayloadSceltaSingola = { opzioneId: string };
export type PayloadOrdina = { ordine: string[] }; // ids in ordine di priorità (0 = più prioritario)
export type PayloadSeleziona = { selezionati: string[] };
export type PayloadAlloca = { allocazioni: Record<string, number> };
export type PayloadLavori = { selezionati: string[] };
export type PayloadScarta = { scartati: string[]; motivazione?: string };
export type PayloadPrevisione = { fiducia: number }; // 0..100
export type PayloadTesto = { testo: string };
export type PayloadAssegna = { assegnazioni: Record<string, "io" | "altri"> };
export type PayloadPianifica = { passi: string[] }; // ids scelti, in ordine

export type Payload =
  | PayloadEsplora
  | PayloadSceltaSingola
  | PayloadOrdina
  | PayloadSeleziona
  | PayloadAlloca
  | PayloadLavori
  | PayloadScarta
  | PayloadPrevisione
  | PayloadTesto
  | PayloadAssegna
  | PayloadPianifica;

// Accessore puro alle risposte salvate: sia il player (Record in stato React)
// sia il server (Map dal DB) espongono lo stesso `(id) => payload | undefined`,
// così costruisciMissione e le derivazioni non dipendono dal contenitore.
export type LeggiRisposta = (id: string) => Payload | undefined;

// Prova prodotta dal motore, passata a registra_evidence come array JSON.
export type EvidenceInput = {
  area_slug: string | null;
  dimensione: Dimensione;
  valore: number; // 0..1
  peso: number; // > 0
  motivazione: string;
  step_id: string;
};
