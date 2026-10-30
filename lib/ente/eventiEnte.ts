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
  // La nota di chi ha rivisto l'evento (27/10): fino ad allora l'ente non la
  // leggeva da nessuna parte, mentre il campo dell'admin prometteva «visibile
  // all'ente». Un rifiuto che porta una ragione che nessuno vede è muto uguale.
  // ⚠️ NON SI LEGGE DALLA TABELLA (20261101100000/110000): la colonna è fuori
  // dalla lettura del client, perché `eventi_select_approvati` la mostrava a
  // chiunque. Arriva da `note_revisione_eventi`, che la dà solo all'admin e
  // all'organizzatore (`leggiNoteRevisione`). `undefined` = non letta, che NON
  // è «senza nota».
  note_revisione?: string | null;
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
 * ⚠️ IL TITOLO DI UNA SEZIONE È UN'AFFERMAZIONE SU TUTTO QUELLO CHE CONTIENE
 * (Mario, 27/10). La prima stesura metteva i rifiutati dentro «In
 * programmazione», perché toglierli li avrebbe fatti sparire dalla vista di chi
 * li ha scritti: la ragione era giusta, la cura no — un rifiutato non è in
 * programmazione e non lo sarà mai, e lì rendeva falso il titolo. Ora:
 *  - «In programmazione» ha i suoi gruppi, ognuno con la sua intestazione e i
 *    più vicini in cima: approvati, in attesa di revisione, bozze (una bozza è
 *    un evento che si sta preparando, quindi è in programmazione);
 *  - i rifiutati stanno in un gruppo loro, in fondo alla stessa pagina, di
 *    qualunque data: un rifiutato non è nemmeno «passato», non c'è mai stato;
 *  - «Eventi passati» ha gli eventi finiti che non sono stati rifiutati.
 */
export type GruppoEventi<E> = { chiave: string; titolo: string; eventi: E[] };

const GRUPPI_IN_PROGRAMMAZIONE = [
  { chiave: "approvato", titolo: "Approvati" },
  { chiave: "in_approvazione", titolo: "In attesa di revisione" },
  { chiave: "bozza", titolo: "Bozze" },
];

export function dividiEventiEnte<E extends EventoEnte>(
  eventi: E[],
  ora: Date = new Date(),
): { inProgrammazione: GruppoEventi<E>[]; rifiutati: E[]; passati: E[] } {
  const t = (e: E) => new Date(e.data_inizio).getTime();
  const rifiutati = eventi.filter((e) => e.stato === "rifiutato").sort((a, b) => t(a) - t(b));
  const vivi = eventi.filter((e) => e.stato !== "rifiutato");
  const futuri = vivi.filter((e) => eventoNonFinito(e, ora)).sort((a, b) => t(a) - t(b));
  const noti = new Set(GRUPPI_IN_PROGRAMMAZIONE.map((g) => g.chiave));
  const inProgrammazione = GRUPPI_IN_PROGRAMMAZIONE.map((g) => ({ ...g, eventi: futuri.filter((e) => e.stato === g.chiave) }));
  // Uno stato che i gruppi non conoscono non sparisce: ha un gruppo suo, col
  // nome dello stato, finché qualcuno non gli dà un titolo vero.
  for (const stato of Array.from(new Set(futuri.map((e) => e.stato))).filter((st) => !noti.has(st))) {
    inProgrammazione.push({ chiave: stato, titolo: stato, eventi: futuri.filter((e) => e.stato === stato) });
  }
  const passati = vivi.filter((e) => !eventoNonFinito(e, ora)).sort((a, b) => t(b) - t(a));
  return { inProgrammazione: inProgrammazione.filter((g) => g.eventi.length > 0), rifiutati, passati };
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

/**
 * Sotto un rifiutato: la nota di revisione, o che non ce n'è nessuna. La legge
 * l'ente (la sua lista e la pagina dell'evento) e la legge l'admin (la scheda
 * Rifiutati): lo stesso testo, perché è lo stesso fatto. ⚠️ Testo mio,
 * provvisorio. Dal 27/10 un rifiuto senza nota non si può più scrivere
 * (`lib/admin/rifiuto.ts`): la seconda frase resta per le righe di prima.
 */
export function motivoRifiuto(e: Pick<EventoEnte, "note_revisione">): string {
  // Non letta non è «senza nota»: dire «rifiutato senza una nota» a chi una
  // nota ce l'ha sarebbe la bugia di prima spostata di posto.
  if (e.note_revisione === undefined) return "Non siamo riusciti a leggere la nota di revisione: ricarica la pagina.";
  const nota = e.note_revisione?.trim();
  return nota ? `Nota di revisione: ${nota}` : "Rifiutato senza una nota di revisione.";
}

/** La nota sotto un evento NON rifiutato, se c'è (un'approvazione con una richiesta), o `null`. ⚠️ Testo mio, provvisorio. */
export function notaRevisione(e: Pick<EventoEnte, "note_revisione">): string | null {
  const nota = e.note_revisione?.trim();
  return nota ? `Nota di revisione: ${nota}` : null;
}


// ⚠️ DOPO LA CREAZIONE IL MODULO TORNA, E LA CONFERMA DICE DOVE GUARDARE
// (Mario, 30/10). Fino a oggi la conferma prendeva il posto del modulo e
// diceva «Puoi seguirne lo stato qui sotto» su una pagina dove sotto non c'è
// niente dal 27/10: una frase che indica un posto vuoto fa dubitare di una cosa
// andata bene. Ora la conferma nomina il posto vero e ci porta. Si dice solo se
// l'evento si è riletto dal database. Testi miei e provvisori.
export const TESTI_EVENTO_CREATO = {
  titolo: "Evento inviato in approvazione",
  dettaglio: "KIREO lo revisiona prima che compaia pubblicamente. Lo trovi in «In programmazione», fra quelli in attesa di revisione:",
  link: "vai all'evento",
} as const;
