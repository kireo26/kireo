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

import { millisecondiDaOrarioItaliano } from "@/lib/formato";

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
function conLaVirgola(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
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

/**
 * L'avviso, o `null` quando non c'è niente da dire.
 *
 * ⚠️ IL TESTO DICE I DUE NUMERI, così chi legge può rifare il conto: un numero
 * che il lettore non può rifare gli toglie fiducia in tutto il resto. E dice
 * cosa fare, perché l'avviso non sta dicendo che è sbagliato.
 *
 * ⚠️ TESTO PROVVISORIO, MIO: Mario ha chiesto di mandargli la soglia per
 * scrivere lui la frase.
 */
export function avvisoOrePcto(ore: number, dataInizio: string, dataFine: string): string | null {
  // ⚠️ QUESTA RIGA NON TIENE LO ZERO, e l'ha detto una controprova che non ha
  // morso: togliendola, le 33 proprietà restano VERDI, perché `0 <= durata * 2`
  // è vero su qualunque durata positiva e il confronto più in basso lo prende
  // comunque. Quello che tiene DAVVERO è il `!(…)`, che è falso anche per
  // `NaN` — e `NaN <= qualunque cosa` è falso, quindi senza questa riga un
  // `Number("abc")` produrrebbe «dichiara NaN ore di PCTO». Resta anche perché
  // dice l'intenzione, ma la proprietà provata è quella.
  if (!(ore > 0)) return null;
  const durata = durataOre(dataInizio, dataFine);
  if (durata === null) return null;
  if (ore <= durata * FATTORE_ORE_SOSPETTE) return null;
  return `Questo evento dura ${durataLeggibile(durata)} e dichiara ${conLaVirgola(ore)} ore di PCTO. Può andare bene se il lavoro continua dopo l'incontro: in quel caso scrivilo nella descrizione, perché è quella che la scuola legge.`;
}
