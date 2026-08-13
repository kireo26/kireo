// KIREO — verifica di logica pura della sezione Guide. Nessun DB, nessun fs:
// esercita la regola di sblocco (statoSblocco) e la struttura del config.
//
// Copre: L1 sempre sbloccata; le condizioni-azione della L2 (T3, missione,
// status confermata/da_verificare, soglia di backup); le condizioni della L3
// (consolidata + missione); struttura del banco (18 aree × 3, percorsi PDF).
//
// Esecuzione: `npm run test:guide` (o `node scripts/verifica-guide.js`).

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
require.extensions[".ts"] = require.extensions[".tsx"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { statoSblocco, guideDiArea, TUTTE_LE_GUIDE, SOGLIA_L2_INTEREST, SOGLIA_L3_INTEREST, GUIDE_PRONTE, guidaPronta, areeConGuida1Pronte } = require("@/lib/guide/config");
const { AREE } = require("@/data/aree");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// Segnale «vuoto»: area non ancora emersa, niente T3, niente missioni.
const vuoto = { status: null, interestScore: 0, confidence: 0, t3Completato: false, missioniBloccoCompletate: 0 };
const con = (o) => ({ ...vuoto, ...o });

// ── L1 sempre disponibile ─────────────────────────────────────────────────────
console.log("\n1) Guida 1 — sempre disponibile");
ok(statoSblocco(1, vuoto).sbloccata, "L1 sbloccata anche senza alcun segnale");
ok(statoSblocco(1, con({ status: "emergente" })).sbloccata, "L1 sbloccata a prescindere dallo stato");

// ── L2 — l'area «si rafforza» (condizioni-azione) ─────────────────────────────
console.log("\n2) Guida 2 — si sblocca quando l'area si rafforza");
ok(!statoSblocco(2, vuoto).sbloccata, "L2 BLOCCATA con segnale vuoto");
ok(statoSblocco(2, con({ t3Completato: true })).sbloccata, "L2 sbloccata se T3 completato");
ok(statoSblocco(2, con({ missioniBloccoCompletate: 1 })).sbloccata, "L2 sbloccata con ≥1 missione del blocco");
ok(statoSblocco(2, con({ status: "confermata" })).sbloccata, "L2 sbloccata se area confermata");
ok(statoSblocco(2, con({ status: "da_verificare" })).sbloccata, "L2 sbloccata se area da_verificare (segnali forti)");
ok(statoSblocco(2, con({ interestScore: SOGLIA_L2_INTEREST })).sbloccata, `L2 sbloccata alla soglia di backup (${SOGLIA_L2_INTEREST})`);
ok(!statoSblocco(2, con({ status: "emergente", interestScore: SOGLIA_L2_INTEREST - 1 })).sbloccata, "L2 bloccata sotto soglia, area solo emergente");

// ── L3 — l'area «si consolida» ────────────────────────────────────────────────
console.log("\n3) Guida 3 — si sblocca quando l'area è consolidata");
ok(!statoSblocco(3, vuoto).sbloccata, "L3 bloccata con segnale vuoto");
ok(statoSblocco(3, con({ status: "confermata", missioniBloccoCompletate: 1 })).sbloccata, "L3 sbloccata: confermata + missione");
ok(!statoSblocco(3, con({ status: "confermata", missioniBloccoCompletate: 0 })).sbloccata, "L3 BLOCCATA: confermata ma nessuna missione");
ok(statoSblocco(3, con({ status: "da_verificare", confidence: 0.85, missioniBloccoCompletate: 1 })).sbloccata, "L3 sbloccata: da_verificare con confidenza alta + missione");
ok(!statoSblocco(3, con({ status: "da_verificare", confidence: 0.5, missioniBloccoCompletate: 1 })).sbloccata, "L3 bloccata: da_verificare con confidenza bassa");
ok(statoSblocco(3, con({ status: "emergente", interestScore: SOGLIA_L3_INTEREST, missioniBloccoCompletate: 1 })).sbloccata, `L3 sbloccata al backup: interesse ${SOGLIA_L3_INTEREST} + missione`);
ok(!statoSblocco(3, con({ status: "emergente", interestScore: SOGLIA_L3_INTEREST })).sbloccata, "L3 bloccata: interesse alto ma nessuna missione");

// ── Struttura del banco ───────────────────────────────────────────────────────
console.log("\n4) Struttura del config");
ok(TUTTE_LE_GUIDE.length === AREE.length * 3, `${AREE.length} aree × 3 = ${AREE.length * 3} guide (${TUTTE_LE_GUIDE.length})`);
let strutturaOk = true;
for (const a of AREE) {
  const g = guideDiArea(a.slug);
  if (g.length !== 3) strutturaOk = false;
  if (g.map((x) => x.livello).join() !== "1,2,3") strutturaOk = false;
  if (g.some((x) => x.pdf !== `/guide/${a.slug}/${x.livello}.pdf`)) strutturaOk = false;
  if (g.some((x) => !x.titolo || !x.sottotitolo)) strutturaOk = false;
}
ok(strutturaOk, "ogni area: 3 guide (livelli 1/2/3), percorso PDF /guide/<area>/<livello>.pdf, titoli non vuoti");

// ── Disponibilità config-driven (non fs) ──────────────────────────────────────
console.log("\n5) Disponibilità dichiarata da config (GUIDE_PRONTE)");
// guidaPronta riflette esattamente la mappa, per ogni area/livello.
let coerente = true;
for (const a of AREE) for (const liv of [1, 2, 3]) {
  const atteso = (GUIDE_PRONTE[a.slug] ?? []).includes(liv);
  if (guidaPronta(a.slug, liv) !== atteso) coerente = false;
}
ok(coerente, "guidaPronta() coincide con GUIDE_PRONTE per ogni area/livello");
ok(areeConGuida1Pronte().every((s) => guidaPronta(s, 1)), "areeConGuida1Pronte(): solo aree con la Guida 1 dichiarata pronta");
ok(areeConGuida1Pronte().length === AREE.filter((a) => (GUIDE_PRONTE[a.slug] ?? []).includes(1)).length, "areeConGuida1Pronte(): conteggio coerente con la mappa");

console.log("");
if (falliti > 0) { console.error(`✗ ${falliti} verifiche fallite`); process.exit(1); }
console.log("✓ Tutte le verifiche Guide superate.");
