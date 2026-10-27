// GLI EVENTI DI UN ENTE, COME LI LEGGE L'ENTE (Mario, 27/10).
//
// La pagina di prima teneva tutto in una lista: per ogni evento lo stato, la
// console della diretta, il report, la chiave, il registro dei docenti, il
// bottone per metterlo in evidenza — e sotto, il form di creazione. «Molto
// confusionaria»: chi cercava quando era il prossimo incontro doveva scorrere
// le plance di tutti gli altri. Ora la lista dice solo cosa c'è e quando, e la
// plancia di un evento sta nella sua pagina (`/diretta/[id]`), una sola.
//
// Qui niente rete e niente JSX: la divisione, l'ordine e le frasi, provati da
// `npm run test:eventiente`.

import { eventoNonFinito } from "@/lib/app/eventi";
import { getAreaBySlug } from "@/data/aree";
import { getFiloneBySlug } from "@/data/filoniDocenti";

/**
 * Gli eventi in revisione che un ente può avere insieme. Il form e il conteggio
 * della coda lo leggono da qui. ⚠️ Il database ha la sua copia, ed è quella che
 * decide: il trigger `limite_eventi_in_approvazione` (`20260722100000`). Se
 * cambia uno, cambia l'altro.
 */
export const MAX_EVENTI_IN_REVISIONE = 4;

export type EventoEnte = {
  id: string;
  titolo: string;
  tipo: string;
  data_inizio: string;
  data_fine: string | null;
  stato: string;
  pubblico: string;
  filone: string | null;
  diretta_chiusa_il: string | null;
  diretta_chiusa_presenti: number | null;
};

export const COLONNE_EVENTO_ENTE =
  "id, titolo, tipo, data_inizio, data_fine, stato, pubblico, filone, diretta_chiusa_il, diretta_chiusa_presenti";

export const ETICHETTA_STATO: Record<string, { label: string; classe: string }> = {
  bozza: { label: "Bozza", classe: "bg-white/10 text-kireo-light" },
  in_approvazione: { label: "In attesa di revisione", classe: "bg-kireo-orange/15 text-kireo-orange" },
  approvato: { label: "Approvato", classe: "bg-kireo-green/15 text-kireo-green-light" },
  rifiutato: { label: "Rifiutato", classe: "bg-red-500/15 text-red-300" },
};

// Le parole dell'ente per i tre tipi della colonna (`eventi.tipo`). Un webinar
// è una diretta: lo si dice, perché è la cosa che cambia cosa c'è nella pagina.
export const ETICHETTA_TIPO: Record<string, string> = {
  webinar: "Diretta online",
  workshop: "Workshop",
  altro: "Incontro",
};

/**
 * In programmazione e passati. Il confine è quello del resto del prodotto
 * (`eventoNonFinito`, sulla fine EFFETTIVA): una diretta chiusa alle 14:24 è
 * passata dalle 14:24, una in corso è ancora in programmazione.
 *
 * ⚠️ «In programmazione» non sono solo gli approvati futuri e quelli in attesa
 * di revisione (la richiesta di Mario): ci stanno anche le bozze e i rifiutati
 * non ancora passati. Toglierli non li farebbe sparire dal database, li farebbe
 * sparire dalla vista di chi li ha scritti. La pastiglia dice cosa sono.
 */
export function dividiEventiEnte<E extends EventoEnte>(eventi: E[], ora: Date = new Date()): { inProgrammazione: E[]; passati: E[] } {
  const t = (e: E) => new Date(e.data_inizio).getTime();
  const inProgrammazione = eventi.filter((e) => eventoNonFinito(e, ora)).sort((a, b) => t(a) - t(b));
  const passati = eventi.filter((e) => !eventoNonFinito(e, ora)).sort((a, b) => t(b) - t(a));
  return { inProgrammazione, passati };
}

/** «2 di 4 in attesa di revisione» — in cima a «In programmazione», dove si vede prima di crearne un altro. */
export function testoCodaRevisione(eventi: EventoEnte[]): string {
  const n = eventi.filter((e) => e.stato === "in_approvazione").length;
  return `${n} di ${MAX_EVENTI_IN_REVISIONE} in attesa di revisione`;
}

/** L'area dell'evento, o il filone per un webinar ai docenti. `null` se non ce n'è nessuna. */
export function areaEventoEnte(e: EventoEnte, areeSlugs: string[]): string | null {
  if (e.pubblico === "docenti") return getFiloneBySlug(e.filone)?.nome ?? null;
  const nomi = areeSlugs.map((s) => getAreaBySlug(s)?.nome).filter((n): n is string => !!n);
  return nomi.length > 0 ? nomi.join(", ") : null;
}

/**
 * Com'è andata, nella lista dei passati. ⚠️ Testi miei, provvisori.
 *
 * Si dice solo quello che l'ente può sapere. Una diretta ha la sua ricevuta
 * (chiusa, e con quanti presenti); un incontro in presenza per studenti no: le
 * presenze le registra la scuola, e l'ente non legge le iscrizioni degli
 * studenti (nessuna policy glielo permette, ed è giusto). Per i docenti le
 * presenze le certifica l'ente stesso, nel registro: si contano.
 */
export function esitoEventoPassato(e: EventoEnte, docentiCertificati: number | null): string | null {
  // `docentiCertificati`: il conto del registro per un evento ai docenti, `null` se non si è potuto leggere.
  if (e.stato !== "approvato") return null;
  if (e.tipo === "webinar") {
    if (!e.diretta_chiusa_il) return "Non chiusa: le presenze non sono ancora state certificate.";
    const n = e.diretta_chiusa_presenti;
    if (n === null) return "Chiusa.";
    return `Chiusa · ${n === 1 ? "1 presente" : `${n} presenti`}`;
  }
  if (e.pubblico === "docenti") {
    // Non letto non è zero: «0 presenze certificate» detto a chi ne ha
    // certificate venti lo fa ricominciare.
    if (docentiCertificati === null) return "Non siamo riusciti a contare le presenze certificate: ricarica la pagina.";
    const n = docentiCertificati;
    return n === 1 ? "1 presenza certificata" : `${n} presenze certificate`;
  }
  return "Le presenze le registra la scuola.";
}
