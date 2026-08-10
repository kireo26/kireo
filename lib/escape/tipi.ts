// KIREO Escape — tipi condivisi tra config (contenuto), motore di scoring
// (server) e player (client). Il contenuto è dichiarativo: ogni step e ogni
// opzione è ETICHETTATA con l'area_slug che tocca; il calcolo dei punteggi
// (valore/peso) NON vive qui — sta in lib/escape/scoring.ts (solo server),
// così la logica di punteggio non finisce nel bundle client (anti-gaming).

export type Dimensione = "interest" | "performance" | "self_efficacy" | "curiosity";

export type StepTipo =
  | "scelta_singola"
  | "ordina_priorita"
  | "seleziona_informazioni"
  | "alloca_budget"
  | "scarta_opzione"
  | "previsione_poi_esito"
  | "decisione_scritta"
  | "riflessione";

// Un'opzione/elemento/voce etichettato con l'area che rappresenta. `qualita`
// (0..1, facoltativa) indica quanto quell'opzione è "robusta"/essenziale, usata
// dal motore per la dimensione performance dove ha senso.
export type OpzioneArea = { id: string; label: string; areaSlug: string; qualita?: number };
export type Dossier = OpzioneArea & { costo: number };

type StepBase = { id: string; stanza: number; titolo: string; prompt: string; hint?: string };

export type StepSceltaSingola = StepBase & { tipo: "scelta_singola"; opzioni: OpzioneArea[] };
export type StepOrdinaPriorita = StepBase & { tipo: "ordina_priorita"; elementi: OpzioneArea[] };
export type StepSelezionaInformazioni = StepBase & { tipo: "seleziona_informazioni"; budget: number; dossier: Dossier[] };
export type StepAllocaBudget = StepBase & { tipo: "alloca_budget"; totale: number; voci: OpzioneArea[] };
export type StepScartaOpzione = StepBase & { tipo: "scarta_opzione"; opzioni: OpzioneArea[]; daScartare: number };
export type StepPrevisionePoiEsito = StepBase & { tipo: "previsione_poi_esito"; domanda: string };
export type StepDecisioneScritta = StepBase & { tipo: "decisione_scritta"; minCaratteri: number };
export type StepRiflessione = StepBase & { tipo: "riflessione"; minCaratteri: number };

export type Step =
  | StepSceltaSingola
  | StepOrdinaPriorita
  | StepSelezionaInformazioni
  | StepAllocaBudget
  | StepScartaOpzione
  | StepPrevisionePoiEsito
  | StepDecisioneScritta
  | StepRiflessione;

export type Stanza = { numero: number; titolo: string; intro: string; step: Step[] };

export type EscapeMission = {
  slug: string;
  titolo: string;
  sottotitolo: string;
  descrizione: string;
  tipo: "cross-area" | "mono-area";
  // Aree "candidate" della missione: l'insieme delle aree toccate dagli step,
  // passato all'AI per vincolare a queste l'estrazione dalle risposte aperte.
  areeCandidate: string[];
  stanze: Stanza[];
};

// ── Payload delle risposte (salvati in step_response.payload) ──
export type PayloadSceltaSingola = { opzioneId: string };
export type PayloadOrdina = { ordine: string[] }; // ids in ordine di priorità (0 = più prioritario)
export type PayloadSeleziona = { selezionati: string[] };
export type PayloadAlloca = { allocazioni: Record<string, number> };
export type PayloadScarta = { scartati: string[]; motivazione?: string };
export type PayloadPrevisione = { fiducia: number }; // 0..100
export type PayloadTesto = { testo: string };

export type Payload =
  | PayloadSceltaSingola
  | PayloadOrdina
  | PayloadSeleziona
  | PayloadAlloca
  | PayloadScarta
  | PayloadPrevisione
  | PayloadTesto;

// Prova prodotta dal motore, passata a registra_evidence come array JSON.
export type EvidenceInput = {
  area_slug: string | null;
  dimensione: Dimensione;
  valore: number; // 0..1
  peso: number; // > 0
  motivazione: string;
  step_id: string;
};
