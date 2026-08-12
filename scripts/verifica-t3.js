// KIREO — verifica di logica pura di T3 «Più a fondo» (Fase 3). Nessun DB,
// nessuna AI: esercita l'assemblaggio deterministico, lo scoring (torneo +
// tensione) e le invarianti del design.
//
// Copre: assemblaggio con 3/4/5 candidate; fallback sotto le 3; congelamento
// stabile per tentativo; distinzione prova-area vs prova-stile (un item di
// tensione non produce MAI evidence d'area, e viceversa); pesi a 0,35; classifica
// del torneo; copertura delle 54 vignette (18 aree × 3); ponte area→missione.
//
// Esecuzione: `npm run test:t3` (o `node scripts/verifica-t3.js`).

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

const { VIGNETTE_T3, missionePerArea } = require("@/lib/test/config");
const { selezionaCandidate, assemblaT3, MIN_CANDIDATE } = require("@/lib/test/assembla-t3");
const { calcolaEvidenzeT3 } = require("@/lib/test/scoring");
const { AREE } = require("@/data/aree");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

const AREE_18 = AREE.map((a) => a.slug);
const segnaliDa = (slugs) => slugs.map((s, i) => ({ area_slug: s, interest_score: 90 - i * 5 }));

// ── 1) Assemblaggio con 3/4/5 candidate ──────────────────────────────────────
console.log("\n1) Assemblaggio con 3/4/5 aree candidate");
for (const k of [3, 4, 5]) {
  const candidate = AREE_18.slice(0, k);
  const items = assemblaT3({ candidate, asseDominante: "analitico" }, "att-K" + k);
  const coppie = items.filter((it) => it.kind === "coppia");
  const tensione = items.filter((it) => it.kind === "tensione");
  ok(items.length >= 10 && items.length <= 12, `k=${k}: ${items.length} item (dentro 10-12)`);
  ok(tensione.length === 3, `k=${k}: 3 item di tensione`);
  ok(coppie.every((it) => it.opzioni[0].area !== it.opzioni[1].area), `k=${k}: ogni coppia mette due aree DIVERSE`);
  ok(tensione.every((it) => it.opzioni[0].asse !== it.opzioni[1].asse), `k=${k}: ogni tensione mette due ASSI diversi della stessa area`);
  ok(tensione.every((it) => it.area === candidate[0]), `k=${k}: la tensione è sull'area candidata #1`);
  const ids = items.map((it) => it.id);
  ok(new Set(ids).size === ids.length, `k=${k}: id degli item unici`);
  ok(items.every((it, i) => it.numero === i + 1), `k=${k}: numero progressivo 1..N`);
}

// ── 2) Fallback sotto le 3 candidate ─────────────────────────────────────────
console.log("\n2) Fallback sotto le 3 aree candidate");
ok(selezionaCandidate(segnaliDa(AREE_18.slice(0, 2))).length === 0, "2 candidate → selezione vuota (fallback)");
ok(selezionaCandidate(segnaliDa(AREE_18.slice(0, 3))).length === 3, "3 candidate → selezione piena");
ok(selezionaCandidate(segnaliDa(AREE_18)).length === MIN_CANDIDATE + 2, "molte candidate → cap a 5");
ok(assemblaT3({ candidate: AREE_18.slice(0, 2), asseDominante: null }, "att").length === 0, "assemblaT3 sotto le 3 → nessun item");

// ── 3) Congelamento stabile per tentativo ────────────────────────────────────
console.log("\n3) Ordine stabile per tentativo");
const cong = { candidate: AREE_18.slice(0, 5), asseDominante: "creativo" };
const a1 = assemblaT3(cong, "att-stabile").map((it) => it.id);
const a2 = assemblaT3(cong, "att-stabile").map((it) => it.id);
ok(JSON.stringify(a1) === JSON.stringify(a2), "stesso (congelate, attempt) → stessa sequenza identica");
const a3 = assemblaT3(cong, "att-diverso").map((it) => it.id);
ok(JSON.stringify(a1) !== JSON.stringify(a3), "attempt diverso → sequenza diversa");
ok(new Set(a1).size === new Set(a3).size && [...new Set(a1)].sort().join() === [...new Set(a3)].sort().join(), "stesso insieme di item, solo ordine diverso");

// ── 4) Distinzione prova-area vs prova-stile ─────────────────────────────────
console.log("\n4) Prova d'area (coppie) vs prova di stile (tensione)");
const candidate5 = AREE_18.slice(0, 5);
const items5 = assemblaT3({ candidate: candidate5, asseDominante: "analitico" }, "att-dist");
// Risposte SOLO alle tensioni: nessuna prova d'area deve nascere.
const soloTensione = new Map();
for (const it of items5) if (it.kind === "tensione") soloTensione.set(it.id, { opzioneId: it.opzioni[0].id });
const rt = calcolaEvidenzeT3({ candidate: candidate5, asseDominante: "analitico" }, "att-dist", soloTensione);
ok(rt.evidenze.length > 0 && rt.evidenze.every((e) => e.asse && !e.area_slug), "rispondendo SOLO alle tensioni: solo prove di STILE (asse), nessuna d'area");
// Risposte SOLO alle coppie: nessuna prova di stile deve nascere.
const soloCoppie = new Map();
for (const it of items5) if (it.kind === "coppia") soloCoppie.set(it.id, { opzioneId: it.opzioni[0].id });
const rc = calcolaEvidenzeT3({ candidate: candidate5, asseDominante: "analitico" }, "att-dist", soloCoppie);
ok(rc.evidenze.length > 0 && rc.evidenze.every((e) => e.area_slug && !e.asse), "rispondendo SOLO alle coppie: solo prove d'AREA, nessuna di stile");
ok([...rt.evidenze, ...rc.evidenze].every((e) => (e.area_slug ? 1 : 0) + (e.asse ? 1 : 0) === 1), "ogni prova ha ESATTAMENTE una tra area_slug e asse");

// ── 5) Pesi a 0,35 ───────────────────────────────────────────────────────────
console.log("\n5) Pesi");
const tutte = new Map();
for (const it of items5) tutte.set(it.id, { opzioneId: it.opzioni[0].id });
const rfull = calcolaEvidenzeT3({ candidate: candidate5, asseDominante: "analitico" }, "att-dist", tutte);
ok(rfull.evidenze.every((e) => e.peso === 0.35), "tutte le prove hanno peso 0,35");
ok(rfull.evidenze.every((e) => e.valore >= 0 && e.valore <= 1), "tutti i valori in [0,1]");

// ── 6) Classifica del torneo ─────────────────────────────────────────────────
console.log("\n6) Classifica del torneo");
// Responder che fa SEMPRE vincere candidate[0] quando è in campo.
const vincente = candidate5[0];
const respVince = new Map();
for (const it of items5) {
  if (it.kind !== "coppia") continue;
  const scelta = it.opzioni.find((o) => o.area === vincente) ?? it.opzioni[0];
  respVince.set(it.id, { opzioneId: scelta.id });
}
const rv = calcolaEvidenzeT3({ candidate: candidate5, asseDominante: "analitico" }, "att-dist", respVince);
ok(rv.classifica[0].area_slug === vincente, "chi vince tutti i suoi incontri è primo in classifica");
ok(rv.evidenze.some((e) => e.area_slug === vincente && e.valore === 1), "l'area che vince sempre ha valore 1 (tasso di vittorie)");

// ── 7) Copertura delle 54 vignette ───────────────────────────────────────────
console.log("\n7) Copertura del banco vignette (18 aree × 3)");
const chiavi = Object.keys(VIGNETTE_T3);
ok(chiavi.length === 18, `18 aree nel banco (${chiavi.length})`);
ok(AREE_18.every((s) => chiavi.includes(s)), "tutte e 18 le aree ufficiali sono coperte");
let vignTot = 0; const idsVign = new Set(); const ASSI_OK = ["analitico", "relazionale", "creativo", "operativo"];
let struttura = true;
for (const [area, terna] of Object.entries(VIGNETTE_T3)) {
  if (terna.length !== 3) struttura = false;
  for (const v of terna) { vignTot++; idsVign.add(v.id); if (v.area !== area || !ASSI_OK.includes(v.asse)) struttura = false; }
}
ok(vignTot === 54 && idsVign.size === 54, `54 vignette, id tutti unici (${vignTot}/${idsVign.size})`);
ok(struttura, "ogni vignetta: 3 per area, area coerente con la chiave, asse valido");

// ── 8) Ponte area→missione per tutte le 18 aree ──────────────────────────────
console.log("\n8) Ponte area→missione");
ok(AREE_18.every((s) => missionePerArea(s)), "ogni area punta a una missione reale");
ok(missionePerArea("salute-professioni-sanitarie")?.slug === "sportello-insieme", "salute → sportello-insieme (missione dove è centrale)");

console.log("");
if (falliti > 0) { console.error(`✗ ${falliti} verifiche fallite`); process.exit(1); }
console.log("✓ Tutte le verifiche T3 superate.");
