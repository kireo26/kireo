// Le parti dell'export presenze che le DUE route (admin e scuola) devono dire
// allo stesso modo. Due copie divergerebbero — è già successo a queste due route
// con il 403 della scuola.

import { formattaIstante } from "@/lib/formato";

/**
 * ⚠️ «NON CALCOLABILE» E NON UNA CELLA VUOTA (Mario, 11/10/2026): senza
 * `data_fine` i minuti non si possono tagliare alla finestra
 * (`20261011140000`), e la funzione li restituisce `null`. In un foglio, una
 * cella vuota nella colonna dei minuti si legge «zero minuti», cioè «non
 * c'era» — il difetto appena curato su «Toccata da», due colonne più in là,
 * nello stesso file. «Se la frase l'abbiamo scritta è perché il vuoto da solo
 * mentiva.»
 *
 * Chi non si è mai collegato (`primo_ping` nullo) resta vuoto: lì «non c'era»
 * è la verità.
 */
export const MINUTI_NON_CALCOLABILI = "non calcolabile";

/** La riga sotto l'intestazione della sezione presenze, solo quando la parola compare. Di Mario. */
export const NOTA_MINUTI_NON_CALCOLABILI =
  "«non calcolabile» nei minuti significa che l'incontro non ha un orario di fine: la presenza non si può delimitare.";

export function minutiPerExport(riga: { minuti_presenza: number | null; primo_ping: string | null }, dataFine: string | null) {
  if (riga.minuti_presenza !== null) return riga.minuti_presenza;
  if (riga.primo_ping && !dataFine) return MINUTI_NON_CALCOLABILI;
  return null;
}

export function notaMinuti(dataFine: string | null, righe: { primo_ping: string | null }[]): string | null {
  return !dataFine && righe.some((r) => r.primo_ping) ? NOTA_MINUTI_NON_CALCOLABILI : null;
}

/** Un istante per il CSV, o vuoto: l'ora di Roma, mai quella di Greenwich. */
export function istantePerExport(iso: string | null): string | null {
  return iso ? formattaIstante(iso) : null;
}

/**
 * ⚠️ LA COPERTURA OLTRE IL 100 SI SPIEGA, NON SI NASCONDE (Mario, 11/10/2026).
 * Dal giorno in cui il tetto è uscito anche dalla media del report dell'ente
 * (`20261011150000`), quella media può superare il 100 — ed è l'unica cosa che
 * dice che il conteggio non tornava. La frase è di Mario, parola per parola.
 */
export const SPIEGAZIONE_COPERTURA_OLTRE_CENTO =
  "Una copertura oltre il 100% significa che per qualcuno abbiamo registrato più battiti di quanti la durata dell'incontro ne preveda. È un difetto nostro, non una presenza migliore.";

/** Le righe da aggiungere al report sotto la copertura: una sola, e solo quando serve. */
export function righeCoperturaOltreCento(media: unknown): string[][] {
  // `numeric` arriva da PostgREST come numero o come stringa: si legge tutti e due.
  const n = typeof media === "number" ? media : Number(media);
  return Number.isFinite(n) && n > 100 ? [[SPIEGAZIONE_COPERTURA_OLTRE_CENTO]] : [];
}
