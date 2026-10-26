// Le ore PCTO dichiarate contro la durata programmata dell'evento.
//
// ⚠️ IL CASO VERO, osservato da Mario sul suo stesso evento: `data_inizio`
// 19:15, `data_fine` 19:20, `ore_pcto` 0,5. Cinque minuti di diretta e mezz'ora
// di PCTO dichiarata — e `ore_pcto` è un campo libero, quindi nessuno ha detto
// niente. Quelle ore finiscono su un documento di scuola.
//
// ⚠️ NON È UN BLOCCO, ED È UNA SCELTA DI MARIO: un evento può legittimamente
// valere più della sua diretta (un'ora di webinar più tre di lavoro è un caso
// normale, non un errore). Quindi un AVVISO, come quello della data nel
// passato: informa e non impedisce. Non entra in `validate()` apposta — una
// riga in `errori` bloccherebbe l'invio.
//
// ⚠️ LA SOGLIA È MIA, NON MISURATA, e sta scritta come tale perché nessuno la
// ritrovi fra sei mesi credendo che qualcuno l'abbia tarata su dei dati. La
// regola è UNA, perché due regole con due soglie sono due numeri da spiegare:
//
//     avvisa quando le ore dichiarate sono più del DOPPIO della durata
//     programmata.
//
// Perché un rapporto e non un margine assoluto: un margine di un'ora (che era
// la prima stesura) NON prende il caso che ha aperto il lavoro — 0,5 ore su 5
// minuti supera la durata di 0,42 ore, cioè meno di un'ora, quindi tacerebbe
// proprio lì. Un rapporto invece lo prende (6×), e per gli eventi lunghi resta
// generoso: un'ora dichiarata su 45 minuti è 1,33× e non dice niente, che è
// giusto — arrotondare per eccesso è normale.
//
// COSA PRENDE CHE NON È UN ERRORE, detto invece di nasconderlo: un workshop di
// un'ora che dichiara 4 ore perché il lavoro continua dopo (4×). Quel caso
// l'avviso lo nomina e lo manda avanti — ed è il motivo per cui il testo dice
// cosa fare invece di dire che è sbagliato: se il lavoro c'è, va nella
// descrizione, perché è quella che la scuola legge.
//
// COSA **NON** PRENDE, di proposito: le ore MOLTO MINORI della durata. Un
// evento di tre ore che ne vale una è normale (ne conta una parte), e zero ore
// è il caso più comune di tutti. Avvisare lì sarebbe un avviso che suona sempre.

import { formattaDecimali, formattaNumero, millisecondiDaOrarioItaliano } from "@/lib/formato";

/** Quante volte la durata programmata le ore possono superare prima che si dica qualcosa. */
export const FATTORE_ORE_SOSPETTE = 2;

/**
 * La durata programmata in ore, o `null` quando non si può sapere.
 *
 * NULL in tre casi, e tutti e tre devono tacere: una data mancante (`data_fine`
 * è facoltativa per gli eventi che non sono dirette), una data malformata, e
 * una durata non positiva — quest'ultima è già un errore di campo, e un secondo
 * messaggio su un campo già rosso è rumore.
 */
export function durataOre(dataInizio: string, dataFine: string): number | null {
  const inizio = millisecondiDaOrarioItaliano(dataInizio);
  const fine = millisecondiDaOrarioItaliano(dataFine);
  if (!Number.isFinite(inizio) || !Number.isFinite(fine)) return null;
  const ore = (fine - inizio) / 3_600_000;
  return ore > 0 ? ore : null;
}

/** Il numero come lo scrive un italiano: «0,5», «1,5», «12». */
// Una strada sola per scrivere un numero di ore: `numeroOre`, più sotto (prima
// qui c'era una seconda copia, `String(…).replace(".", ",")`).
function conLaVirgola(n: number): string {
  return numeroOre(n);
}

/** Una durata come la leggerebbe una persona: «5 minuti», «1 ora e 30 minuti», «2 ore». */
export function durataLeggibile(ore: number): string {
  const minuti = Math.round(ore * 60);
  if (minuti < 60) return `${minuti} minut${minuti === 1 ? "o" : "i"}`;
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  const parteOre = `${h} or${h === 1 ? "a" : "e"}`;
  return m === 0 ? parteOre : `${parteOre} e ${m} minut${m === 1 ? "o" : "i"}`;
}

/** «8 ore» / «1 ora» / «0,5 ore»: l'uno capita, perché la soglia lo ammette. */
function oreLeggibili(ore: number): string {
  return `${conLaVirgola(ore)} or${ore === 1 ? "a" : "e"}`;
}

/**
 * L'avviso, o `null` quando non c'è niente da dire. Il testo è di Mario, parola
 * per parola.
 *
 * ⚠️ TRE COSE NELLA FORMA, tutte volute. (1) DICE I DUE NUMERI invece di dire
 * «troppe»: chi li legge vede da sé, e un numero che il lettore non può rifare
 * gli toglie fiducia in tutto il resto. (2) DICE PERCHÉ CI INTERESSA — senza
 * quello sembra un capriccio del modulo, e invece quelle ore finiscono su un
 * documento che la scuola conserva. (3) LASCIA ANDARE AVANTI, perché un evento
 * può legittimamente valere più della sua diretta e non siamo noi a saperlo.
 */
export function avvisoOrePcto(ore: number, dataInizio: string, dataFine: string): string | null {
  // ⚠️ QUESTA RIGA NON TIENE LO ZERO, e l'ha detto una controprova che non ha
  // morso: togliendola, le proprietà restano VERDI, perché `0 <= durata * 2` è
  // vero su qualunque durata positiva e il confronto più in basso lo prende
  // comunque. Quello che tiene DAVVERO è il `!(…)`, che è falso anche per
  // `NaN` — e `NaN <= qualunque cosa` è falso, quindi senza questa riga un
  // `Number("abc")` produrrebbe «Stai dichiarando NaN ore».
  //
  // ⚠️ MA UN CAMPO CHE NON CONTIENE UN NUMERO NON È UN NUMERO SOSPETTO: NON È
  // UN NUMERO (Mario). Quindi tacere qui è giusto e non basta — il rifiuto sta
  // nel modulo, su quel campo, con il testo degli errori di campo. Vedi
  // `validate()` in `components/ente/CreaEventoForm.tsx`.
  if (!(ore > 0)) return null;
  const durata = durataOre(dataInizio, dataFine);
  if (durata === null) return null;
  if (ore <= durata * FATTORE_ORE_SOSPETTE) return null;
  return `Stai dichiarando ${oreLeggibili(ore)} per un incontro di ${durataLeggibile(durata)}. Le ore PCTO finiscono su un documento che la scuola conserva: se il numero è giusto vai avanti, altrimenti correggilo.`;
}

// ─────────────────── LE ORE COME LE LEGGE UNA PERSONA ───────────────────────
//
// Sei posti stampavano le ore grezze — `{e.ore_pcto}h PCTO` — cioè col PUNTO
// in una pagina in italiano, e due (il totale della scheda studente e le
// statistiche della scuola) sommavano in JavaScript, quindi col rumore della
// virgola mobile. Lo stesso difetto già chiuso il 4/10 sul contatore dello
// studente (`testoOreCertificate`), che lì non era arrivato.
//
// Due decimali, la precisione delle colonne dal 18/10 (`20261018110000`):
// l'arrotondamento esplicito toglie il rumore, `formattaNumero` mette la
// virgola. `numeric` arriva da PostgREST come stringa: si accetta.
//
// ⚠️ UN NUMERO NON INTERO SI SCRIVE SEMPRE CON DUE DECIMALI (Mario, 26/10): lo
// storico diceva «0,4h certificate» dove il CSV dice «0.40», e la stessa ora
// non può avere due precisioni a seconda di dove la si legge. Gli interi
// restano senza decimali («1 ora», «2h PCTO»): «1,00» non dice niente in più.
export function numeroOre(ore: number | string | null | undefined): string {
  const n = Number(ore ?? 0);
  const r = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  return Number.isInteger(r) ? formattaNumero(r) : formattaDecimali(r, 2);
}

// ─────────────────── IL CAMPO, E LA REGOLA DEL TERZO DECIMALE ───────────────
//
// ⚠️ SE IL DATABASE NON PUÒ TENERE IL NUMERO CHE UNA PERSONA HA SCRITTO, O LO
// RIFIUTIAMO O GLIELO DICIAMO — MAI CAMBIARLO IN SILENZIO (Mario, 18/10). Fino
// a oggi la colonna era a un decimale e 0,75 diventava 0,8 senza che nessuno
// lo dicesse all'ente. Da `20261018110000` la colonna tiene due decimali, e il
// troncamento si è solo SPOSTATO al terzo: un 0,333 diventerebbe 0,33. Quindi
// lo rifiutiamo qui, dove l'ente può ancora scrivere quello che intende.
//
// Il campo vuoto NON è un errore: «0 se non applicabile» è quello che dice
// l'etichetta, e l'invio manda 0.
export const DECIMALI_ORE_PCTO = 2;

export function erroreOrePcto(valore: string): string | null {
  const v = valore.trim();
  if (v === "") return null;
  const n = Number(v);
  if (!(Number.isFinite(n) && n >= 0)) return "Le ore devono essere un numero, zero o più.";
  // Si guarda la STRINGA, non il numero: `Number("0.750")` è 0,75 ed è
  // legittimo, `0.755` no. Gli zeri in coda non sono decimali persi.
  const decimali = (v.split(".")[1] ?? "").replace(/0+$/, "");
  if (decimali.length > DECIMALI_ORE_PCTO) {
    return "Le ore si scrivono con al massimo due decimali, per esempio 0,75 per quarantacinque minuti.";
  }
  return null;
}
