// Il rifiuto della verifica di uno studente: i motivi e i testi, in un posto
// solo (01/11, passo 3 del capitolo della scuola; decisione di Mario).
//
// I MOTIVI SONO UN ELENCO CHIUSO, e lo stesso elenco sta nel database
// (`motivo_rifiuto_verifica`, 20261130100000): niente testo libero, perché
// lo legge lo studente. Un campo libero in cui una scuola scrive di un suo
// studente finirebbe davanti a quel ragazzo, scritto da un adulto che non sa
// di scriverlo a lui. Un motivo nuovo è una migrazione nuova, non una frase
// aggiunta qui: `npm run test:rifiuto` confronta i due elenchi.
//
// Le frasi dei due motivi sono di Mario; gli altri testi sono MIEI E
// PROVVISORI. Tutte invarianti nel genere: «non ha confermato che frequenti»,
// mai «come suo studente».

export type MotivoRifiutoVerifica = "non_risulta_studente" | "scuola_sbagliata";

export const MOTIVI_RIFIUTO: readonly MotivoRifiutoVerifica[] = ["non_risulta_studente", "scuola_sbagliata"];

export const TESTO_MOTIVO: Record<MotivoRifiutoVerifica, string> = {
  non_risulta_studente: "Non risulta fra i nostri studenti",
  scuola_sbagliata: "Hai scelto la scuola sbagliata",
};

export const TESTI_RIFIUTO = {
  // Per chi rifiuta, accanto ai due bottoni: dice che il motivo arriva allo studente.
  domanda: "Perché? Lo studente riceverà questo motivo dentro KIREO.",
  annulla: "Annulla",
  // Per lo studente, nel profilo.
  titolo: "La scuola che avevi indicato non ha confermato che la frequenti",
  cosaFare:
    "Ricontrolla qui sotto la scuola che hai scelto. Se è quella giusta, dichiarala di nuovo e parlane con il referente della tua scuola, che potrà verificarti.",
} as const;

export function eMotivoRifiuto(valore: unknown): valore is MotivoRifiutoVerifica {
  return typeof valore === "string" && (MOTIVI_RIFIUTO as readonly string[]).includes(valore);
}

// La riga del profilo: il nome della scuola COPIATO al rifiuto (il codice si
// svuota), il giorno, e il motivo con le parole della scuola.
export function rigaRifiuto(scuola: string, giorno: string, motivo: MotivoRifiutoVerifica): string {
  return `«${scuola}» ha risposto il ${giorno}: «${TESTO_MOTIVO[motivo]}».`;
}
