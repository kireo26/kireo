// Le ore PCTO di un evento: come si scrivono, e il campo dell'admin.
//
// ⚠️ QUI C'ERA L'AVVISO SULLE ORE SOSPETTE (`avvisoOrePcto`, 4/10: «Stai
// dichiarando 0,5 ore per un incontro di 5 minuti»), ed è uscito il 26/10 con
// `20261029100000`: da allora le ore dichiarate SONO la durata della finestra,
// calcolate dal database, e un avviso che confronta un numero con sé stesso
// non ha niente da dire. Se un giorno l'ente tornasse a scrivere le ore a mano,
// l'avviso va ripreso dalla storia (`git log -S avvisoOrePcto`), non riscritto:
// la sua soglia e i suoi casi sono spiegati là.
//
// ⚠️ E QUESTO FILE NON CONTIENE LA FORMULA DELLE ORE: sta in SQL
// (`ore_dichiarate_da_finestra`), una volta sola. Vedi `lib/eventi/oreDallOrario.ts`.

import { formattaDecimali, formattaNumero } from "@/lib/formato";

/** Una durata come la leggerebbe una persona: «5 minuti», «1 ora e 30 minuti», «2 ore». */
export function durataLeggibile(ore: number): string {
  const minuti = Math.round(ore * 60);
  if (minuti < 60) return `${minuti} minut${minuti === 1 ? "o" : "i"}`;
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  const parteOre = `${h} or${h === 1 ? "a" : "e"}`;
  return m === 0 ? parteOre : `${parteOre} e ${m} minut${m === 1 ? "o" : "i"}`;
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
// lo rifiutiamo qui, dove chi scrive può ancora scrivere quello che intende.
// Dal 26/10 il campo è uno solo, quello della correzione dell'admin
// (`CorreggiOreForm`): l'ente non scrive più le ore. `correggi_ore_evento` lo
// rifiuta anche dal lato del database (`ore_troppi_decimali`).
//
// Il campo vuoto qui NON è un errore di forma: il form della correzione lo
// tratta a parte, perché un campo vuoto non è una correzione.
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
