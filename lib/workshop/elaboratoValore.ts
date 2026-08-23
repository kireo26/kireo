import type { FaseElaborato, SezioneElaborato } from "./elaborato-config";

export type ValoreTesto = string;
export type ValoreTabella = Record<string, string>[];
export type ValoreChecklist = { voci: Record<string, boolean>; nota: string };
export type ValoreScelta = { opzione: string; motivazione: string };
export type ValoreSezione = ValoreTesto | ValoreTabella | ValoreChecklist | ValoreScelta;

export function valoreVuoto(sezione: SezioneElaborato): ValoreSezione {
  switch (sezione.tipo) {
    case "testo":
    case "testo_lungo":
    case "immagine":
      // 'immagine': stringa vuota = nessuna immagine caricata, altrimenti
      // percorso Storage (bucket workshop-consegne) — stesso tipo di
      // 'testo', mai un url pubblico (il bucket è privato).
      return "";
    case "tabella":
      // righeIniziali (facoltativo): righe pre-compilate come punto di
      // partenza (es. voci di costo già elencate), altrimenti tabella
      // vuota — restano righe normali, modificabili/rimuovibili.
      return sezione.righeIniziali
        ? sezione.righeIniziali.map((riga) => Object.fromEntries((sezione.colonne ?? []).map((colonna, i) => [colonna, riga[i] ?? ""])))
        : [];
    case "checklist":
      return { voci: {}, nota: "" };
    case "scelta":
      return { opzione: "", motivazione: "" };
  }
}

// Riassunto in testo semplice del valore di una sezione — usato come
// contesto per il tutor AI (modalità "revisione" e come "ho già scritto"
// nella modalità "aiuto"), mai per il salvataggio (quello resta jsonb).
export function serializzaValoreSezione(sezione: SezioneElaborato, valore: ValoreSezione | undefined): string {
  if (valore === undefined) return "";
  switch (sezione.tipo) {
    case "testo":
    case "testo_lungo":
      return typeof valore === "string" ? valore : "";
    case "immagine":
      return typeof valore === "string" && valore ? "[immagine allegata]" : "(nessuna immagine)";
    case "tabella": {
      const righe = Array.isArray(valore) ? (valore as ValoreTabella) : [];
      if (righe.length === 0) return "";
      return righe
        .map((riga) => (sezione.colonne ?? []).map((colonna) => `${colonna}: ${riga[colonna] ?? ""}`).join(", "))
        .join("\n");
    }
    case "checklist": {
      const v = valore as ValoreChecklist;
      const voci = (sezione.voci ?? []).map((voce) => `${v?.voci?.[voce] ? "[x]" : "[ ]"} ${voce}`).join("\n");
      return v?.nota ? `${voci}\nNota: ${v.nota}` : voci;
    }
    case "scelta": {
      const v = valore as ValoreScelta;
      return v?.opzione ? `${v.opzione} — ${v.motivazione || "(nessuna motivazione)"}` : "";
    }
  }
}

// Una sezione "raggiunge il minimo" quando soddisfa la soglia dichiarata
// nel config (minCaratteri/minRighe) o, in assenza di soglia, quando non è
// vuota — usato sia lato client (per abilitare "Consegna la tappa") sia
// lato server (route consegna-tappa, contro il contenuto autorevole letto
// dal DB, mai quello del client).
export function sezioneRaggiungeMinimo(sezione: SezioneElaborato, valore: ValoreSezione | undefined): boolean {
  // Una sezione facoltativa non blocca mai la consegna, a prescindere dal
  // tipo — oggi usato solo per lo schizzo immagine di spazio/la_pianta.
  if (sezione.opzionale) return true;
  if (valore === undefined) return false;
  switch (sezione.tipo) {
    case "testo":
    case "testo_lungo": {
      const testo = typeof valore === "string" ? valore.trim() : "";
      return sezione.minCaratteri ? testo.length >= sezione.minCaratteri : testo.length > 0;
    }
    case "immagine":
      return typeof valore === "string" && valore.length > 0;
    case "tabella": {
      const righe = Array.isArray(valore) ? (valore as ValoreTabella) : [];
      return sezione.minRighe ? righe.length >= sezione.minRighe : righe.length > 0;
    }
    case "checklist": {
      const v = valore as ValoreChecklist;
      return Boolean(v?.voci && Object.values(v.voci).some(Boolean));
    }
    case "scelta": {
      const v = valore as ValoreScelta;
      return Boolean(v?.opzione);
    }
  }
}

// Titoli delle sezioni di una tappa che non raggiungono ancora il minimo
// — array vuoto quando la tappa è pronta per essere consegnata.
export function sezioniIncomplete(fase: FaseElaborato, contenuto: Record<string, ValoreSezione>): string[] {
  return fase.sezioni.filter((s) => !sezioneRaggiungeMinimo(s, contenuto[s.id])).map((s) => s.titolo);
}

// Workshop 2.0 v2 — stato per-tappa (workshop_fasi_stato) e le forme dei
// due feedback generati dal cron via lib/workshop/prompt-revisore.ts:
// la revisione di OGNI tappa (promptRevisore, rubrica-based) e il
// feedback finale dell'ULTIMA tappa (promptFeedbackFinale, complessivo
// sull'intero progetto) — forme diverse apposta, non unificate, per
// restare fedeli ai prompt forniti invece di inventarne una terza forma.
export type RevisioneTappa = {
  punti_forza: string[];
  da_migliorare: string[];
  domanda: string;
  commento_breve: string;
  punteggio_fiducia: number;
};

export type FeedbackFinale = {
  punti_forza: string[];
  da_migliorare: string[];
  messaggio_chiusura: string;
  chiusura_cliente: string;
  punteggio_area: number;
};

export type StatoTappa = "bloccata" | "aperta" | "consegnata" | "revisionata";

// Esito della generazione AI della revisione. NULL = mai tentata (tappa non
// ancora consegnata, o riga antecedente alla migrazione 20260823110000).
export type RevisioneEsito = "riuscita" | "non_riuscita" | "forma_non_valida";

export type FaseStatoRiga = {
  faseId: string;
  stato: StatoTappa;
  apertaAt: string | null;
  consegnataAt: string | null;
  revisionataAt: string | null;
  revisione: RevisioneTappa | null;
  reazioneCliente: string | null;
  revisioneEsito: RevisioneEsito | null;
  tentativiRevisione: number;
};

// Una tappa è «non valutata» se la revisione AI si è arresa: NON conta come
// zero, esce dal DENOMINATORE della barra fiducia (45/75, non 45/100).
export const tappaNonValutata = (riga: FaseStatoRiga | undefined): boolean =>
  riga?.revisioneEsito != null && riga.revisioneEsito !== "riuscita";

// Fiducia massima ottenibile davvero: somma dei fiduciaMax delle sole tappe
// che siamo riusciti a valutare. Pura, così la stessa regola vale ovunque.
export function fiduciaMassima(fasi: { id: string; fiduciaMax: number }[], fasiStato: FaseStatoRiga[]): number {
  return fasi.reduce((tot, f) => {
    const riga = fasiStato.find((r) => r.faseId === f.id);
    return tot + (tappaNonValutata(riga) ? 0 : f.fiduciaMax);
  }, 0);
}
