// Le regole della newsletter degli enti, lato TypeScript (30/10). Le regole
// vere stanno nel database (20261117110000): qui ci sono gli stessi numeri
// per dirli PRIMA del clic, e i testi. `npm run test:newsletter` pretende che
// i numeri qui e quelli in SQL siano gli stessi.
//
// ⚠️ LA SCADENZA E IL CONSIGLIO SONO LEGATI, e non come sembra. Di partenza una
// newsletter vale 3 giorni (quello scelto e i due successivi), e il form
// consiglia «per un evento, manda almeno 4 giorni prima». NON è la coda a
// garantire che arrivi prima dell'evento: ogni giorno possono entrare nella
// coda di uno studente fino a 5 newsletter e ne esce una, quindi la coda si
// può allungare senza limite. Garantisce solo la scadenza: o arriva per email
// dentro la finestra, o per email non arriva (dentro KIREO sì). Con 4 di
// anticipo e 3 di validità l'ultimo giorno possibile è due giorni prima
// dell'evento. Chi cambia uno dei due numeri rifà questo conto.
// (La versione di prima, «4 + 3 garantisce l'arrivo», era sbagliata.)

import { orarioItalianoDaIstante } from "@/lib/formato";

export const MAX_NEWSLETTER_AL_GIORNO = 5;
export const GIORNI_VALIDITA = 3;
export const GIORNI_ANTICIPO_CONSIGLIATI = 4;

// ⚠️ L'INVIO PARTE ALLE 7:30 ORA ITALIANA, SEMPRE (Mario: i ragazzi sono
// sull'autobus verso scuola, con il telefono in mano; a mezzogiorno sono a
// lezione). Il cron di Vercel è in UTC e l'Italia cambia ora due volte l'anno:
// un cron fissato in UTC diventerebbe le 8:30 d'estate senza che nessuno se ne
// accorga. Per questo in `vercel.json` ci sono DUE orari (5:30 e 6:30 UTC), e
// la route lavora solo in quello che in Italia è nell'ora delle 7.
export const ORA_ITALIANA_DI_INVIO = 7;

function partiItaliane(istante: Date): { giorno: string; ora: number } {
  // «AAAA-MM-GGTHH:MM» in ora italiana: un formattatore solo, quello di casa.
  const o = orarioItalianoDaIstante(istante);
  return { giorno: o.slice(0, 10), ora: Number(o.slice(11, 13)) };
}

/** Vero solo nell'ora delle 7 in Italia: il giro che parte alle 5:30 o 6:30 UTC. */
export function eOraDiInvio(istante: Date): boolean {
  return partiItaliane(istante).ora === ORA_ITALIANA_DI_INVIO;
}

/** Il giorno di oggi in Italia, `AAAA-MM-GG`. */
export function giornoItaliano(istante: Date): string {
  return partiItaliane(istante).giorno;
}

/** `AAAA-MM-GG` più n giorni. */
export function piuGiorni(giorno: string, n: number): string {
  const d = new Date(`${giorno}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** L'ultimo giorno di partenza di una newsletter, di partenza. */
export function ultimoGiornoDiPartenza(giorno: string): string {
  return piuGiorni(giorno, GIORNI_VALIDITA - 1);
}

export type StatoNewsletter = "bozza" | "in_approvazione" | "approvata" | "rifiutata" | "inviata";

// Testi miei e provvisori (30/10).
export const ETICHETTA_STATO_NEWSLETTER: Record<StatoNewsletter, string> = {
  bozza: "Bozza",
  in_approvazione: "In approvazione",
  approvata: "Approvata",
  rifiutata: "Non approvata",
  inviata: "Inviata",
};

export const TESTI_NEWSLETTER = {
  consiglio: `Per un evento, manda almeno ${GIORNI_ANTICIPO_CONSIGLIATI} giorni prima: se uno studente ha altre newsletter in coda, la tua arriva per email entro ${GIORNI_VALIDITA} giorni o non arriva per email (dentro KIREO arriva comunque il giorno scelto).`,
  partenza: "Parte il giorno scelto, alle 7:30, senza che tu debba fare altro.",
  approvazione:
    "Prima di partire la legge KIREO. Dopo l'approvazione puoi ancora spostare il giorno; se cambi il testo, la rileggiamo.",
  giornoPieno: (giorno: string) => `${giorno}: completo, scegli un altro giorno.`,
  quota: (usate: number, totali: number) =>
    `Newsletter quest'anno accademico: ${usate} di ${totali} (contano anche quelle in approvazione). Al massimo una al mese.`,
  quotaNonLetta: "Non siamo riusciti a leggere quante newsletter hai già usato quest'anno: ricarica la pagina.",
  proposteDiPrima:
    "Le proposte fatte prima del 30 ottobre restano qui come archivio: non vengono inviate.",
};

/** Il messaggio di un rifiuto del database, per chi l'ha provocato. */
export function messaggioErroreNewsletter(messaggio: string | null | undefined): string {
  const m = messaggio ?? "";
  if (m.includes("giorno_completo")) return "Quel giorno è completo: scegli un altro giorno.";
  if (m.includes("una_al_mese")) return "Hai già una newsletter in quel mese: se ne può mandare una al mese.";
  if (m.includes("quota_piano")) return "Hai usato tutte le newsletter del tuo piano per quest'anno accademico.";
  if (m.includes("giorno_passato")) return "Il giorno deve essere da domani in poi.";
  if (m.includes("gia_partita")) return "Questa newsletter parte oggi: non si può più cambiare.";
  if (m.includes("gia_inviata")) return "Questa newsletter è già partita.";
  if (m.includes("scadenza_non_valida")) return "L'ultimo giorno deve essere fra il giorno scelto e i 13 giorni dopo.";
  if (m.includes("oggetto_non_valido")) return "Scrivi un oggetto, di al massimo 150 caratteri.";
  if (m.includes("corpo_non_valido")) return "Il testo deve avere almeno 20 caratteri.";
  if (m.includes("motivo_mancante")) return "Per non approvare serve un motivo: arriva all'ente.";
  if (m.includes("non_in_approvazione")) return "Questa newsletter non è più in approvazione: ricarica la pagina.";
  return "Non è stato possibile salvare. Riprova fra un momento.";
}

export type EsitoNewsletter = {
  destinatari: number;
  inviate: number;
  inCoda: number;
  fallite: number;
  scadute: number;
};

/**
 * Com'è andata, per l'ente. «Per email», sempre: la notifica dentro KIREO
 * arriva a tutti il giorno scelto, quindi chi è rimasto fuori dall'email l'ha
 * ricevuta lo stesso. Testo di Mario per le scadute.
 */
export function testoEsitoNewsletter(e: EsitoNewsletter | null): string[] {
  if (!e) return ["Non siamo riusciti a leggere com'è andata: ricarica la pagina."];
  if (e.destinatari === 0) return ["Nessuno studente la poteva ricevere: fra gli iscritti nessuno si è iscritto da maggiorenne."];
  const righe = [`Inviata a ${e.destinatari === 1 ? "1 studente" : `${e.destinatari} studenti`}.`];
  if (e.inviate !== e.destinatari) righe.push(`Arrivata per email: ${e.inviate}.`);
  if (e.scadute > 0)
    righe.push(
      `${e.scadute} non l'${e.scadute === 1 ? "ha" : "hanno"} ricevuta per email perché ${e.scadute === 1 ? "era" : "erano"} in coda con altre newsletter e questa era scaduta: la ${e.scadute === 1 ? "trova" : "trovano"} dentro KIREO.`,
    );
  if (e.inCoda > 0) righe.push(`Ancora in coda per email: ${e.inCoda}.`);
  if (e.fallite > 0) righe.push(`Email non partite, da riprovare: ${e.fallite}.`);
  return righe;
}
