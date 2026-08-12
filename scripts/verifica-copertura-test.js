// KIREO — verifica di copertura dei test attitudinali (controllo permanente).
//
// Invariante: ogni area delle 18 deve comparire ALMENO DUE VOLTE "in positivo"
// tra gli item di T1, cioè in uno slot dove sceglierla dà punteggio positivo —
// le opzioni degli item `positivo` e `forzata`. Gli item `negativo` (dove la
// scelta penalizza) NON contano come copertura positiva: un'area che appare solo
// lì non può mai emergere dal test.
//
// È il controllo che avrebbe intercettato l'errore di Ristorazione & Turismo
// (presente solo negli item negativi) ed Energia & Sostenibilità (una sola
// apparizione positiva). Va tenuto verde: fallisce (exit 1) se in futuro
// un'area scende sotto la soglia di due apparizioni positive.
//
// Esecuzione: `npm run test:copertura` (oppure `node scripts/verifica-copertura-test.js`).

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità, non parte del bundle Next */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const SOGLIA = 2;

// require-hook: transpila i .ts al volo e risolve l'alias @/.
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

const { getTest, SLUG_T1 } = require(path.join(ROOT, "lib/test/config.ts"));
const { AREE } = require(path.join(ROOT, "data/aree.ts"));

const test = getTest(SLUG_T1);
const slugValidi = new Set(AREE.map((a) => a.slug));

const errori = [];

// Le apparizioni "in positivo": opzioni degli item positivo + forzata.
const conteggioPositivo = new Map(AREE.map((a) => [a.slug, 0]));
for (const item of test.items) {
  const idsOpzioni = item.opzioni.map((o) => o.id);
  if (new Set(idsOpzioni).size !== idsOpzioni.length) errori.push(`Item ${item.id}: id opzione duplicati`);
  for (const o of item.opzioni) {
    if (!slugValidi.has(o.area)) errori.push(`Item ${item.id}, opzione ${o.id}: area non valida «${o.area}»`);
    if (item.tipo !== "negativo" && conteggioPositivo.has(o.area)) {
      conteggioPositivo.set(o.area, conteggioPositivo.get(o.area) + 1);
    }
  }
}

// INVARIANTE PRINCIPALE: ogni area ≥ SOGLIA apparizioni positive.
for (const [slug, n] of conteggioPositivo) {
  if (n < SOGLIA) errori.push(`Area «${slug}»: solo ${n} apparizione/i in positivo (minimo ${SOGLIA}). Non potrebbe mai emergere dal test.`);
}

// controlli di struttura (coerenti col design di T1)
if (test.items.length !== 14) errori.push(`T1 dovrebbe avere 14 item, ne ha ${test.items.length}`);
const negativi = test.items.filter((i) => i.tipo === "negativo").map((i) => i.numero).join(",");
const forzate = test.items.filter((i) => i.tipo === "forzata").map((i) => i.numero).join(",");
if (negativi !== "4,11") errori.push(`Item negativi attesi 4,11 — trovati ${negativi}`);
if (forzate !== "6,12") errori.push(`Item forzati attesi 6,12 — trovati ${forzate}`);

if (errori.length > 0) {
  console.error("✗ Copertura test T1 NON valida:");
  for (const e of errori) console.error("  - " + e);
  process.exit(1);
}

console.log(`✓ Copertura T1 valida: tutte e ${AREE.length} le aree compaiono almeno ${SOGLIA} volte in positivo.`);
const riepilogo = [...conteggioPositivo.entries()].sort((a, b) => a[1] - b[1]).map(([s, n]) => `${s}:${n}`);
console.log("  apparizioni positive per area — " + riepilogo.join("  "));
