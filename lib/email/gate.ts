import { isMaggiorenne } from "@/lib/eta";

// Gate email riusabile — PRONTO per il futuro motore di mailing, NON ancora
// applicato a nessun invio esistente (oggi tutti gli invii sono di servizio
// o B2B, vedi sotto). Punto di verità unico per la domanda: «questo invio
// può partire verso questo utente?».
//
// ─────────────────────────────────────────── Le due categorie di email
//
// La distinzione è STRUTTURALE, non un dettaglio di testo: chi aggiunge un
// invio in futuro deve dichiarare a quale categoria appartiene, e il gate
// si comporta di conseguenza.
//
//   "servizio"   — email richieste dall'utente o conseguenti a una sua
//                  azione esplicita (conferma di una richiesta di contatto,
//                  follow-up di una guida scaricata dall'utente, conferma
//                  registrazione, reset password). NESSUN gate età, NESSUN
//                  consenso ulteriore: l'utente le ha di fatto sollecitate.
//
//   "facoltativa" — promemoria, progressione, nudge, newsletter: email che
//                  l'utente NON ha richiesto. Richiedono consenso e sono
//                  soggette al gate 18+ (e a un link di unsubscribe, già
//                  presente nel footer dei template). Il consenso esplicito
//                  e il motore di mailing sono un cantiere a parte: qui c'è
//                  solo il gate età, il tassello che dipende dai dati già
//                  esistenti (profiles.data_nascita).
export type CategoriaEmail = "servizio" | "facoltativa";

// Decide se un invio può partire verso un utente, data la sua data di
// nascita. La data va SEMPRE letta dal database (profiles.data_nascita, il
// record di verità) al momento dell'invio, mai memorizzata come "età": così
// un utente che compie 18 anni durante il percorso entra automaticamente nel
// flusso delle email facoltative, senza alcun ricalcolo manuale.
//
// L'aritmetica dell'età NON è riscritta qui: si riusa isMaggiorenne()
// (lib/eta.ts), l'unica implementazione TS della stessa regola di
// is_maggiorenne() SQL. NULL-safe per costruzione: una data di nascita
// mancante è trattata come minorenne (gate chiuso), coerente con la scelta
// prudenziale «in assenza del dato, blocca» e con current_e_maggiorenne()
// lato DB.
export function puoRicevereEmail(categoria: CategoriaEmail, dataNascita: string | null | undefined): boolean {
  // Le email di servizio sono sempre lecite: l'utente le ha richieste.
  if (categoria === "servizio") return true;
  // Le facoltative partono solo verso i maggiorenni (NULL = minore = no).
  return isMaggiorenne(dataNascita);
}
