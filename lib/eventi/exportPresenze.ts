// Le parti dell'export presenze che le DUE route (admin e scuola) devono dire
// allo stesso modo. Due copie divergerebbero — è già successo a queste due route
// con il 403 della scuola.

import { formattaDataOra, formattaIstante, formattaOra } from "@/lib/formato";
import type { SezioneCsv } from "@/lib/csv";
import { fineEffettiva } from "@/lib/live";
import { SOGLIA_PRESENZA } from "@/lib/live/presenza";
import { MINUTI_MINIMI_CERTIFICAZIONE } from "@/lib/eventi/chiusuraDiretta";

/**
 * ⚠️ ZERO E NON UNA CELLA VUOTA per chi non si è mai collegato (Mario,
 * 11/10/2026, dopo il primo giro). «Non c'era» era vero, e la cella non lo
 * diceva: una cella vuota non afferma niente, in un foglio si legge «manca il
 * dato», e il lettore la riempie da solo con quello che gli pare. Il fatto è
 * «zero minuti», e lo zero è un'affermazione. Nella colonna convivono tre stati,
 * e adesso hanno tre forme:
 *
 *   0                 iscritto, non si è collegato          ← un fatto
 *   non calcolabile   collegato, ma l'incontro non ha fine
 *   (vuoto)           nessun caso
 */
export const MINUTI_MAI_COLLEGATO = 0;

/**
 * ⚠️ «NON CALCOLABILE» E NON UNA CELLA VUOTA (Mario, 11/10/2026): senza
 * `data_fine` i minuti non si possono tagliare alla finestra
 * (`20261011140000`), e la funzione li restituisce `null`. In un foglio, una
 * cella vuota nella colonna dei minuti si legge «zero minuti», cioè «non
 * c'era» — il difetto appena curato su «Toccata da», due colonne più in là,
 * nello stesso file. «Se la frase l'abbiamo scritta è perché il vuoto da solo
 * mentiva.»
 *
 * (Chi non si è mai collegato prende 0: vedi sopra.)
 */
export const MINUTI_NON_CALCOLABILI = "non calcolabile";

/** La riga sotto l'intestazione della sezione presenze, solo quando la parola compare. Di Mario. */
export const NOTA_MINUTI_NON_CALCOLABILI =
  "«non calcolabile» in «Dal primo all'ultimo collegamento» significa che l'incontro non ha un orario di fine: la presenza non si può delimitare.";

export function minutiPerExport(riga: { minuti_presenza: number | null; primo_ping: string | null }) {
  if (riga.minuti_presenza !== null) return riga.minuti_presenza;
  if (!riga.primo_ping) return MINUTI_MAI_COLLEGATO;
  // Collegato e senza un numero: l'unica ragione possibile è che l'incontro
  // non ha un orario di fine. Se mai ce ne fosse un'altra, «non calcolabile»
  // resta vero — la cella vuota no.
  return MINUTI_NON_CALCOLABILI;
}

export function notaMinuti(dataFine: string | null, righe: { primo_ping: string | null }[]): string | null {
  return !dataFine && righe.some((r) => r.primo_ping) ? NOTA_MINUTI_NON_CALCOLABILI : null;
}

/**
 * ⚠️ DUE COLONNE CON DUE DEFINIZIONI, e il file deve dirlo (Mario, 11/10/2026).
 * «Primo ingresso» è il battito GREZZO (17:08), «Minuti presenza» è tagliato
 * alla finestra dell'incontro (2,4). Chi sottrae a mano ottiene 8,9 e conclude
 * che sbagliamo noi. Gli orari grezzi restano — sono la prova — e la frase,
 * di Mario, sta sotto la sezione. Solo dove le due colonne ci sono (la sezione
 * dei docenti non ha gli orari) e solo se qualcuno si è collegato prima
 * dell'inizio: una nota che c'è sempre smette di essere letta.
 */
export const NOTA_MINUTI_FINESTRA =
  "«Dal primo all'ultimo collegamento» si conta dentro la finestra dell'incontro: se qualcuno si è collegato prima dell'inizio, non coincide con la differenza fra i due orari.";

export function notaFinestra(dataInizio: string | null, righe: { primo_ping: string | null }[]): string | null {
  if (!dataInizio) return null;
  const inizio = new Date(dataInizio).getTime();
  return righe.some((r) => r.primo_ping && new Date(r.primo_ping).getTime() < inizio) ? NOTA_MINUTI_FINESTRA : null;
}

/** Un istante per il CSV, o vuoto: l'ora di Roma, mai quella di Greenwich. */
export function istantePerExport(iso: string | null): string | null {
  return iso ? formattaIstante(iso) : null;
}

/**
 * ⚠️ LA COPERTURA OLTRE IL 100 SI SPIEGA, NON SI NASCONDE (Mario, 11/10/2026).
 * Dal giorno in cui il tetto è uscito anche dalla media del report dell'ente
 * (`20261011150000`), quella media può superare il 100 — ed è l'unica cosa che
 * dice che il conteggio non tornava. La frase è di Mario, parola per parola.
 */
export const SPIEGAZIONE_COPERTURA_OLTRE_CENTO =
  "Una copertura oltre il 100% significa che per qualcuno abbiamo registrato più battiti di quanti la durata dell'incontro ne preveda. È un difetto nostro, non una presenza migliore.";

/** Le righe da aggiungere al report sotto la copertura: una sola, e solo quando serve. */
export function righeCoperturaOltreCento(media: unknown): string[][] {
  // `numeric` arriva da PostgREST come numero o come stringa: si legge tutti e due.
  const n = typeof media === "number" ? media : Number(media);
  return Number.isFinite(n) && n > 100 ? [[SPIEGAZIONE_COPERTURA_OLTRE_CENTO]] : [];
}

// ─────────────────────────── 25/10: il CSV parla la lingua di chi lo apre
//
// «Un'esportazione è un'interfaccia. Ha solo meno diritto di sbagliare delle
// altre, perché viene letta quando non ci siamo e finisce dentro un documento
// che resta» (Mario). Fino al 25/10 il file stampava i valori scelti per la
// macchina (`risposta_live`, `iscritto`, `ente`). Le traduzioni stanno qui, in un
// posto solo, perché le due route le usino uguali.

/**
 * ⚠️ «MINUTI PRESENZA» SONO I BATTITI, NON LA DISTANZA (Mario, 25/10). Fino al
 * 25/10 la colonna dal nome umano era `ultimo − primo` (tagliato alla finestra),
 * e su test7 diceva 44 minuti accanto a 32 battiti: «la colonna che ha il nome
 * umano è quella che nessuno di noi userebbe». Un battito al minuto: il tempo
 * davvero contato. La distanza resta, in una colonna sua con il suo nome.
 */
export const INTESTAZIONE_MINUTI_CONTATI = "Minuti presenza";
export const INTESTAZIONE_DISTANZA = "Dal primo all'ultimo collegamento (minuti)";
export const INTESTAZIONE_ESITO = "Esito presenza";

/** Se la riga arriva da una migrazione precedente (senza `minuti_contati`), si dice invece di inventare. */
export function minutiContatiPerExport(riga: { minuti_contati?: number | null }): number | string {
  return typeof riga.minuti_contati === "number" ? riga.minuti_contati : "non disponibile";
}

/**
 * La colonna «Esito presenza» (prima «Stato», con il valore grezzo di
 * `iscrizioni_eventi.stato`). `iscritto` non è un esito: è il fatto che quella
 * persona si era iscritta. Cinque casi, e il quarto esiste perché prima della
 * chiusura «sotto la soglia» sarebbe un'affermazione su un conteggio non ancora
 * fatto.
 */
export function esitoPresenzaPerExport(
  riga: { stato_finale: string; primo_ping: string | null },
  direttaChiusa: boolean,
): string {
  if (riga.stato_finale === "partecipato") return "Certificata";
  if (riga.stato_finale === "assente") return "Assente";
  if (!riga.primo_ping) return "Nessun collegamento";
  return direttaChiusa ? "Sotto la soglia" : "Diretta non ancora chiusa";
}

/**
 * ⚠️ «NON MISURATA» E NON ZERO (giro del 25/10). Una presenza certificata A MANO
 * senza nessun battito — una classe in DAD che la scuola attesta — usciva con
 * «Minuti presenza 0 · Dal primo all'ultimo 0 · Copertura 0 · Esito Certificata»:
 * una certificazione accanto alla sua smentita. Lo zero lì non vuol dire «non
 * c'era»: vuol dire che non c'era niente da misurare, perché il battito non si
 * applica. È la regola di casa su un caso nuovo — quando non si legge non si
 * scrive zero, e qui non c'era niente da leggere.
 *
 * La condizione è stretta di proposito: certificata, da qualcuno che NON è il
 * conteggio automatico, e SENZA un battito. Se uno studente certificato a mano
 * si è anche collegato, i suoi numeri sono misure vere ed escono come sono.
 */
export const PRESENZA_NON_MISURATA = "non misurata";
export const NOTA_PRESENZA_NON_MISURATA =
  "«non misurata» significa che la presenza è stata certificata a mano (per esempio una classe in DAD): il conteggio automatico non si applica, quindi non c'è nessun minuto da riportare.";

export function presenzaNonMisurata(r: { stato_finale: string; certificata_da_tipo: string | null; primo_ping: string | null }): boolean {
  return r.stato_finale === "partecipato" && r.certificata_da_tipo !== null && r.certificata_da_tipo !== "sistema" && !r.primo_ping;
}

/**
 * Le tre celle della misura — minuti contati, distanza, copertura — in un posto
 * solo, perché le due route (e i due rami della route admin) le dicano uguali.
 */
export function celleMisura(r: {
  stato_finale: string;
  certificata_da_tipo: string | null;
  primo_ping: string | null;
  minuti_presenza: number | null;
  minuti_contati?: number | null;
  copertura_percento: number | null;
}): (number | string | null)[] {
  if (presenzaNonMisurata(r)) return [PRESENZA_NON_MISURATA, PRESENZA_NON_MISURATA, PRESENZA_NON_MISURATA];
  return [minutiContatiPerExport(r), minutiPerExport(r), r.copertura_percento];
}

/** La riga sotto la sezione, solo quando la parola compare. Testo mio, provvisorio. */
export function notaPresenzaNonMisurata(righe: Parameters<typeof presenzaNonMisurata>[0][]): string | null {
  return righe.some(presenzaNonMisurata) ? NOTA_PRESENZA_NON_MISURATA : null;
}

const CERTIFICATA_DA: Record<string, string> = {
  sistema: "Automatica (presenza misurata)",
  kireo: "KIREO",
  ente: "L'organizzatore",
  scuola: "La scuola",
};

/** «Certificata da»: chi ha certificato, detto con parole. Un valore ignoto esce com'è, mai inventato. */
export function certificataDaPerExport(tipo: string | null): string | null {
  if (!tipo) return null;
  return CERTIFICATA_DA[tipo] ?? tipo;
}

const STATO_DOMANDA: Record<string, string> = {
  nuova: "Non ancora gestita",
  letta: "Letta in diretta",
  risposta_live: "Risposta in diretta",
};

/** Lo stato di una domanda nel CSV. Un valore ignoto esce com'è: meglio grezzo che inventato. */
export function statoDomandaPerExport(stato: string): string {
  return STATO_DOMANDA[stato] ?? stato;
}

// ─────────────────────────── il report aggregato dell'ente (25/10)

/**
 * La copertura del report è la media sui SOLI presenti (`report_evento_aggregato`
 * fa `avg` sulle righe di `presenze_live`: chi non si è mai collegato non entra).
 * Fino al 25/10 l'etichetta diceva «Copertura media (%)» e il file non diceva
 * quale delle due medie stava mostrando: adesso lo dice.
 */
export const ETICHETTA_COPERTURA_MEDIA = "Copertura media dei presenti (%)";

/** La riga sotto l'intestazione della distribuzione, quando nessun gruppo arriva a 5. */
export function testoDistribuzioneVuota(totalePresenti: number): string {
  if (totalePresenti <= 0) return "Nessuno si è collegato: non c'è niente da distribuire.";
  if (totalePresenti === 1) return "Nessun gruppo raggiunge i 5 presenti richiesti: l'unico presente non viene distribuito.";
  // Di Mario, con il numero vero dentro: è quel numero a distinguere i due casi.
  return `Nessun gruppo raggiunge i 5 presenti richiesti: i ${totalePresenti} presenti non vengono distribuiti.`;
}

/**
 * Il file che l'ente conserva. ⚠️ CON TITOLO, DATA E FINESTRA IN TESTA (Mario,
 * 25/10): «fra sei mesi non c'è modo di sapere di quale incontro sia». Puro.
 */
// ⚠️ LA TESTA DEL REPORT DICE LA DURATA VERA (giro del 25/10): il file diceva
// «14:00 → 14:30» e due righe sotto una copertura del 91,7% — cioè 22 su 24. Un
// ente che rifà il conto a mano, 22 su 30, ottiene 73% e conclude che il nostro
// numero è gonfiato. Una percentuale e il denominatore sbagliato per
// verificarla, nello stesso file. Quindi la finestra è quella EFFETTIVA (fino
// alla chiusura, se c'è stata prima), con la durata scritta dalla chiusura e chi
// l'ha chiusa; e accanto le due cose che la ricevuta ha già: quante
// certificazioni e qual era la soglia.
export type EventoReport = {
  titolo: string;
  data_inizio: string | null;
  data_fine: string | null;
  diretta_chiusa_il: string | null;
  diretta_chiusa_da_tipo: string | null;
  diretta_durata_minuti: number | null;
  diretta_chiusa_certificati: number | null;
};

const CHIUSA_DA_REPORT: Record<string, string> = { kireo: "chiuso da KIREO", ente: "chiuso dall'organizzatore" };

export function testaReportEnte(evento: EventoReport): string | null {
  if (!evento.data_inizio) return null;
  const chiusa = Boolean(evento.diretta_chiusa_il);
  const fine = chiusa
    ? fineEffettiva(evento.data_inizio, evento.data_fine, evento.diretta_chiusa_il)
    : evento.data_fine;
  const finestra = `Incontro: ${formattaDataOra(evento.data_inizio)}${fine ? ` → ${formattaOra(fine)}` : ""} (ora italiana)`;
  if (chiusa && typeof evento.diretta_durata_minuti === "number") {
    const da = CHIUSA_DA_REPORT[evento.diretta_chiusa_da_tipo ?? ""];
    return `${finestra} — durata ${minutiLeggibili(evento.diretta_durata_minuti)}${da ? `, ${da}` : ""}.`;
  }
  return chiusa ? `${finestra}.` : `${finestra}. La diretta non è ancora stata chiusa: le presenze non sono ancora contate.`;
}

const minutiLeggibili = (n: number) => (n === 1 ? "1 minuto" : `${n} minuti`);

/** Le righe della chiusura: certificazioni e soglia, solo quando la chiusura c'è stata. */
export function righeChiusuraReport(evento: EventoReport): (string | number)[][] {
  if (!evento.diretta_chiusa_il || typeof evento.diretta_durata_minuti !== "number") return [];
  const durata = evento.diretta_durata_minuti;
  const soglia =
    durata < MINUTI_MINIMI_CERTIFICAZIONE
      ? `Nessuna: sotto i ${MINUTI_MINIMI_CERTIFICAZIONE} minuti l'incontro non certifica ore`
      : `${Math.ceil(SOGLIA_PRESENZA * Math.max(1, durata) - 1e-9)} minuti su ${durata}`;
  return [
    ["Certificazioni automatiche", evento.diretta_chiusa_certificati ?? "non disponibile"],
    ["Soglia di presenza per la certificazione", soglia],
  ];
}

export function sezioniReportEnte(
  evento: EventoReport,
  riga: { totale_iscritti: unknown; totale_presenti: unknown; copertura_media: unknown; numero_domande: unknown },
  distribuzione: { provincia: string; tipo_istituto: string; conteggio: number }[],
): SezioneCsv[] {
  const finestra = testaReportEnte(evento);
  const presenti = Number(riga.totale_presenti) || 0;
  return [
    {
      titolo: `Report aggregato — ${evento.titolo}`,
      nota: [finestra],
      intestazioni: ["Metrica", "Valore"],
      righe: [
        ["Totale iscritti", riga.totale_iscritti],
        ["Totale presenti", riga.totale_presenti],
        [ETICHETTA_COPERTURA_MEDIA, riga.copertura_media],
        // ⚠️ Una media senza tetto può superare il 100 (`20261011150000`): lo si
        // spiega invece di nasconderlo. Solo quando succede.
        ...righeCoperturaOltreCento(riga.copertura_media),
        ...righeChiusuraReport(evento),
        ["Numero domande", riga.numero_domande],
      ],
      seNonCeNiente: "Non è stato possibile leggere i numeri dell'incontro.",
    },
    {
      titolo: "Distribuzione per provincia e tipo istituto (solo gruppi con almeno 5 presenti)",
      intestazioni: ["Provincia", "Tipo istituto", "Presenti"],
      righe: distribuzione.map((d) => [d.provincia, d.tipo_istituto, d.conteggio]),
      // ⚠️ ZERO ≠ NON C'ERA NIENTE DA CONTARE, nella sua forma da esportazione:
      // un elenco vuoto ha due cause, e le distingue solo il numero.
      seNonCeNiente: testoDistribuzioneVuota(presenti),
    },
  ];
}

// ⚠️ LE ORE RICONOSCIUTE, una per riga (26/10). Fino ad allora il file che serve
// a riconoscere le ore non diceva quante fossero. Sono quelle EMESSE alla
// certificazione (`iscrizioni_eventi.ore_riconosciute`), mai le dichiarate.
// Chi non è certificato su una diretta chiusa ha 0 ore, ed è un fatto; su una
// diretta non ancora chiusa la cella resta vuota, perché non è ancora deciso.
export const INTESTAZIONE_ORE_RICONOSCIUTE = "Ore riconosciute";
export function oreRiconosciutePerExport(
  riga: { stato_finale: string; ore_riconosciute?: number | string | null },
  chiusa: boolean,
): string {
  if (riga.stato_finale === "partecipato" && riga.ore_riconosciute !== null && riga.ore_riconosciute !== undefined) {
    return oreCsv(riga.ore_riconosciute);
  }
  return chiusa ? oreCsv(0) : "";
}

/**
 * ⚠️ NEL CSV I DECIMALI HANNO TUTTI IL PUNTO (giro del 25/10). Nella stessa riga
 * «Dal primo all'ultimo» diceva 23.5, la copertura 91.7, le ore "0,4": qualunque
 * sia la lingua del foglio di calcolo che lo apre, una delle due colonne esce come
 * testo — e una scuola che somma la colonna delle ore somma del testo. La scelta
 * è il PUNTO perché il file separa i campi con la VIRGOLA: un decimale con la
 * virgola, in un file così, è per forza un testo fra virgolette. (L'alternativa —
 * `;` come separatore e la virgola nei decimali, il CSV «italiano» di Excel — è
 * un cambio di formato di tutti gli export, ed è una decisione di Mario.)
 * E DUE CIFRE sulle ore, la regola del 18/10: 0,40 e non 0,4.
 * A schermo le ore restano con la virgola (`numeroOre`): questo vale per il file.
 */
export function oreCsv(ore: number | string): string {
  const n = typeof ore === "number" ? ore : Number(ore);
  return Number.isFinite(n) ? n.toFixed(2) : String(ore);
}
