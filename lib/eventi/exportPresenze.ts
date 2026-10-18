// Le parti dell'export presenze che le DUE route (admin e scuola) devono dire
// allo stesso modo. Due copie divergerebbero — è già successo a queste due route
// con il 403 della scuola.

import { formattaIstante } from "@/lib/formato";

/**
 * ⚠️ ZERO E NON UNA CELLA VUOTA per chi non si è mai collegato (Mario,
 * 11/10/2026, dopo il primo giro). «Non c'era» era vero, e la cella non lo
 * diceva: una cella vuota non afferma niente, in un foglio si legge «manca il
 * dato», e il lettore la riempie da solo con quello che gli pare. Il fatto è
 * «zero minuti», e lo zero è un'affermazione. Nella colonna convivono tre stati,
 * e adesso hanno tre forme:
 *
 *   0                 iscritto, non si è collegato          ← un fatto
 *   non calcolabile   collegato, ma l'incontro non ha fine
 *   (vuoto)           nessun caso
 */
export const MINUTI_MAI_COLLEGATO = 0;

/**
 * ⚠️ «NON CALCOLABILE» E NON UNA CELLA VUOTA (Mario, 11/10/2026): senza
 * `data_fine` i minuti non si possono tagliare alla finestra
 * (`20261011140000`), e la funzione li restituisce `null`. In un foglio, una
 * cella vuota nella colonna dei minuti si legge «zero minuti», cioè «non
 * c'era» — il difetto appena curato su «Toccata da», due colonne più in là,
 * nello stesso file. «Se la frase l'abbiamo scritta è perché il vuoto da solo
 * mentiva.»
 *
 * (Chi non si è mai collegato prende 0: vedi sopra.)
 */
export const MINUTI_NON_CALCOLABILI = "non calcolabile";

/** La riga sotto l'intestazione della sezione presenze, solo quando la parola compare. Di Mario. */
export const NOTA_MINUTI_NON_CALCOLABILI =
  "«non calcolabile» nei minuti significa che l'incontro non ha un orario di fine: la presenza non si può delimitare.";

export function minutiPerExport(riga: { minuti_presenza: number | null; primo_ping: string | null }) {
  if (riga.minuti_presenza !== null) return riga.minuti_presenza;
  if (!riga.primo_ping) return MINUTI_MAI_COLLEGATO;
  // Collegato e senza un numero: l'unica ragione possibile è che l'incontro
  // non ha un orario di fine. Se mai ce ne fosse un'altra, «non calcolabile»
  // resta vero — la cella vuota no.
  return MINUTI_NON_CALCOLABILI;
}

export function notaMinuti(dataFine: string | null, righe: { primo_ping: string | null }[]): string | null {
  return !dataFine && righe.some((r) => r.primo_ping) ? NOTA_MINUTI_NON_CALCOLABILI : null;
}

/**
 * ⚠️ DUE COLONNE CON DUE DEFINIZIONI, e il file deve dirlo (Mario, 11/10/2026).
 * «Primo ingresso» è il battito GREZZO (17:08), «Minuti presenza» è tagliato
 * alla finestra dell'incontro (2,4). Chi sottrae a mano ottiene 8,9 e conclude
 * che sbagliamo noi. Gli orari grezzi restano — sono la prova — e la frase,
 * di Mario, sta sotto la sezione. Solo dove le due colonne ci sono (la sezione
 * dei docenti non ha gli orari) e solo se qualcuno si è collegato prima
 * dell'inizio: una nota che c'è sempre smette di essere letta.
 */
export const NOTA_MINUTI_FINESTRA =
  "I minuti di presenza si contano dentro la finestra dell'incontro: se qualcuno si è collegato prima dell'inizio, non coincidono con la differenza fra le due colonne.";

export function notaFinestra(dataInizio: string | null, righe: { primo_ping: string | null }[]): string | null {
  if (!dataInizio) return null;
  const inizio = new Date(dataInizio).getTime();
  return righe.some((r) => r.primo_ping && new Date(r.primo_ping).getTime() < inizio) ? NOTA_MINUTI_FINESTRA : null;
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
