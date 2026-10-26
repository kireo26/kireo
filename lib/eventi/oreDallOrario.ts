// I TESTI DELLE ORE CALCOLATE DALL'ORARIO (Mario, 26/10 — `20261029100000`).
//
// ⚠️ QUI NON C'È LA FORMULA, ed è la regola del lotto: i numeri arrivano dal
// database (`ore_dichiarate_da_finestra`, `anteprima_spostamento_finestra`,
// `anteprima_correzione_ore`), cioè dallo stesso codice che poi li scrive.
// «Un avviso calcolato da qualcuno di diverso da chi poi agisce non è un
// avviso: è una previsione» (Mario). Questo file dice soltanto le frasi.
//
// Le ore in questi testi si scrivono SEMPRE con due decimali, anche quando
// sono intere («da 0,33 a 1,00»): sono i testi di Mario, e un confronto fra
// due numeri si legge meglio se i due numeri hanno la stessa forma.

import { formattaDecimali } from "@/lib/formato";
import { durataLeggibile } from "@/lib/eventi/orePcto";

/** «0,33», «1,00». PostgREST manda `numeric` come stringa: si accetta. */
export function oreDueDecimali(ore: number | string): string {
  return formattaDecimali(Number(ore), 2);
}

// ─────────────────────────── IL FORM DI CREAZIONE ────────────────────────────
//
// L'ente ha perso un campo: senza questa riga avrebbe perso anche la cognizione
// di cosa sta dichiarando (Mario: «togliere una scelta è legittimo; togliere
// l'informazione insieme alla scelta no»).
export function testoOreCreazione(ore: number | string): string {
  return `Questo incontro vale ${oreDueDecimali(ore)} ore PCTO, calcolate dall'orario.`;
}

// ⚠️ Mio, provvisorio. Quando il calcolo non risponde la creazione NON si
// blocca — e qui non c'è niente da proteggere: nessun valore scelto da qualcuno
// viene cancellato, il numero lo scrive comunque il database. Si dice la regola
// senza il numero, invece di tacere.
export const TESTO_ORE_CREAZIONE_SENZA_NUMERO = "Le ore PCTO di questo incontro si calcolano dall'orario.";

// ─────────────────────────── LO SPOSTAMENTO ──────────────────────────────────

export type AnteprimaSpostamento = {
  ore_attuali: number | string;
  ore_nuove: number | string | null;
  fissate_a_mano: boolean;
  aveva_fine: boolean;
};

/**
 * La frase sopra il bottone, o `null` quando non c'è niente da dire (stessa
 * durata, nessuna correzione a mano). Testi di Mario, parola per parola.
 *
 * L'ORDINE dei casi è una scelta: un evento senza fine non ha «ore di prima»
 * calcolate da niente, quindi il suo testo viene per primo; una correzione a
 * mano sta sopra il confronto, perché è la cosa che lo spostamento distrugge.
 */
export function testoAnteprimaSpostamento(a: AnteprimaSpostamento): string | null {
  if (a.ore_nuove === null) return null;
  const nuove = oreDueDecimali(a.ore_nuove);
  // ⚠️ UN'ASSENZA PREVISTA NON È UN GUASTO (Mario): un evento creato prima del
  // 26/10 senza orario di fine non ha una durata da cui partire, e trattarlo
  // come un'anteprima fallita lo renderebbe impossibile da spostare — cioè
  // chiuderebbe proprio la strada che gli dà finalmente un orario.
  if (!a.aveva_fine) return `Questo incontro non aveva un orario di fine: con il nuovo orario varrà ${nuove} ore.`;
  const attuali = oreDueDecimali(a.ore_attuali);
  if (a.fissate_a_mano) {
    return `Le ore erano state fissate a mano (${attuali}): verranno sostituite dal calcolo sulla nuova durata (${nuove}).`;
  }
  if (Number(a.ore_attuali) === Number(a.ore_nuove)) return null;
  return `Spostando l'orario, le ore dell'evento verranno ricalcolate sulla nuova durata: da ${attuali} a ${nuove}.`;
}

// ⚠️ Mio, provvisorio. L'ANTEPRIMA CHE NON RISPONDE BLOCCA LO SPOSTAMENTO
// (Mario): lo spostamento può distruggere un valore scelto da una persona — la
// correzione dell'admin — e «un'azione che cancella la scelta di qualcun altro
// non si conferma al buio». Il testo dice perché si è fermato e cosa fare; il
// bottone per riprovare sta accanto, non un bottone spento senza spiegazione.
export const TESTO_ANTEPRIMA_FALLITA =
  "Non siamo riusciti a calcolare quante ore varrà l'incontro con il nuovo orario, e senza quel numero l'orario non si sposta. È un problema nostro, non dei dati che hai scritto: riprova il calcolo.";

// ─────────────────────────── LA CORREZIONE DELL'ADMIN ────────────────────────

export type AnteprimaCorrezione = {
  durata_minuti: number | string | null;
  massimo: number | string | null;
  chiusa: boolean;
  ha_fine: boolean;
};

// ⚠️ IL SOLO CASO SENZA TETTO, e quindi il solo che non può tacere (Mario,
// 26/10): un evento vecchio senza `data_fine` e mai chiuso cade nel ramo
// «durata ignota» di `ore_riconoscibili_evento`, e quello che l'admin scrive
// arriva intero. «Il silenzio è il testo di un caso qualunque, non quello del
// caso eccezionale»: chi ha letto «il massimo è 0,33» sugli altri eventi, qui
// non leggerebbe niente e concluderebbe che non c'è niente di speciale.
export const TESTO_CORREZIONE_SENZA_TETTO =
  "Questo incontro non ha un orario di fine: le ore che scrivi qui vengono riconosciute per intero, senza nessun tetto.";

export const TESTO_CORREZIONE_GIA_CHIUSA =
  "L'incontro è già stato chiuso: le presenze già certificate restano con le ore di allora.";

/**
 * Le frasi sotto il campo dell'admin, nell'ordine in cui si leggono.
 *
 * ⚠️ IL MASSIMO VALE PER LA CERTIFICAZIONE AUTOMATICA, NON PER QUELLA DELLA
 * SCUOLA (Mario, 26/10, strada (i)): dal 25/10 la certificazione manuale non
 * ha tetto ed emette le ore dichiarate, quindi un valore sopra il massimo esce
 * intero da ogni certificazione a mano. Quando il valore lo supera, la frase lo
 * dice — prima diceva «non potranno superare», che lì era falso.
 *
 * ⚠️ UNA COMPOSIZIONE MIA, da rileggere: a diretta NON chiusa e sopra il
 * massimo, alla frase (i) segue «Se l'incontro finisce prima, quel massimo
 * scende.», presa dalla frase di Mario per lo stesso caso sotto il massimo.
 * Il massimo è calcolato sulla durata programmata, cioè sul caso migliore, e
 * «resta 0,33» senza quella riga si leggerebbe come una garanzia.
 */
export function testiCorrezioneOre(a: AnteprimaCorrezione, valore: number | null): string[] {
  const righe: string[] = [];
  if (!a.chiusa && !a.ha_fine) return [TESTO_CORREZIONE_SENZA_TETTO];
  if (a.durata_minuti !== null && a.massimo !== null) {
    const massimo = oreDueDecimali(a.massimo);
    const scende = "Se l'incontro finisce prima, quel massimo scende.";
    // ⚠️ UN VALORE CHE NON SI È RIUSCITI A LEGGERE NON SI GIUDICA (Mario): con
    // il campo non valido si dice solo il massimo dell'incontro, senza nessun
    // confronto. Non chiusa: la frase di Mario sul massimo, che non nomina il
    // valore. Chiusa: mia, provvisoria — la prima frase della (i) all'indicativo.
    if (valore === null) {
      righe.push(
        a.chiusa
          ? `Nella certificazione automatica il massimo riconoscibile è ${massimo}, calcolato sulla durata dell'incontro.`
          : `Con l'orario previsto (${durataLeggibile(Number(a.durata_minuti) / 60)}), le ore riconosciute non potranno superare ${massimo}. ${scende}`,
      );
    } else if (valore > Number(a.massimo)) {
      righe.push(
        `Nella certificazione automatica il massimo riconoscibile resta ${massimo}, calcolato sulla durata dell'incontro. Una scuola che certifica a mano i propri studenti riconoscerà invece il valore che scrivi qui. La correzione resta registrata con il tuo nome.` +
          (a.chiusa ? "" : ` ${scende}`),
      );
    } else if (!a.chiusa) {
      const durata = durataLeggibile(Number(a.durata_minuti) / 60);
      righe.push(`Con l'orario previsto (${durata}), le ore riconosciute non potranno superare ${massimo}. ${scende}`);
    }
  }
  if (a.chiusa) righe.push(TESTO_CORREZIONE_GIA_CHIUSA);
  return righe;
}

/** I rifiuti di `correggi_ore_evento`. Miei, provvisori. */
export function messaggioCorrezioneOre(chiave: string | null): string {
  if (chiave === null) return "Ore aggiornate. La correzione resta registrata con il tuo nome; se l'orario si sposta, le ore tornano a essere calcolate.";
  if (chiave.includes("ore_troppi_decimali")) return "Le ore si scrivono con al massimo due decimali, per esempio 0,75 per quarantacinque minuti.";
  if (chiave.includes("ore_non_valide")) return "Le ore devono essere un numero, zero o più.";
  if (chiave.includes("non_autorizzato")) return "Solo KIREO può correggere le ore di un evento.";
  return "Non siamo riusciti a salvare le ore: è un problema nostro, non del numero che hai scritto. Riprova fra un momento.";
}
