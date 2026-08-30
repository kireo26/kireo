// Ogni sezione che un ragazzo compila deve essere guardata da qualcuno.
//
// PERCHÉ ESISTE. Il revisore chiede quello che c'è scritto in
// `revisioneFocus`, non quello che c'è nel documento. Una sezione aggiunta
// senza la sua riga di focus è una sezione che uno studente riempie e che
// nessuno legge — e non se ne accorge nessuno, perché il testo arriva
// comunque, parla d'altro, e sembra una revisione normale.
//
// DUE REGOLE, DI DUE SPECIE DIVERSE, e la distinzione è la parte importante.
//
//   1. ESATTA, e fallisce: una fase non può avere meno righe di focus che
//      sezioni obbligatorie. Non dimostra che ogni sezione è coperta — cinque
//      righe potrebbero parlare tutte della stessa — ma prende in pieno il
//      modo in cui questa cosa succede davvero: si aggiungono sezioni e ci si
//      dimentica del focus. Oggi vale su tutte le 42 fasi, quindi non è una
//      soglia scelta per far passare quello che c'è.
//
//   2. DA LEGGERE, e non fallisce: le sezioni che non hanno nessuna parola in
//      comune con nessuna riga di focus della loro fase. Misurata prima di
//      scriverla: ne segnala 21 su 176, e **una buona parte è legittima** —
//      una riga può coprire una sezione senza usarne le parole, e in un caso
//      la copertura è voluta in un'ALTRA tappa (la scelta «se sfora» della
//      tappa 2 di spazio è agganciata dal focus della tappa 3, di proposito).
//      Farla fallire vorrebbe dire gridare su cose giuste una volta su otto,
//      ed è il modo migliore per far disattivare un controllo.
//
// Esecuzione: `npm run test:focus`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { WORKSHOP_ELABORATO } = require("@/lib/workshop/elaborato-config");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// Parole «di contenuto», troncate a cinque lettere per non inciampare su
// singolare/plurale («gruppo»/«gruppi»). È una radice povera, e va bene: serve
// a decidere cosa mettere in un elenco da leggere, non a dare un verdetto.
const STOP = new Set(
  "della delle dello degli dalla dalle quello quella questo questa quanto quante quanti cosa come perche quale quali sono essere avere fatto altro altri sopra sotto senza dentro invece anche ancora prima dopo tutto tutti".split(" "),
);
const radici = (s) => [
  ...new Set(
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5 && !STOP.has(w))
      .map((w) => w.slice(0, 5)),
  ),
];

console.log("\n═══ Ogni sezione ha qualcuno che la guarda ═══\n");

const daLeggere = [];
let fasi = 0;
let sezioni = 0;
const perRuolo = [];

for (const [ws, ruoli] of Object.entries(WORKSHOP_ELABORATO)) {
  for (const [ruolo, def] of Object.entries(ruoli)) {
    let nRuolo = 0;
    for (const f of def.fasi) {
      fasi++;
      const focus = f.revisioneFocus ?? [];
      const obbligatorie = f.sezioni.filter((s) => !s.opzionale);
      sezioni += f.sezioni.length;
      nRuolo += f.sezioni.length;

      // ── la regola esatta ─────────────────────────────────────────────────
      ok(
        focus.length >= obbligatorie.length,
        `${ws} > ${ruolo} > ${f.id}: ${obbligatorie.length} sezioni obbligatorie e ${focus.length} righe di focus` +
          (focus.length >= obbligatorie.length
            ? ""
            : `\n      Una sezione senza una riga che la guardi è una sezione che uno studente\n      riempie e che il revisore non legge: chiede quello che c'è in questa lista.`),
      );

      // ── l'elenco da leggere ──────────────────────────────────────────────
      const parolaDelFocus = radici(focus.join(" "));
      for (const s of f.sezioni) {
        const sue = radici(`${s.titolo} ${s.prompt ?? ""}`);
        if (!sue.some((w) => parolaDelFocus.includes(w))) daLeggere.push(`${ws} > ${ruolo} > ${f.id} > ${s.id}  «${s.titolo}»`);
      }
    }
    perRuolo.push({ ws, ruolo, sezioni: nRuolo, fasi: def.fasi.length });
  }
}

console.log("");
console.log(`  ${sezioni} sezioni in ${fasi} fasi. Per ruolo:`);
for (const r of perRuolo) console.log(`    ${r.ws} > ${r.ruolo.padEnd(15)} ${String(r.sezioni).padStart(2)} sezioni su ${r.fasi} tappe`);

console.log("");
if (daLeggere.length === 0) {
  console.log("  ✓ nessuna sezione da rileggere: tutte condividono qualche parola con il loro focus");
} else {
  console.log(`  da leggere: ${daLeggere.length} sezioni non hanno parole in comune col focus della loro fase.`);
  console.log("  NON è un errore — una riga può coprirle senza usarne le parole, e in un caso");
  console.log("  la copertura è voluta in un'altra tappa. Serve a rileggerle, non a bocciarle.");
  for (const d of daLeggere) console.log(`    · ${d}`);
}

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Nessuna fase ha meno righe di focus che sezioni da compilare.\n");
