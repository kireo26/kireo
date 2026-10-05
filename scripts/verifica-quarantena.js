// ⚠️ QUESTO CONTROLLA L'ELENCO, NON LE FALLE.
//
// Le falle le lancia `npm run quarantena`, che ha bisogno di una replica. Qui
// non si tocca nessun database: si verifica che la LISTA sia integra, e gira a
// ogni `npm test` perché costa niente.
//
// Confondere i due è il modo in cui un verde smette di significare qualcosa:
// questo file può essere verde con tutte le falle ancora aperte — è
// esattamente il suo mestiere.
//
// PERCHÉ SERVE. Una lista di buchi noti è una cosa che rotola: una sonda
// aggiunta e non dichiarata non la lancia nessuno; una voce che punta a un file
// cancellato fa sembrare l'elenco più lungo di quello che è; una voce senza
// data diventa un buco senza età, cioè un buco che non si chiude mai. E se il
// comando che lancia le sonde non ha una chiave npm, è «un controllo che
// esiste, è verde quando lo lanci, e non gira mai».
//
// Esecuzione: `npm run test:quarantena`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { QUARANTENA } = require("./quarantena/elenco");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(__dirname, "quarantena");
let falliti = 0;
const ok = (cond, msg, extra) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) {
    falliti++;
    if (extra) console.log(`      → ${extra}`);
  }
};

console.log("\n═══ La quarantena: l'integrità dell'ELENCO (non delle falle) ═══\n");

// ── 1) l'elenco e la cartella dicono la stessa cosa ─────────────────────────
console.log("1) L'elenco e la cartella dicono la stessa cosa");

const inCartella = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const dichiarati = QUARANTENA.map((v) => v.file).sort();

ok(QUARANTENA.length > 0, `l'elenco non è vuoto (${QUARANTENA.length} voci)`, "un elenco vuoto non è una buona notizia: o le falle sono curate e le sonde promosse, o qualcuno ha svuotato la lista");

for (const v of dichiarati) {
  ok(inCartella.includes(v), `la sonda dichiarata «${v}» esiste`, "una voce che punta a un file cancellato fa sembrare l'elenco più lungo di quello che è");
}
const orfane = inCartella.filter((f) => !dichiarati.includes(f));
ok(
  orfane.length === 0,
  orfane.length === 0 ? "nessuna sonda orfana nella cartella" : `sonde non dichiarate: ${orfane.join(", ")}`,
  "una sonda che non sta nell'elenco non la lancia nessuno: è il difetto che l'elenco esiste per chiudere",
);

const doppie = dichiarati.filter((f, i) => dichiarati.indexOf(f) !== i);
ok(doppie.length === 0, "nessun file dichiarato due volte", doppie.join(", "));

// ── 2) ogni voce dice quello che serve a chiuderla ──────────────────────────
console.log("\n2) Ogni voce ha una data, una falla, una ragione e una cura");

for (const v of QUARANTENA) {
  const n = v.file;
  ok(/^\d{4}-\d{2}-\d{2}$/.test(v.data ?? ""), `${n}: la data c'è e è una data`, "un buco senza età è un buco che non si chiude mai");
  ok((v.falla ?? "").length > 40, `${n}: la falla è descritta`, "«si rompe» non basta: fra tre mesi non lo si ricostruisce");
  ok((v.perche_rossa ?? "").length > 20, `${n}: c'è scritto PERCHÉ è ancora rossa`);
  ok((v.cura ?? "").length > 20, `${n}: c'è scritta la cura prevista`);
  // ⚠️ Una voce con zero rosse attese è una contraddizione: se non è rossa non
  // è in quarantena, è una proprietà della suite.
  ok(
    Number.isInteger(v.rosse_attese) && v.rosse_attese >= 1,
    `${n}: dichiara quante proprietà sono rosse (${v.rosse_attese})`,
    "zero rosse attese vuol dire che non è in quarantena: la sonda va promossa nella suite",
  );
}

// ── 3) le sonde sono fatte per essere lette dal comando e incollate a mano ──
console.log("\n3) Le sonde sono leggibili dal comando e incollabili nel SQL Editor");

for (const v of QUARANTENA) {
  const p = path.join(DIR, v.file);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8");
  // Il marcatore: una sonda in quarantena lo dice in testa a sé stessa, così
  // chi la apre sa che il rosso è voluto senza passare dall'elenco.
  ok(src.includes("IN QUARANTENA"), `${v.file}: porta il marcatore «IN QUARANTENA»`);
  // Il comando legge il numero delle rosse dal riassunto: senza, non sa dire
  // se la falla è ancora lì.
  ok(src.includes("ROTTE"), `${v.file}: stampa il riassunto che il comando legge`);
  // Si incolla nel SQL Editor di produzione: non deve lasciare niente.
  ok(/\brollback;/.test(src), `${v.file}: finisce con un rollback`, "una sonda che scrive in produzione non è una sonda");
  // La fixture dichiara quante righe ha messo: una prova che passa su un
  // insieme vuoto non ha provato niente, e lo dice con lo stesso verde di una
  // che ha provato tutto (lezione del 5/10).
  ok(src.includes("la fixture non è vuota"), `${v.file}: la fixture dichiara di non essere vuota`);
}

// ── 4) il comando esiste, e NON è in `npm test` ─────────────────────────────
console.log("\n4) Il comando si lancia, e non entra mai in `npm test`");

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};

ok(
  typeof scripts["quarantena"] === "string" && /scripts\/quarantena\.js/.test(scripts["quarantena"]),
  "c'è una chiave npm `quarantena` che lancia il comando",
  "senza, è un controllo che esiste, è verde quando lo lanci, e non gira mai",
);

// `npm test` prende tutte e sole le chiavi `test:*` (scripts/tutti-i-test.js):
// una chiave `test:*` che lanciasse le sonde porterebbe in suite tre rossi
// permanenti, cioè la cosa che la quarantena esiste per evitare.
//
// ⚠️ IL PERCORSO INTERO, non `includes("quarantena.js")`: quella forma trova
// anche `verifica-quarantena.js`, cioè QUESTO file — e alla prima esecuzione ha
// gridato su un codice giusto. Un controllo che grida su una cosa giusta è un
// controllo che qualcuno disattiva.
const inSuite = Object.entries(scripts).filter(([k, v]) => k.startsWith("test:") && /scripts\/quarantena\.js/.test(String(v)));
ok(
  inSuite.length === 0,
  "nessuno `test:*` lancia le sonde della quarantena",
  inSuite.length > 0 ? `${inSuite.map(([k]) => k).join(", ")} — porterebbero in suite dei rossi permanenti` : undefined,
);
ok(
  typeof scripts["test:quarantena"] === "string" && scripts["test:quarantena"].includes("verifica-quarantena.js"),
  "…mentre `test:quarantena` lancia questo controllo, che guarda l'elenco",
);

console.log(
  falliti === 0
    ? `\n✅ L'elenco è integro: ${QUARANTENA.length} falle in quarantena, tutte con data, ragione e cura.\n`
    : `\n❌ ${falliti} asserzioni rosse\n`,
);
process.exit(falliti === 0 ? 0 : 1);
