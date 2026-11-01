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
// Tutti i testi sono di Mario (i due motivi, e dal 01/11 il titolo, la riga
// e la cosa da fare). Due scelte dentro, sue: «hai indicato» e non «avevi
// indicato», che mette la scelta al passato come se fosse stata un errore (lo
// decide lo studente, non noi); «non ha confermato» e non «ha risposto», perché
// non c'è stato nessuno scambio, e la data davanti, perché è la prima cosa che
// si vuole sapere. Tutte invarianti nel genere: «non ha confermato che frequenti»,
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
  titolo: "La scuola che hai indicato non ha confermato che la frequenti",
  cosaFare:
    "Ricontrolla la scuola qui sotto. Se è quella giusta, dichiarala di nuovo e parlane con il referente: la verifica la fa lui.",
} as const;

export function eMotivoRifiuto(valore: unknown): valore is MotivoRifiutoVerifica {
  return typeof valore === "string" && (MOTIVI_RIFIUTO as readonly string[]).includes(valore);
}

// La riga del profilo: il nome della scuola COPIATO al rifiuto (il codice si
// svuota), il giorno, e il motivo con le parole della scuola.
export function rigaRifiuto(scuola: string, giorno: string, motivo: MotivoRifiutoVerifica): string {
  return `Il ${giorno} «${scuola}» non ha confermato: «${TESTO_MOTIVO[motivo]}».`;
}
