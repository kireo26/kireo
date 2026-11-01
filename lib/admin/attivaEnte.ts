// L'attivazione di un ente: i testi e la regola che decide se è andata.
// Testi miei e provvisori, tranne la domanda, che è la forma di Mario
// («Attivare Musica Academy?»).

export type EsitoAttivazione = "attivato" | "non_toccato" | "errore";

/**
 * `null` = la scrittura è fallita; un elenco vuoto = sotto RLS non ha toccato
 * niente; una riga che non dice «attiva» = qualcosa l'ha rimessa (un trigger).
 * Solo una riga riletta attiva è «fatto».
 */
export function esitoAttivazione(righe: { stato?: unknown }[] | null): EsitoAttivazione {
  if (righe === null) return "errore";
  if (righe.length !== 1) return "non_toccato";
  return righe[0].stato === "attiva" ? "attivato" : "non_toccato";
}

export const TESTI_ATTIVA_ENTE = {
  bottone: "Attiva",
  domanda: (nome: string) => `Attivare ${nome}?`,
  conseguenza: "Da attivo l'ente pubblica eventi, post e newsletter, e gli studenti lo trovano in KIREO.",
  conferma: "Sì, attiva",
  annulla: "Annulla",
  inCorso: "Attivazione…",
  errore: "Non è stato possibile attivarlo. Riprova.",
  nonToccato: "L'ente non risulta attivato: ricarica la pagina e controlla il suo stato.",
} as const;
