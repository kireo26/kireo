// Cosa legge un moderatore sulla riga di una domanda: chi l'ha toccata e
// quando.
//
// ⚠️ PERCHÉ ESISTE: l'ente e l'admin vedono la STESSA lista con gli STESSI due
// bottoni, lo stato è condiviso e si propaga in 15 secondi — e la riga non
// diceva chi l'avesse toccata. Con un moderatore e un presentatore, al minuto
// tre rispondono entrambi alla stessa domanda davanti a una classe, e al
// successivo nessuno risponde a quella dopo perché ognuno crede che ci stia
// pensando l'altro.
//
// ⚠️ PERCHÉ È UN VALORE E NON RAMI DENTRO IL JSX: una frase composta in un
// `.tsx` non si può provare da uno script Node. Stessa forma di
// `lib/eventi/chiusuraDiretta.ts`, `lib/contatti/testi.ts`,
// `lib/guide/avvisoRifiuto.ts`.

import { formattaOra, stessoGiornoItaliano, formattaDataOra } from "@/lib/formato";

export type ToccoDaTipo = "kireo" | "ente";

/** Lo stato di una domanda come lo restituisce `domande_live_organizzatore`. */
export type StatoDomanda = "nuova" | "letta" | "risposta_live";

/**
 * ⚠️ QUESTA TABELLA È QUELLO CHE TIENE «niente su una domanda nuova», e l'ha
 * detto una controprova che non ha morso: togliendo la guardia esplicita su
 * `nuova` in testa a `rigaTocco`, le 33 proprietà restano VERDI, perché
 * `nuova` non ha una voce qui e il `if (!cosa) return null` la prende comunque.
 * La guardia copre un SOTTOINSIEME di quello che copre l'assenza della voce
 * (che prende anche uno stato che non conosciamo affatto): resta perché dice
 * l'intenzione a chi legge e risparmia una ricerca, non perché protegga.
 *
 * Quindi: una voce `nuova` qui dentro è il modo di far dire alla riga una cosa
 * su un fatto che non è avvenuto, e `npm run test:tocco` pretende che non ci
 * sia — la guardia da sola non basterebbe a impedirlo il giorno in cui
 * qualcuno la tolga credendola ridondante.
 */
const COSA: Record<Exclude<StatoDomanda, "nuova">, string> = {
  letta: "Letta",
  risposta_live: "Risposta in diretta",
};

// «dall'organizzatore» e non «dall'ente»: è la parola di Mario, e nomina il
// ruolo invece della relazione con chi legge — questa riga la leggono tutti e
// due i moderatori, quindi «l'hai letta tu» sarebbe falsa per uno dei due.
const DA: Record<ToccoDaTipo, string> = {
  kireo: "da KIREO",
  ente: "dall'organizzatore",
};

/**
 * ⚠️ IL TESTO DELLA QUINTA, e non è «sconosciuto»: una riga toccata prima
 * dell'11/10/2026 ha uno stato e non un autore, perché allora non lo
 * scrivevamo. «Sconosciuto» suona come un dato mancante per errore; «autore non
 * registrato» dice il fatto — all'epoca quella cosa non si registrava.
 *
 * Tiene la STESSA POSIZIONE delle altre quattro (etichetta, poi chi e quando) e
 * al posto di chi e quando mette la verità, così nessuno la scambia per una di
 * loro.
 *
 * ⚠️ E QUESTA VARIANTE HA UNA SCADENZA: le righe senza autore sono poche e non
 * cresceranno più. Fra un anno, se nel frattempo le domande di prima
 * dell'11/10/2026 sono sparite, questo ramo si può togliere — e sta scritto qui
 * perché altrimenti resta per sempre un ramo che nessuno sa perché c'è
 * (l'ombra di un ternario, scritta da noi oggi).
 */
const SENZA_AUTORE = "autore non registrato";

/**
 * La riga del tocco, o `null` quando non c'è niente da dire.
 *
 * I CINQUE CASI, e il quinto è la ragione per cui questa funzione esiste
 * invece di un'interpolazione:
 *
 *   1-4. stato × parte: «Letta da KIREO · 19:14», «Letta dall'organizzatore ·
 *        19:14», «Risposta in diretta da KIREO · 19:16», «Risposta in diretta
 *        dall'organizzatore · 19:16».
 *     5. STATO AVANZATO SENZA AUTORE → «Letta · autore non registrato». Una
 *        domanda toccata prima dell'11/10/2026 ha `stato = 'letta'` e
 *        `stato_da_tipo` nullo, perché allora non si registrava — e dire solo
 *        «Letta» la farebbe leggere come le altre quattro, mentre è una riga di
 *        cui non sappiamo niente. Vedi `SENZA_AUTORE` per il testo e la sua
 *        scadenza.
 *
 * Su una domanda `nuova` torna `null`: non c'è nessuna transizione da
 * descrivere, e una riga che dicesse qualcosa lì sarebbe una riga su un fatto
 * che non è avvenuto.
 *
 * ⚠️ L'ORA SENZA LA DATA quando il tocco è di oggi, con la data quando non lo
 * è. Durante una diretta la data è rumore — tutto è di adesso — ma su un evento
 * riaperto il giorno dopo «alle 19:05» da solo sembrerebbe di oggi. Stesso
 * ragionamento (e stessa funzione) dell'attesa di `lib/live.ts`.
 */
export function rigaTocco(
  domanda: { stato: string; stato_da_tipo: string | null; stato_il: string | null },
  adesso: Date = new Date(),
): string | null {
  // Dice l'intenzione e risparmia una ricerca; a TENERE la proprietà è
  // l'assenza di una voce `nuova` in `COSA` (vedi il suo commento).
  if (domanda.stato === "nuova") return null;
  const cosa = COSA[domanda.stato as Exclude<StatoDomanda, "nuova">];
  if (!cosa) return null;

  // Il tipo arriva come testo libero (il CHECK ammette due valori, ma una
  // `select` non lo sa): uno che non riconosciamo vale come assente — meglio
  // «letta» che «letta da» una parte che non sappiamo nominare.
  const parte = domanda.stato_da_tipo === "kireo" || domanda.stato_da_tipo === "ente" ? DA[domanda.stato_da_tipo] : null;
  if (!domanda.stato_il || !parte) return `${cosa} · ${SENZA_AUTORE}`;

  // L'ora da sola quando il tocco è di oggi: il «·» fa già da separatore, e
  // «alle» dentro una riga che è già fatta di pezzi separati è una parola in
  // più. La data compare per intero quando il giorno non è questo.
  const quando = stessoGiornoItaliano(domanda.stato_il, adesso)
    ? formattaOra(domanda.stato_il)
    : formattaDataOra(domanda.stato_il, "long");
  return `${cosa} ${parte} · ${quando}`;
}

/**
 * La colonna «Toccata da» dell'export CSV.
 *
 * ⚠️ IL DIFETTO DA CUI NASCE (§0c, 11/10/2026, sul primo CSV mai sceso): una
 * domanda `risposta_live` senza autore usciva con la cella VUOTA, mentre a
 * schermo la stessa domanda dice «Risposta in diretta · autore non registrato».
 * Due superfici, lo stesso fatto, una lo dice e l'altra tace — e in un file il
 * vuoto si legge «nessuno l'ha toccata», che è il contrario. «Se l'abbiamo
 * scritta è perché il vuoto da solo mentiva» (Mario).
 *
 * Usa `SENZA_AUTORE`, la stessa costante dello schermo: due copie della stessa
 * frase divergerebbero. Su una domanda `nuova` resta vuota, ed è giusto: lì
 * nessuno l'ha toccata davvero. Un valore registrato esce TRADOTTO (25/10).
 */
// ⚠️ 25/10: «un valore registrato esce com'è» era il difetto — `kireo`/`ente`
// sono i valori della macchina. Chi apre il CSV legge KIREO / L'organizzatore.
const TOCCATA_DA_EXPORT: Record<ToccoDaTipo, string> = { kireo: "KIREO", ente: "L'organizzatore" };

export function toccataDaPerExport(domanda: { stato: string; toccata_da: string | null }): string | null {
  if (domanda.toccata_da) return TOCCATA_DA_EXPORT[domanda.toccata_da as ToccoDaTipo] ?? domanda.toccata_da;
  if (domanda.stato === "nuova") return null;
  return SENZA_AUTORE;
}

/**
 * La colonna «Toccata il» dell'export, accanto a quella sopra (Mario, 11/10/2026:
 * «stessa cura, due centimetri più a destra»). Sulla riga che risulta toccata
 * senza autore anche l'ora manca, e la cella vuota tornava a dire «nessuno
 * l'ha toccata» proprio accanto alla colonna che ormai diceva il contrario.
 * ⚠️ «non registrato» e non `SENZA_AUTORE`: qui manca un'ora, non un autore.
 */
export const ORA_NON_REGISTRATA = "non registrato";

export function toccataIlPerExport(
  domanda: { stato: string; toccata_il: string | null },
  formatta: (iso: string) => string,
): string | null {
  if (domanda.toccata_il) return formatta(domanda.toccata_il);
  if (domanda.stato === "nuova") return null;
  return ORA_NON_REGISTRATA;
}
