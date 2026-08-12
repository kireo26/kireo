// KIREO — verifica di logica pura del test T2 «Come ti muovi» (Fase 2).
//
// Copre le cinque cose «da non sbagliare» del design, senza DB né chiamate AI:
//   1) NORMALIZZAZIONE PER-ASSE: ogni responder «puro» raggiunge il proprio asse
//      a piena scala (≥0,85). È la prova che si normalizza sul massimo di CIASCUN
//      asse: sotto un massimo comune, creativo/relazionale (tetto grezzo più
//      basso) resterebbero strutturalmente sotto — lo dimostriamo calcolando che
//      quella normalizzazione produrrebbe uno squilibrio (spread > 0,15).
//   2) SCELTE FORZATE NEGATIVE: +3 all'asse scelto, −1 all'altro; un asse che
//      resta sotto zero non genera prova.
//   3) STABILITÀ DELLA RANDOMIZZAZIONE: ordineOpzioni è deterministico per
//      (attempt, item) ed è sempre una permutazione.
//   4) ASSEGNAZIONE DEL PROFILO: distacco ≥12 → specialista; <12 → ibrido della
//      coppia dominante.
//   5) LINGUAGGIO DEI PROFILI: nessuna formula proibita («sei un…», «portato»…).
//   + divergenza test↔missioni (soglia di 2 missioni, assi dominanti diversi).
//
// Esecuzione: `npm run test:t2` (o `node scripts/verifica-test-t2.js`).

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

const { getTest, SLUG_T2 } = require("@/lib/test/config");
const { calcolaEvidenzeT2, massimiTeorici } = require("@/lib/test/scoring");
const { assegnaProfilo, PROFILI, SOGLIA_DOMINANTE } = require("@/lib/test/profili");
const { calcolaDivergenza } = require("@/lib/test/divergenza");
const { ordineOpzioni } = require("@/lib/test/ordine");

const ASSI = ["analitico", "relazionale", "creativo", "operativo"];
let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

const test = getTest(SLUG_T2);
if (!test || test.misura !== "assi") { console.error("T2 non trovato o non di tipo assi"); process.exit(1); }

// ── Responder «puro» per un asse X: su ogni item massimizza X. ────────────────
function responderPuro(asse) {
  const r = new Map();
  for (const item of test.items) {
    if (item.tipo === "scelta") {
      let best = item.opzioni[0], bestPunti = -Infinity;
      for (const o of item.opzioni) {
        const punti = o.pesi.filter((p) => p.asse === asse).reduce((a, p) => a + p.punti, 0);
        if (punti > bestPunti) { bestPunti = punti; best = o; }
      }
      r.set(item.id, { opzioneId: best.id });
    } else if (item.tipo === "ordina") {
      const ordine = [...item.elementi].sort((a, b) => (b.asse === asse ? 1 : 0) - (a.asse === asse ? 1 : 0)).map((e) => e.id);
      r.set(item.id, { ordine });
    } else if (item.tipo === "alloca") {
      const voceX = item.voci.find((v) => v.asse === asse) ?? item.voci[0];
      r.set(item.id, { allocazioni: { [voceX.id]: item.totale } });
    } else {
      r.set(item.id, { valore: item.asse === asse ? 5 : 1 });
    }
  }
  return r;
}

// ── 1) Normalizzazione per-asse ───────────────────────────────────────────────
console.log("\n1) Normalizzazione per-asse (responder puri raggiungono la piena scala)");
const massimi = massimiTeorici(SLUG_T2);
const ownAxisPerAsse = {};
for (const asse of ASSI) {
  const evid = calcolaEvidenzeT2(SLUG_T2, responderPuro(asse));
  const propria = evid.find((e) => e.asse === asse);
  ownAxisPerAsse[asse] = propria ? propria.valore : 0;
  ok(propria && propria.valore >= 0.85, `responder puro «${asse}»: raggiunge ${(ownAxisPerAsse[asse]).toFixed(2)} sul proprio asse (≥0,85)`);
}
const spreadPerAsse = Math.max(...ASSI.map((a) => ownAxisPerAsse[a])) - Math.min(...ASSI.map((a) => ownAxisPerAsse[a]));
ok(spreadPerAsse <= 0.15, `con normalizzazione per-asse i quattro punteggi propri sono vicini (spread ${spreadPerAsse.toFixed(2)} ≤ 0,15)`);

// Contro-prova: sotto un massimo COMUNE lo stesso profilo sarebbe squilibrato.
const massimoComune = Math.max(...ASSI.map((a) => massimi[a]));
const sottoComune = ASSI.map((a) => (ownAxisPerAsse[a] * massimi[a]) / massimoComune);
const spreadComune = Math.max(...sottoComune) - Math.min(...sottoComune);
ok(spreadComune > 0.15, `un massimo comune produrrebbe invece squilibrio (spread ${spreadComune.toFixed(2)} > 0,15): per questo si normalizza per-asse`);

// ── 2) Scelte forzate negative ────────────────────────────────────────────────
console.log("\n2) Scelte forzate: +3/−1, un asse sotto zero non genera prova");
// Solo i tre item forzati, tutti a favore dell'analitico (penalizzano operativo/relazionale).
const rForzate = new Map([
  ["t2_10", { opzioneId: "t2_10a" }], // analitico +3, operativo −1
  ["t2_12", { opzioneId: "t2_12a" }], // analitico +3, relazionale −1
]);
const evidForzate = calcolaEvidenzeT2(SLUG_T2, rForzate);
ok(evidForzate.some((e) => e.asse === "analitico"), "analitico (+6) genera prova");
ok(!evidForzate.some((e) => e.asse === "operativo"), "operativo (−1) NON genera prova");
ok(!evidForzate.some((e) => e.asse === "relazionale"), "relazionale (−1) NON genera prova");
ok(evidForzate.every((e) => e.peso > 0 && e.valore >= 0 && e.valore <= 1), "ogni prova ha peso > 0 e valore in [0,1]");

// ── 3) Stabilità della randomizzazione ────────────────────────────────────────
console.log("\n3) Randomizzazione stabile e permutazione");
const opz = test.items[0].opzioni;
const o1 = ordineOpzioni("att-1", "t2_1", opz).map((o) => o.id);
const o1bis = ordineOpzioni("att-1", "t2_1", opz).map((o) => o.id);
const o2 = ordineOpzioni("att-2", "t2_1", opz).map((o) => o.id);
ok(JSON.stringify(o1) === JSON.stringify(o1bis), "stesso (attempt, item) → stesso ordine");
ok([...o1].sort().join() === opz.map((o) => o.id).sort().join(), "l'ordine è una permutazione (stesso insieme)");
let diversi = 0;
for (const it of test.items.filter((i) => i.tipo === "scelta")) {
  const a = ordineOpzioni("A", it.id, it.opzioni).map((o) => o.id).join();
  const b = ordineOpzioni("B", it.id, it.opzioni).map((o) => o.id).join();
  if (a !== b) diversi++;
}
ok(diversi > 0, `attempt diversi producono ordini diversi su almeno un item (${diversi})`);

// ── 4) Assegnazione del profilo ───────────────────────────────────────────────
console.log("\n4) Assegnazione del profilo (soglia " + SOGLIA_DOMINANTE + ")");
ok(assegnaProfilo({ analitico: 80, operativo: 55, creativo: 20, relazionale: 10 }).id === "spec_analitico", "distacco ≥12 → specialista dell'asse dominante");
ok(assegnaProfilo({ analitico: 50, operativo: 45, creativo: 20, relazionale: 10 }).id === "stratega", "distacco <12 (analitico+operativo) → ibrido stratega");
ok(assegnaProfilo({ relazionale: 50, creativo: 46, analitico: 20, operativo: 10 }).id === "connettore", "distacco <12 (relazionale+creativo) → ibrido connettore");
ok(Boolean(assegnaProfilo({ analitico: 25, relazionale: 25, creativo: 25, operativo: 25 })), "tutti pari: restituisce un profilo senza errori");

// ── 5) Linguaggio dei profili ─────────────────────────────────────────────────
console.log("\n5) Linguaggio dei profili (nessuna formula proibita)");
const PROIBITE = [/\bsei un\b/i, /\bsei uno\b/i, /\bsei una\b/i, /\bportato\b/i, /\bnon sei\b/i, /\bnon portato\b/i];
let violazioni = 0;
for (const p of Object.values(PROFILI)) {
  const testo = `${p.comeTiMuovi} ${p.puntoCieco}`;
  for (const re of PROIBITE) if (re.test(testo)) { console.error(`  ✗ profilo ${p.id}: contiene «${re}»`); violazioni++; }
}
ok(violazioni === 0, "nessun profilo usa «sei un…», «portato», «non sei…»");

// ── 6) Divergenza test↔missioni ───────────────────────────────────────────────
console.log("\n6) Divergenza test↔missioni");
const prove = [
  { asse: "analitico", valore: 0.9, peso: 0.35, fonte: "test" },
  { asse: "operativo", valore: 0.9, peso: 1.35, fonte: "mission" },
  { asse: "operativo", valore: 0.8, peso: 1.35, fonte: "mission" },
];
ok(calcolaDivergenza(prove, 1) === null, "con <2 missioni: nessuna divergenza");
const d = calcolaDivergenza(prove, 2);
ok(d && d.asseTest === "analitico" && d.asseMissioni === "operativo", "≥2 missioni + assi dominanti diversi → divergenza (test analitico, missioni operativo)");
const proveConcordi = [
  { asse: "analitico", valore: 0.9, peso: 0.35, fonte: "test" },
  { asse: "analitico", valore: 0.9, peso: 1.35, fonte: "mission" },
  { asse: "analitico", valore: 0.8, peso: 1.35, fonte: "mission" },
];
ok(calcolaDivergenza(proveConcordi, 3) === null, "assi dominanti concordi → nessuna divergenza");

console.log("");
if (falliti > 0) { console.error(`✗ ${falliti} verifiche fallite`); process.exit(1); }
console.log("✓ Tutte le verifiche T2 superate.");
