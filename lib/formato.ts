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
//
// ⚠️ E UN FORMATTATORE CONDIVISO NON È AL SICURO PER IL FATTO DI ESSERE
// CONDIVISO. Questo file esisteva già il 28/09, ed era la cinquantatreesima
// chiamata col difetto: scritto con `Intl.DateTimeFormat`, quindi invisibile a
// una ricerca su `toLocale`. Centralizzare mette le cose in un posto solo; non
// le rende giuste. Per questo la guardia controlla la zona DENTRO questo file,
// su ogni formattatore, e non solo fuori.

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

/** Solo l'ora: «19:15». Serve a dire a che ora comincia una cosa che comincia oggi. */
export function formattaOra(iso: string | Date): string {
  return quando(iso).toLocaleTimeString("it-IT", { timeStyle: "short", timeZone: ZONA });
}

/**
 * Due istanti cadono nello stesso giorno ITALIANO. Passa da `formattaData`
 * invece di confrontare i componenti a mano: la zona resta scritta in un posto
 * solo, e due istanti a cavallo della mezzanotte di Roma non risultano lo
 * stesso giorno solo perché lo sono a Greenwich.
 */
export function stessoGiornoItaliano(a: string | Date, b: string | Date): boolean {
  return formattaData(a, "short") === formattaData(b, "short");
}

// ─────────────────────────── L'ALTRA METÀ: L'INGRESSO ───────────────────────
//
// PERCHÉ ESISTE. Fissare la zona in USCITA lascia aperta la metà simmetrica:
// `<input type="datetime-local">` restituisce "2026-09-28T15:00" senza fuso, e
// `new Date(quella stringa)` la interpreta nella zona DEL BROWSER DI CHI
// COMPILA. Per un ente italiano le due metà si annullano, quindi chi prova oggi
// non vede niente di strano — ed è la forma peggiore: un errore che aspetta, e
// che quando arriva colpisce un evento solo, quindi verrà scambiato per un caso
// isolato.
//
// LA PROPRIETÀ: quello che l'ente digita è UN ORARIO DI SCUOLA ITALIANA, non un
// orario di chi lo digita. «15:00» deve produrre lo stesso istante da Napoli,
// da Londra e da una macchina configurata male.

const FORMATO_LOCALE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Quanto Roma è avanti rispetto a UTC in quell'istante, in millisecondi.
 * Si ricava leggendo l'ora di Roma e rimontandola come se fosse UTC: la
 * differenza è l'offset. Nessuna tabella di fusi da tenere aggiornata — la sa
 * già la piattaforma, e la sa anche per gli anni futuri.
 */
function offsetDiRoma(istante: number): number {
  const p: Record<string, string> = {};
  for (const parte of new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(istante))) {
    p[parte.type] = parte.value;
  }
  const comeSeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return comeSeUtc - istante;
}

/**
 * Da un valore di `<input type="datetime-local">` all'istante che quell'orario
 * indica **in Italia**. Restituisce una stringa ISO, o `null` se la stringa non
 * ha quella forma.
 *
 * NULL E NON UN RIPIEGO, di proposito: un ripiego silenzioso scriverebbe un
 * istante sbagliato di ore, e nessuno lo vedrebbe. Chi chiama tratta il null
 * come un errore di campo, dove l'ente può ancora correggere.
 *
 * L'OFFSET SI CALCOLA DUE VOLTE perché nel giorno del cambio d'ora il primo
 * candidato può cadere dall'altra parte della transizione. Il caso concreto,
 * trovato eseguendo le due versioni su ogni mezz'ora intorno alle transizioni:
 * le 01:30 dell'ultima domenica di marzo, che con una passata sola finiscono
 * alle 23:30 del GIORNO PRIMA. «Subito dopo il cambio» esce giusto anche con
 * una passata sola, quindi non è quello il caso da provare.
 *
 * Un orario che nel cambio d'ora non esiste (le 02:30 di marzo) scivola in
 * avanti, uno ambiguo (le 02:30 di ottobre) prende la seconda occorrenza —
 * deterministico, e nessuna delle due capita a un orario di scuola.
 */
export function istanteDaOrarioItaliano(locale: string): string | null {
  const m = FORMATO_LOCALE.exec(locale.trim());
  if (!m) return null;
  const comeSeUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
  const primoTentativo = comeSeUtc - offsetDiRoma(comeSeUtc);
  return new Date(comeSeUtc - offsetDiRoma(primoTentativo)).toISOString();
}

/**
 * Lo stesso valore come numero di millisecondi, per i confronti. `NaN` quando
 * la stringa non è un orario: un confronto con `NaN` è sempre falso, quindi un
 * campo malformato non fa scattare un avviso per sbaglio.
 */
export function millisecondiDaOrarioItaliano(locale: string): number {
  const iso = istanteDaOrarioItaliano(locale);
  return iso === null ? NaN : new Date(iso).getTime();
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
