// GLI EVENTI DI TUTTI GLI ENTI, COME LI LEGGE L'ADMIN (Mario, 27/10).
//
// La forma è quella della pagina dell'ente (`lib/ente/eventiEnte.ts`): una
// riga per evento, niente plancia nell'elenco, gruppi con la loro
// intestazione, uno stato sconosciuto che non sparisce. L'ORDINE NO, e il
// motivo è il mestiere: «l'ente guarda quella pagina per sapere cosa
// succederà; l'admin la guarda per sapere cosa deve fare. Una coda di lavoro
// non si mette dopo un archivio.» Quindi: Da approvare (con il numero) → In
// programmazione → Eventi passati → Rifiutati, che è la sezione che si apre
// quando qualcuno chiede perché.
//
// DUE DIFFERENZE, perché l'elenco è di tutti gli enti:
//  - su ogni riga il NOME DELL'ENTE: su venti titoli, chi l'ha proposto è
//    metà dell'informazione;
//  - le BOZZE NON CI SONO: una bozza è un evento che il suo autore sta ancora
//    scrivendo, non una proposta. Si tolgono nella lettura (`.neq`) e qui, che
//    è il posto provato: se la lettura un giorno le lasciasse passare, questa
//    funzione non le metterebbe comunque in nessuna sezione.
//
// Qui niente rete e niente JSX: la divisione e le frasi, provate da
// `npm run test:eventiadmin`.

import { eventoNonFinito } from "@/lib/app/eventi";
import { COLONNE_EVENTO_ENTE, type EventoEnte, type GruppoEventi } from "@/lib/ente/eventiEnte";

export type EventoAdmin = EventoEnte & { ente: string | null; note_revisione: string | null };

export const COLONNE_EVENTO_ADMIN = `${COLONNE_EVENTO_ENTE}, note_revisione, istituzioni(nome)`;

const GRUPPI_IN_PROGRAMMAZIONE = [{ chiave: "approvato", titolo: "Approvati" }];
// Gli stati che hanno una sezione loro. Tutto il resto — tranne la bozza — è
// uno stato che questa pagina non conosce, e prende un gruppo col suo nome.
const STATI_CON_SEZIONE = new Set(["in_approvazione", "approvato", "rifiutato"]);

export function dividiEventiAdmin<E extends EventoAdmin>(
  eventi: E[],
  ora: Date = new Date(),
): { daApprovare: E[]; inProgrammazione: GruppoEventi<E>[]; passati: E[]; rifiutati: E[] } {
  const t = (e: E) => new Date(e.data_inizio).getTime();
  const consegnati = eventi.filter((e) => e.stato !== "bozza");

  // In attesa di una decisione, di qualunque data: anche uno la cui data è
  // passata aspetta una risposta, e sparire non è una risposta.
  const daApprovare = consegnati.filter((e) => e.stato === "in_approvazione").sort((a, b) => t(a) - t(b));
  // I più recenti in cima: si apre questa sezione per un caso preciso, di solito recente.
  const rifiutati = consegnati.filter((e) => e.stato === "rifiutato").sort((a, b) => t(b) - t(a));

  const vivi = consegnati.filter((e) => e.stato !== "in_approvazione" && e.stato !== "rifiutato");
  const futuri = vivi.filter((e) => eventoNonFinito(e, ora)).sort((a, b) => t(a) - t(b));
  const inProgrammazione: GruppoEventi<E>[] = GRUPPI_IN_PROGRAMMAZIONE.map((g) => ({ ...g, eventi: futuri.filter((e) => e.stato === g.chiave) }));
  for (const stato of Array.from(new Set(futuri.map((e) => e.stato))).filter((st) => !STATI_CON_SEZIONE.has(st))) {
    inProgrammazione.push({ chiave: stato, titolo: stato, eventi: futuri.filter((e) => e.stato === stato) });
  }
  const passati = vivi.filter((e) => !eventoNonFinito(e, ora)).sort((a, b) => t(b) - t(a));

  return { daApprovare, inProgrammazione: inProgrammazione.filter((g) => g.eventi.length > 0), passati, rifiutati };
}

/** L'etichetta della scheda «Da approvare», con il numero accanto. */
export function etichettaDaApprovare(n: number | null): string {
  // Non letto non è zero: «Da approvare (0)» detto con tre eventi in coda fa
  // chiudere la pagina a chi doveva lavorarci.
  return n === null ? "Da approvare" : `Da approvare (${n})`;
}

/**
 * La riga sotto un evento da approvare, o null. ⚠️ Testo mio, provvisorio.
 * Una proposta la cui data è già passata non si approva più per farla
 * accadere: si dice, così la decisione è informata.
 */
export function avvisoDaApprovare(e: EventoAdmin, ora: Date = new Date()): string | null {
  return eventoNonFinito(e, ora) ? null : "La data di questo incontro è già passata.";
}

/** Sotto un rifiutato: la nota che ha ricevuto l'ente, o che non ne ha ricevuta nessuna. ⚠️ Testo mio, provvisorio. */
export function motivoRifiuto(e: EventoAdmin): string {
  const nota = e.note_revisione?.trim();
  return nota ? `Nota di revisione: ${nota}` : "Rifiutato senza una nota di revisione.";
}
