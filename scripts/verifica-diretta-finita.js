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

const { faseContatore, testoFinitaNonChiusa, avvisoChiusuraTardiva } = chiusura;
const FINE = "2026-10-04T17:20:00Z"; // 19:20 a Roma
const t = (iso) => new Date(iso);

ok(faseContatore({ dataFine: FINE, chiusa: false, adesso: t("2026-10-04T17:10:00Z") }) === "viva", "dentro la finestra → viva");
ok(
  faseContatore({ dataFine: FINE, chiusa: false, adesso: t("2026-10-04T17:20:00Z") }) === "finita_non_chiusa",
  "all'istante della fine → finita, non chiusa (lo stesso confine di `chiudi_diretta_evento`)",
);
ok(faseContatore({ dataFine: FINE, chiusa: true, adesso: t("2026-10-11T08:00:00Z") }) === "chiusa", "chiusa vince sul tempo");
ok(
  faseContatore({ dataFine: null, chiusa: false, adesso: t("2030-01-01T00:00:00Z") }) === "viva",
  "senza data di fine non finisce mai (e non si può nemmeno chiudere): resta com'era",
);

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
  "Questa diretta è finita il 4 ottobre 2026, sette giorni fa. Se la chiudi adesso, la chiusura risulterà fatta oggi: i presenti e le ore restano quelli del 4 ottobre 2026, la data del gesto è questa.";
ok(sette === ATTESO_SETTE, "il caso di Mario, parola per parola (con l'anno: vedi `testoFinitaNonChiusa`)", sette);
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
ok(toccataDaPerExport({ stato: "letta", toccata_da: "ente" }) === "ente", "un autore registrato esce com'è");
const route = senzaCommenti(readFileSync(join(RADICE, "app/api/admin/presenze/[id]/route.ts"), "utf8"));
ok(route.includes("toccataDaPerExport(q)") && !route.includes("q.toccata_da,"), "la route dell'export la chiama invece di stampare il campo grezzo");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§0a/§0b — la definizione VIVA delle due funzioni di export\n");

const DIR = join(RADICE, "supabase/migrations");
const file = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const fn of ["esporta_presenze_admin", "esporta_presenze_scuola"]) {
  const chi = file.filter((f) => senzaCommentiSql(readFileSync(join(DIR, f), "utf8")).includes(`function public.${fn}(`));
  const ultima = chi[chi.length - 1];
  ok(ultima === "20261011140000_export_presenze_finestra.sql", `${fn}: l'ultima definizione è quella col taglio alla finestra`, ultima);
  const sql = senzaCommentiSql(readFileSync(join(DIR, ultima), "utf8"));
  const corpo = fettaOppureRosso(sql, { nome: `create or replace function public.${fn}(` }, null, `definizione di ${fn}`);
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
}

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà verificate.`);
process.exit(falliti === 0 ? 0 : 1);
