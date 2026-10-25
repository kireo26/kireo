// Verifica del giro dell'11/10/2026 sul primo CSV e sul giro a schermo di
// /diretta/[id]: «la pagina non sa che la diretta è finita» (§4), i due testi
// del rifiuto dell'export (§5), la cella «Toccata da» (§0c) e il taglio dei
// minuti alla finestra in lettura con la copertura senza tetto (§0a, §0b).
//
// La metà SQL di §0a/§0b la ESEGUE `scripts/verifica-export-finestra.sql`
// contro una replica (11 proprietà, con la controprova che riproduce l'8,9 del
// CSV di Mario). Qui si guarda la metà che si può guardare senza database: che
// la definizione VIVA delle due funzioni sia quella nuova, e che il tetto non
// ci sia rientrato.
//
// Esecuzione: `npm run test:finita`. Stampa in fondo quante proprietà ha
// verificato, contandole dentro `ok()`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti.js");
const { ancora, creaFetta } = require("./lib/ancora.js");
const ts = require("typescript");

const RADICE = join(__dirname, "..");
let fatte = 0;
let falliti = 0;

function ok(condizione, cosa, dettaglio) {
  fatte++;
  if (condizione) {
    console.log(`  ✓ ${cosa}`);
  } else {
    falliti++;
    console.log(`  ✗ ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}

const { fettaOppureRosso, dentro } = creaFetta(ok);

function caricaModulo(rel, risolvi) {
  const sorgente = readFileSync(join(RADICE, rel), "utf8");
  const js = ts.transpileModule(sorgente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = { exports: {} };
  new Function("require", "module", "exports", js)((n) => risolvi(n), modulo, modulo.exports);
  return modulo.exports;
}

const formato = caricaModulo("lib/formato.ts", () => {
  throw new Error("lib/formato.ts non deve importare niente");
});
const daFormato = (nome) => {
  if (nome === "@/lib/formato") return formato;
  throw new Error(`import non previsto: ${nome}`);
};
const chiusura = caricaModulo("lib/eventi/chiusuraDiretta.ts", daFormato);
const tocco = caricaModulo("lib/eventi/tocco.ts", daFormato);
const rifiuto = caricaModulo("lib/eventi/rifiutoExport.ts", () => {
  throw new Error("rifiutoExport non deve importare niente");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§4a — tre fasi, e solo la prima ha un numero\n");

const { faseContatore, testoFinitaNonChiusa, avvisoChiusuraTardiva, testoPrimaDellaDiretta } = chiusura;
const INIZIO = "2026-10-04T17:15:00Z"; // 19:15 a Roma
const FINE = "2026-10-04T17:20:00Z"; // 19:20 a Roma
const t = (iso) => new Date(iso);
// ⚠️ LA FIXTURE SI COSTRUISCE IN UN POSTO SOLO, e non è stile: il 11/10 il
// quarto stato ha aggiunto `dataInizio` alla firma, e le chiamate di questa
// suite NON lo passavano — `new Date(undefined)` è NaN, il confronto è falso,
// e la funzione cadeva in «viva». Il rosso previsto non è arrivato: la suite
// stava provando il ripiego (il modo 13). Con un costruttore, completare la
// fixture è una riga.
const fase = (adesso, { dataInizio = INIZIO, dataFine = FINE, chiusa = false } = {}) =>
  faseContatore({ dataInizio, dataFine, chiusa, adesso: t(adesso) });

ok(fase("2026-10-04T17:13:00Z") === "prima", "due minuti prima dell'inizio → prima: nessun contatore che può valere solo zero");
ok(fase("2026-10-04T17:15:00Z") === "viva", "all'istante dell'inizio → viva (lo stesso confine di `evento_in_diretta`)");
ok(fase("2026-10-04T17:18:00Z") === "viva", "dentro la finestra → viva");
ok(fase("2026-10-04T17:20:00Z") === "finita_non_chiusa", "all'istante della fine → finita, non chiusa (lo stesso confine di `chiudi_diretta_evento`)");
// ⚠️ IL BOTTONE DI CHIUSURA SOLO QUANDO PUÒ CHIUDERE (Mario, 18/10) — e dal 26/10
// si chiude DA QUANDO COMINCIA (la chiusura anticipata è la fonte della durata
// vera). RIESAMINATA il 26/10: «né durante la diretta» era la regola di prima.
const { chiusuraDisponibile, testoChiusuraNonAncora } = chiusura;
ok(!chiusuraDisponibile(fase("2026-10-04T10:00:00Z"), FINE), "alle 12 di un evento delle 17 il bottone non c'è");
ok(chiusuraDisponibile(fase("2026-10-04T17:18:00Z"), FINE), "…c'è durante la diretta (26/10: si chiude in anticipo)");
ok(chiusuraDisponibile(fase("2026-10-04T17:20:00Z"), FINE), "…e c'è dopo la fine");
ok(!chiusuraDisponibile(fase("2026-10-04T17:18:00Z"), null), "…senza una fine non c'è mai");
ok(!chiusuraDisponibile(fase("2026-10-04T17:18:00Z")), "…e un chiamante che si dimentica la fine non lo fa comparire");
ok(!chiusuraDisponibile(fase("2026-10-04T17:21:00Z", { chiusa: true }), FINE), "…e non c'è più su una diretta chiusa");
ok(/alle \d\d:\d\d/.test(testoChiusuraNonAncora(INIZIO, FINE, t("2026-10-04T10:00:00Z"))), "al suo posto, quando comparirà", testoChiusuraNonAncora(INIZIO, FINE, t("2026-10-04T10:00:00Z")));
{
  const oggi = testoChiusuraNonAncora(INIZIO, FINE, t("2026-10-04T10:00:00Z"));
  // Testo MIO dal 26/10 (il momento è l'inizio, non più la fine).
  ok(/^La diretta si può chiudere da quando comincia: il bottone comparirà alle 19:15\.$/.test(oggi), "il testo dice l'ora dell'INIZIO", oggi);
  const altroGiorno = testoChiusuraNonAncora(INIZIO, FINE, t("2026-10-02T10:00:00Z"));
  ok(/comparirà il .*2026/.test(altroGiorno), "…con la data davanti quando non è oggi", altroGiorno);
}
{
  const comp = senzaCommenti(readFileSync(join(RADICE, "components/ente/ControlloDirettaEvento.tsx"), "utf8"));
  const iGate = ancora(comp, "!chiusuraDisponibile(fase, dataFine)"); // 26/10: la chiamata porta la fine
  const iBottone = ancora(comp, "Concludi diretta e certifica presenze");
  ok(iGate !== null && iBottone !== null && iGate < iBottone, "nel componente il bottone sta DOPO il ramo che lo esclude");
}
ok(fase("2026-10-11T08:00:00Z", { chiusa: true }) === "chiusa", "chiusa vince sul tempo");
ok(fase("2026-10-04T17:00:00Z", { chiusa: true }) === "chiusa", "…anche prima dell'inizio (un admin che ha già chiuso non rivede «comincia alle»)");
ok(fase("2030-01-01T00:00:00Z", { dataFine: null }) === "viva", "senza data di fine non finisce mai (e non si può nemmeno chiudere): resta viva");

const primaOggi = testoPrimaDellaDiretta(INIZIO, t("2026-10-04T17:13:00Z"));
ok(primaOggi === "La diretta comincia alle 19:15. I presenti si contano da quel momento.", "prima, lo stesso giorno: il testo di Mario parola per parola", primaOggi);
const primaAltroGiorno = testoPrimaDellaDiretta(INIZIO, t("2026-10-03T08:00:00Z"));
ok(primaAltroGiorno.includes("il 4 ottobre 2026") && primaAltroGiorno.includes("19:15"), "prima, un altro giorno: la data per intero («alle 19:15» da solo sembrerebbe di oggi)", primaAltroGiorno);
ok(!/\d+\s*present/i.test(primaOggi) && !/Presenti/.test(primaOggi), "…e non stampa nessun numero di presenti", primaOggi);

const finita = testoFinitaNonChiusa(FINE);
ok(finita.includes("4 ottobre 2026") && finita.includes("19:20"), "il testo dice giorno e ora della fine, a Roma", finita);
ok(finita.includes("Le presenze si contano chiudendola."), "…e dice che le presenze si contano chiudendo (Mario)", finita);
ok(!/\d+\s*present/i.test(finita) && !/Presenti/.test(finita), "…e non stampa nessun numero di presenti — è la proprietà del §4a", finita);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§4b — la riga sopra il bottone: un giorno diverso da oggi, non una soglia\n");

ok(avvisoChiusuraTardiva(FINE, t("2026-10-04T21:00:00Z")) === null, "stessa giornata di Roma (23:00) → nessun avviso");
ok(avvisoChiusuraTardiva(null, t("2026-10-11T08:00:00Z")) === null, "senza data di fine → nessun avviso");
const sette = avvisoChiusuraTardiva(FINE, t("2026-10-11T08:00:00Z"));
const ATTESO_SETTE =
  "Questa diretta è finita il 4 ottobre 2026, sette giorni fa. Se la chiudi adesso, la chiusura risulterà fatta oggi: i presenti e le ore restano quelli della diretta, la data del gesto è questa.";
ok(sette === ATTESO_SETTE, "il caso di Mario, parola per parola (con l'anno: vedi `testoFinitaNonChiusa`)", sette);
// La data UNA volta: «quello che è già scritto accanto non si ripete» (Mario, 11/10).
ok((sette.match(/4 ottobre 2026/g) || []).length === 1, "…e la data compare una volta sola", sette);
// ⚠️ IL CASO CHE UNA DURATA DIVISA PER 24 ORE SBAGLIEREBBE: fine alle 23:50 di
// Roma, si guarda alle 00:10 del giorno dopo. Venti minuti, e un giorno di
// calendario.
const aCavallo = avvisoChiusuraTardiva("2026-10-04T21:50:00Z", t("2026-10-04T22:10:00Z"));
ok(aCavallo !== null && aCavallo.includes(", ieri."), "venti minuti a cavallo della mezzanotte di Roma → «ieri»", aCavallo);
const quindici = avvisoChiusuraTardiva(FINE, t("2026-10-19T08:00:00Z"));
ok(quindici !== null && quindici.includes("15 giorni fa"), "oltre dieci in cifre", quindici);
ok(!/\b1 giorni\b/.test(aCavallo ?? ""), "nessun «1 giorni» (il difetto dei plurali del 4/10)", aCavallo);
ok(
  formato.giorniDiCalendarioItaliani("2026-10-04T22:30:00Z", "2026-10-05T10:00:00Z") === 0,
  "22:30 UTC del 4 è già il 5 a Roma: zero giorni col mezzogiorno del 5",
);
ok(
  formato.giorniDiCalendarioItaliani("2026-03-28T12:00:00Z", "2026-03-30T12:00:00Z") === 2,
  "a cavallo del cambio d'ora di marzo il conto non scivola",
);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§4 — il componente: contatore e freschezza solo nella fase viva\n");

const comp = senzaCommenti(readFileSync(join(RADICE, "components/ente/ControlloDirettaEvento.tsx"), "utf8"));
const viva = fettaOppureRosso(
  comp,
  { nome: '{fase === "viva" && (' },
  { nome: '<DomandaConsegnaForm' },
  "blocco della fase viva",
);
ok(dentro(viva, "Presenti ora:"), "«Presenti ora» sta DENTRO il blocco della fase viva");
ok(dentro(viva, "rigaFreschezza("), "…e la riga di freschezza anche: senza un numero vivo non sorveglia niente");
// `ancora` con il conto dichiarato a 1: una seconda copia fuori dal blocco la fa sollevare.
let unaCopia = true;
try {
  ancora(comp, "Presenti ora:");
  ancora(comp, "rigaFreschezza(");
} catch {
  unaCopia = false;
}
ok(unaCopia, "…e non c'è una seconda copia fuori dal blocco");
ok(
  /faseContatore\(\{[^}]*esitoChiusura !== null/.test(comp),
  "una pressione appena riuscita conta come chiusa anche prima che il poll lo rilegga",
);
ok(comp.includes("testoFinitaNonChiusa(dataFine)"), "nella fase finita, non chiusa, si rende il testo di Mario");
ok(comp.includes('{fase === "prima" && ') && comp.includes("testoPrimaDellaDiretta(dataInizio, ora)"), "prima dell'inizio si rende il testo di Mario, con l'ora che è stato e non `new Date()` nel render");
ok(/faseContatore\(\{\s*dataInizio,/.test(comp), "il componente passa `dataInizio`: senza, il quarto stato non esisterebbe e nessuno lo vedrebbe");
// RIESAMINATA il 26/10: il clic che CHIUDE è ora dentro la conferma, e l'avviso
// sta lì, prima di lui — è il momento in cui si legge prima di premere.
const bottone = fettaOppureRosso(comp, { nome: "{avvisoTardivo && " }, { nome: "<Button type=\"button\" variant=\"outline\" onClick={chiudiDiretta}" }, "avviso prima del bottone");
ok(bottone !== null, "l'avviso sulla chiusura tardiva sta PRIMA del bottone, non sotto (si legge prima di premere)");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§5 — i due testi del rifiuto, di Mario\n");

const r403 = rifiuto.rifiutoExport({ message: "non_autorizzato" });
const r500 = rifiuto.rifiutoExport({ message: "structure of query does not match function result type" });
ok(
  r403.testo ===
    "Questo export lo scarica chi certifica le presenze per questa scuola. Se credi di doverlo poter fare, scrivici da Contatti: lo sistemiamo noi.",
  "403 parola per parola",
  r403.testo,
);
ok(
  r500.testo ===
    "Non dipende da te: qualcosa si è rotto da parte nostra. Riprova fra qualche minuto; se continua, scrivici da Contatti dicendo l'ora esatta — con quella ritroviamo l'errore.",
  "500 parola per parola",
  r500.testo,
);
ok(r500.testo.startsWith("Non dipende da te"), "il 500 apre con «Non dipende da te», non lo mette in coda");
ok(!/traccia|ce ne siamo accorti|ci siamo accorti/.test(r500.testo), "il 500 non promette che ci siamo accorti (il guasto va in un log, non in `guasti`)");
ok(!/non hai|il tuo profilo/.test(r403.testo), "il 403 dice chi può, non che tu non puoi");
ok(r403.stato === 403 && r500.stato === 500 && r500.nostro && !r403.nostro, "gli stati restano due, e solo il 500 è nostro");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§0c — «Toccata da» nel CSV dice quello che dice lo schermo\n");

const { toccataDaPerExport, rigaTocco } = tocco;
const senzaAutore = toccataDaPerExport({ stato: "risposta_live", toccata_da: null });
const schermo = rigaTocco({ stato: "risposta_live", stato_da_tipo: null, stato_il: null });
ok(senzaAutore === "autore non registrato", "una domanda toccata senza autore non esce vuota", String(senzaAutore));
ok(schermo !== null && schermo.endsWith(senzaAutore ?? "∅"), "…ed è LA STESSA frase dello schermo, non una seconda copia", schermo);
ok(toccataDaPerExport({ stato: "nuova", toccata_da: null }) === null, "una domanda nuova resta vuota: lì nessuno l'ha toccata davvero");
// ⚠️ RISCRITTA il 25/10: «esce com'è» era il difetto — `ente` è un valore della
// macchina. Un autore registrato esce TRADOTTO, uno ignoto esce com'è.
ok(toccataDaPerExport({ stato: "letta", toccata_da: "ente" }) === "L'organizzatore", "un autore registrato esce tradotto («L'organizzatore», non «ente»)");
ok(toccataDaPerExport({ stato: "letta", toccata_da: "kireo" }) === "KIREO", "…e «KIREO», non «kireo»");
const route = senzaCommenti(readFileSync(join(RADICE, "app/api/admin/presenze/[id]/route.ts"), "utf8"));
ok(route.includes("toccataDaPerExport(q)") && !route.includes("q.toccata_da,"), "la route dell'export la chiama invece di stampare il campo grezzo");
// «Toccata il»: stessa cura, due centimetri più a destra (Mario, 11/10).
const { toccataIlPerExport, ORA_NON_REGISTRATA } = tocco;
const fmt = (iso) => `F(${iso})`;
ok(toccataIlPerExport({ stato: "risposta_live", toccata_il: null }, fmt) === ORA_NON_REGISTRATA && ORA_NON_REGISTRATA === "non registrato", "toccata e senza ora → «non registrato», non vuoto");
ok(toccataIlPerExport({ stato: "nuova", toccata_il: null }, fmt) === null, "…una domanda nuova resta vuota");
ok(toccataIlPerExport({ stato: "letta", toccata_il: "X" }, fmt) === "F(X)", "…un'ora registrata passa dal formattatore");
ok(route.includes("toccataIlPerExport(q, formattaIstante)") && !route.includes("istantePerExport(q.toccata_il)"), "la route usa la funzione per «Toccata il»");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§0a/§0b — la definizione VIVA delle due funzioni di export\n");

const DIR = join(RADICE, "supabase/migrations");
const file = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const fn of ["esporta_presenze_admin", "esporta_presenze_scuola"]) {
  const chi = file.filter((f) => senzaCommentiSql(readFileSync(join(DIR, f), "utf8")).includes(`function public.${fn}(`));
  const ultima = chi[chi.length - 1];
  // ⚠️ RIESAMINATA il 25/10: la definizione viva è ora quella dei minuti contati
  // (`drop` + `create`, perché il tipo di ritorno guadagna una colonna). Le
  // proprietà sul taglio alla finestra non cambiano: devono valere anche lì.
  // RIESAMINATA il 26/10: la viva è ora quella delle ore riconosciute, che
  // tiene i minuti contati e aggiunge una colonna. Le proprietà qui sotto
  // devono valere anche lì.
  ok(ultima === "20261026100000_durata_vera_ore_riconosciute.sql", `${fn}: l'ultima definizione è quella delle ore riconosciute`, ultima);
  const sql = senzaCommentiSql(readFileSync(join(DIR, ultima), "utf8"));
  const corpo = fettaOppureRosso(sql, { nome: `create function public.${fn}(` }, null, `definizione di ${fn}`);
  // Fino alla prima chiusura del corpo: le funzioni sono due nello stesso file.
  // ⚠️ `null` e non `""` quando la fetta manca: i due controlli NEGATIVI qui
  // sotto sarebbero verdi su una stringa vuota (modo 2) — l'ha mostrato la
  // prima stesura di questa guardia, con un'àncora ambigua.
  const definizione = corpo === null ? null : corpo.split("$$;")[0];
  const nonContiene = (cosa) => definizione !== null && !definizione.includes(cosa);
  ok(nonContiene("least(1.0"), `${fn}: nessun tetto sulla copertura — qui si misura`);
  ok(
    dentro(definizione, "least(pl.ultimo_ping, v_fine)") && dentro(definizione, "greatest(pl.primo_ping, v_inizio)"),
    `${fn}: i minuti sono la sovrapposizione con [data_inizio, data_fine]`,
  );
  ok(nonContiene("(pl.ultimo_ping - pl.primo_ping)"), `${fn}: «ultimo − primo» non c'è più`);
  // 25/10: i minuti contati (i battiti), la copertura a 0 di chi non si è
  // collegato, e l'ordine deterministico (due omonimi uscivano a caso).
  ok(dentro(definizione, "coalesce(pl.ping_totali, 0),"), `${fn}: i minuti contati sono i battiti, zero per chi non si è collegato`);
  ok(dentro(definizione, "round(coalesce(pl.ping_totali, 0)::numeric / v_ping_attesi * 100, 1)"), `${fn}: la copertura di chi non si è collegato è 0, non vuota`);
  ok(dentro(definizione, "order by p.cognome, p.nome, u.email nulls last, ie.student_id"), `${fn}: l'ordine è deterministico anche sugli omonimi`);
  ok(sql.includes(`revoke all on function public.${fn}(uuid) from public, anon;`), `${fn}: il drop scarta i permessi, e la revoca ad anon torna`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§1c — «non calcolabile» e non una cella vuota; la media oltre il 100 si spiega\n");

// 26/10: exportPresenze importa anche orePcto (le ore riconosciute nel CSV).
const orePcto = caricaModulo("lib/eventi/orePcto.ts", daFormato);
const exportP = caricaModulo("lib/eventi/exportPresenze.ts", (n) => (n === "@/lib/eventi/orePcto" ? orePcto : daFormato(n)));
ok(
  exportP.minutiPerExport({ minuti_presenza: null, primo_ping: "2026-10-04T17:00:00Z" }) === "non calcolabile",
  "collegato, ma l'incontro non ha una fine → «non calcolabile», non vuoto",
);
// ⚠️ ZERO, non vuoto (Mario, 11/10): una cella vuota non afferma niente.
ok(exportP.minutiPerExport({ minuti_presenza: null, primo_ping: null }) === 0, "mai collegato → 0: il fatto è «zero minuti», e lo zero è un'affermazione");
// Nessuno dei casi resta vuoto: la colonna ha tre stati e tre forme.
for (const [riga] of [
  [{ minuti_presenza: 2.4, primo_ping: INIZIO }, FINE],
  [{ minuti_presenza: null, primo_ping: INIZIO }, null],
  [{ minuti_presenza: null, primo_ping: null }, null],
  [{ minuti_presenza: null, primo_ping: INIZIO }, FINE],
]) {
  const v = exportP.minutiPerExport(riga);
  ok(v !== null && v !== undefined && v !== "", "nessuna combinazione produce una cella vuota", JSON.stringify(riga));
}
// La nota sulla finestra: solo se qualcuno si è collegato PRIMA dell'inizio.
ok(exportP.notaFinestra(INIZIO, [{ primo_ping: "2026-10-04T17:08:31Z" }]) === exportP.NOTA_MINUTI_FINESTRA, "un ingresso prima dell'inizio → la nota sulla finestra");
ok(exportP.notaFinestra(INIZIO, [{ primo_ping: "2026-10-04T17:16:00Z" }, { primo_ping: null }]) === null, "nessun ingresso prima dell'inizio → nessuna nota (una che c'è sempre smette di essere letta)");
ok(
  exportP.NOTA_MINUTI_FINESTRA ===
    "«Dal primo all'ultimo collegamento» si conta dentro la finestra dell'incontro: se qualcuno si è collegato prima dell'inizio, non coincide con la differenza fra i due orari.",
  // ⚠️ 25/10: la frase di Mario parlava di «minuti di presenza», che da oggi
  // sono i battiti — la colonna tagliata alla finestra è l'altra. Riscritta per
  // nominare la colonna giusta: è una sua frase, e va riletta.
  "la nota sulla finestra nomina la colonna della distanza",
);
ok(exportP.minutiPerExport({ minuti_presenza: 2.4, primo_ping: "x" }) === 2.4, "un numero vero esce com'è");
ok(
  exportP.notaMinuti(null, [{ primo_ping: "x" }]) ===
    "«non calcolabile» in «Dal primo all'ultimo collegamento» significa che l'incontro non ha un orario di fine: la presenza non si può delimitare.",
  "la nota sotto l'intestazione nomina la colonna in cui la parola compare",
);
ok(exportP.notaMinuti(FINE, [{ primo_ping: "x" }]) === null, "…e c'è SOLO quando la parola compare: una nota che c'è sempre smette di essere letta");
ok(exportP.istantePerExport("2026-10-04T15:08:31+00:00") === "04/10/2026 17:08:31", "un battito delle 17:08 a Roma si legge 17:08, non 15:08");
ok(exportP.righeCoperturaOltreCento(120).length === 1 && exportP.righeCoperturaOltreCento("120.0").length === 1, "una media oltre il 100 porta la spiegazione (anche se `numeric` arriva come stringa)");
ok(exportP.righeCoperturaOltreCento(100).length === 0 && exportP.righeCoperturaOltreCento(null).length === 0, "…a 100 o senza media, niente");
ok(
  exportP.SPIEGAZIONE_COPERTURA_OLTRE_CENTO ===
    "Una copertura oltre il 100% significa che per qualcuno abbiamo registrato più battiti di quanti la durata dell'incontro ne preveda. È un difetto nostro, non una presenza migliore.",
  "la spiegazione è di Mario, parola per parola",
);
const report = senzaCommenti(readFileSync(join(RADICE, "components/ente/ReportEventoButton.tsx"), "utf8"));
// ⚠️ RIESAMINATA il 25/10: il report è uscito in `sezioniReportEnte` (titolo,
// data, distribuzione vuota detta). La proprietà si prova CHIAMANDOLO.
ok(report.includes("sezioniReportEnte("), "il bottone del report compone il file da `sezioniReportEnte`");
{
  const ev = { titolo: "Giro a schermo", data_inizio: "2026-10-25T06:40:00Z", data_fine: "2026-10-25T07:25:00Z" };
  const riga = { totale_iscritti: 2, totale_presenti: 2, copertura_media: 120, numero_domande: 3 };
  const [testa, distrib] = exportP.sezioniReportEnte(ev, riga, []);
  ok(testa.righe.some((r) => r[0] === exportP.SPIEGAZIONE_COPERTURA_OLTRE_CENTO), "il report dell'ente spiega la media oltre il 100, sotto la riga della copertura");
  ok(testa.titolo === "Report aggregato — Giro a schermo", "il report porta il titolo dell'incontro", testa.titolo);
  const nota = (Array.isArray(testa.nota) ? testa.nota : [testa.nota]).join(" ");
  ok(/25 ottobre 2026/.test(nota) && /07:40/.test(nota) && /08:25/.test(nota), "…e la data e la finestra in ora italiana", nota);
  ok(testa.righe.some((r) => r[0] === "Copertura media dei presenti (%)"), "la copertura dice su chi è la media: i soli presenti");
  ok(distrib.seNonCeNiente === "Nessun gruppo raggiunge i 5 presenti richiesti: i 2 presenti non vengono distribuiti.", "distribuzione vuota con 2 presenti: la frase di Mario, col numero vero", distrib.seNonCeNiente);
  ok(exportP.testoDistribuzioneVuota(0) !== exportP.testoDistribuzioneVuota(2), "…e «nessuno si è collegato» non si scrive come «nessun gruppo arriva a 5»");
  ok(exportP.testoDistribuzioneVuota(1).includes("l'unico presente"), "…con uno solo, senza «i 1 presenti»");
}

console.log("\n§25/10 — il CSV parla la lingua di chi lo apre\n");
ok(exportP.esitoPresenzaPerExport({ stato_finale: "partecipato", primo_ping: "x" }, true) === "Certificata", "partecipato → «Certificata»");
ok(exportP.esitoPresenzaPerExport({ stato_finale: "iscritto", primo_ping: null }, true) === "Nessun collegamento", "iscritto, mai collegato → «Nessun collegamento» (decisione di Mario, 25/10 sera)");
ok(exportP.esitoPresenzaPerExport({ stato_finale: "iscritto", primo_ping: "x" }, true) === "Sotto la soglia", "iscritto, collegato, diretta chiusa → «Sotto la soglia»");
ok(exportP.esitoPresenzaPerExport({ stato_finale: "iscritto", primo_ping: "x" }, false) === "Diretta non ancora chiusa", "…ma prima della chiusura non è «sotto la soglia»: il conteggio non è ancora fatto");
ok(exportP.statoDomandaPerExport("risposta_live") === "Risposta in diretta" && exportP.statoDomandaPerExport("nuova") === "Non ancora gestita" && exportP.statoDomandaPerExport("letta") === "Letta in diretta", "gli stati delle domande, tradotti");
ok(exportP.certificataDaPerExport("ente") === "L'organizzatore" && exportP.certificataDaPerExport("sistema") !== "sistema" && exportP.certificataDaPerExport(null) === null, "«Certificata da» tradotta, vuota solo se nessuno ha certificato");
ok(exportP.minutiContatiPerExport({ minuti_contati: 32 }) === 32 && exportP.minutiContatiPerExport({}) === "non disponibile", "i minuti contati escono; senza la colonna nuova lo si dice, non si scrive zero");
for (const rel of ["app/api/admin/presenze/[id]/route.ts", "app/api/scuola/presenze/[id]/route.ts"]) {
  const r = senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));
  ok(r.includes("INTESTAZIONE_MINUTI_CONTATI") && r.includes("INTESTAZIONE_DISTANZA") && r.includes("INTESTAZIONE_ESITO"), `${rel}: le tre intestazioni nuove`);
  // (`"Stato"` resta legittimo come intestazione delle DOMANDE: lì è lo stato di una domanda, e il valore è tradotto.)
  ok(!r.includes("r.stato_finale,") && !r.includes("r.stato_finale]") && !r.includes("r.certificata_da_tipo,"), `${rel}: nessun valore grezzo della macchina nelle celle delle presenze`);
  ok(r.includes("esitoPresenzaPerExport(r,") && r.includes("diretta_chiusa_il"), `${rel}: l'esito sa se la diretta è chiusa`);
}
{
  const r = senzaCommenti(readFileSync(join(RADICE, "app/api/admin/presenze/[id]/route.ts"), "utf8"));
  ok(r.includes("statoDomandaPerExport(q.stato)") && !r.includes("q.stato,"), "lo stato delle domande esce tradotto");
}
for (const rel of ["app/api/admin/presenze/[id]/route.ts", "app/api/scuola/presenze/[id]/route.ts"]) {
  const r = senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));
  ok(r.includes("minutiPerExport(r)") && r.includes("nota: [notaMinuti(evento.data_fine,"), `${rel}: minuti e nota dallo stesso modulo`);
  ok(/notaFinestra\(evento\.data_inizio,/.test(r) && /select\("titolo, [^"]*data_inizio/.test(r), `${rel}: la nota sulla finestra, con l'inizio davvero letto`);
}
{
  const agg = file.filter((f) => senzaCommentiSql(readFileSync(join(DIR, f), "utf8")).includes("create or replace function public.report_evento_aggregato("));
  const ultima = agg[agg.length - 1];
  ok(ultima === "20261011150000_report_aggregato_senza_tetto.sql", "report_evento_aggregato: l'ultima definizione è quella senza tetto", ultima);
  const def = (senzaCommentiSql(readFileSync(join(DIR, ultima), "utf8")).split("create or replace function public.report_evento_aggregato(")[1] ?? "").split("$$;")[0];
  ok(def.length > 0 && !def.includes("least(1.0") && def.includes("avg(pl.ping_totali::numeric / v_ping_attesi)"), "…e la media non ha più il `least`");
}

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà verificate.`);
process.exit(falliti === 0 ? 0 : 1);
