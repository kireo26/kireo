// Come KIREO scrive una data, un orario e un numero. Un posto solo.
//
// PERCHÉ ESISTE, e non è una questione di stile. Un componente server su Vercel
// gira con l'orologio della macchina, che è a UTC: `toLocaleString("it-IT")`
// senza `timeZone` produce l'ora di Greenwich, non quella di Roma. Un webinar
// creato per le 15:00 veniva letto 13:00 — dall'admin, dall'ente, e
// dall'Agenda dello studente, che si collegava due ore prima e non trovava
// niente. Il dato era giusto; era la formattazione a mentire.
//
// LA ZONA È FISSA A ROMA, e non si prende dal browser. KIREO è un prodotto
// italiano, gli orari sono quelli della scuola, e un orario che cambia a
// seconda di chi guarda è peggio di uno sbagliato in modo prevedibile: due
// persone che leggono la stessa pagina devono leggere lo stesso orario, anche
// se una delle due è in viaggio.
//
// LE DATE SENZA ORA SONO AL SICURO, e vale la pena sapere perché: una colonna
// `date` torna come "2009-05-14", che `new Date` legge come mezzanotte UTC —
// e Roma è SEMPRE avanti rispetto a UTC, quindi il giorno resta quello. In una
// zona dietro UTC lo stesso valore scivolerebbe al giorno prima.
//
// LA GUARDIA. `npm run test:date` vieta `toLocale*` e `Intl.*Format` fuori da
// questo file: «funziona per caso» e «funziona» non si distinguono guardando —
// una chiamata in un componente client oggi usa la zona di chi guarda e sembra
// giusta, e lo sembrerà finché qualcuno non sposta quel componente sul server.

const ZONA = "Europe/Rome";

/** Gli stessi nomi della piattaforma: inventarne altri vorrebbe dire tenere una tabella di traduzione. */
export type StileData = "full" | "long" | "medium" | "short";

function quando(iso: string | Date): Date {
  return iso instanceof Date ? iso : new Date(iso);
}

/** Solo il giorno: «lunedì 28 settembre 2026» / «28 settembre 2026» / «28 set 2026» / «28/09/26». */
export function formattaData(iso: string | Date, stile: StileData = "long"): string {
  return quando(iso).toLocaleDateString("it-IT", { dateStyle: stile, timeZone: ZONA });
}

/** Giorno e ora: «28 settembre 2026 alle ore 15:00». L'ora è sempre `short` — i secondi non servono a nessuno qui. */
export function formattaDataOra(iso: string | Date, stile: StileData = "long"): string {
  return quando(iso).toLocaleString("it-IT", { dateStyle: stile, timeStyle: "short", timeZone: ZONA });
}

/**
 * Un numero con i separatori italiani. NON ha niente a che vedere con i fusi:
 * sta qui perché «it-IT» viva in un posto solo, e perché la guardia possa
 * vietare `toLocale*` senza eccezioni — una guardia con un elenco di esenzioni
 * è una guardia che qualcuno allarga.
 */
export function formattaNumero(n: number): string {
  return n.toLocaleString("it-IT");
}
