import type { SezioneElaborato } from "./elaborato-config";

export type ValoreTesto = string;
export type ValoreTabella = Record<string, string>[];
export type ValoreChecklist = { voci: Record<string, boolean>; nota: string };
export type ValoreScelta = { opzione: string; motivazione: string };
export type ValoreSezione = ValoreTesto | ValoreTabella | ValoreChecklist | ValoreScelta;

export function valoreVuoto(sezione: SezioneElaborato): ValoreSezione {
  switch (sezione.tipo) {
    case "testo":
    case "testo_lungo":
      return "";
    case "tabella":
      return [];
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
