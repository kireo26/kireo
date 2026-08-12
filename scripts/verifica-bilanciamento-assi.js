// KIREO — verifica del bilanciamento degli ASSI di stile sulle 11 missioni.
//
// Gli assi (analitico/relazionale/creativo/operativo) devono essere raggiungibili
// con peso comparabile, così a discriminare è QUALE opzione scegli, non QUALE
// missione giochi. Due controlli, con severità diverse (correzione di Mario: il
// test è un rilevatore, non un bersaglio):
//   1) PER MISSIONE — avviso non bloccante: stampa le missioni dove un asse
//      supera il doppio del più basso, senza far fallire nulla (uno squilibrio
//      onesto è ammesso: la serra è tecnica, la classe è relazionale).
//   2) ROSTER INTERO — BLOCCANTE: sommando il peso raggiungibile di tutte e 11
//      le missioni, nessun asse deve superare 1,5× il più basso. È lì che il
//      bilanciamento conta, perché uno studente gioca più missioni.
//
// "Peso raggiungibile per asse" (per missione) = quanto un ipotetico studente
// potrebbe accumulare su quell'asse facendo a ogni step la scelta che lo
// massimizza. Include le sorgenti uniformi non taggate: consulenze → relazionale,
// piano-nei-vincoli → operativo, ordinamento per affidabilità → analitico.
//
// Esecuzione: `npm run test:assi` (o `node scripts/verifica-bilanciamento-assi.js`).

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
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true }, fileName: filename });
  return mod._compile(out.outputText, filename);
};

const c = require(path.join(ROOT, "lib/escape/config.ts"));
const ASSI = ["analitico", "relazionale", "creativo", "operativo"];
const PESO_STILE = 1.35; // stesso peso emesso dalle missioni

// somma dei valori di un asse tra le opzioni (ogni opzione può avere più tag)
const sommaAsse = (opzioni, asse) => opzioni.reduce((s, o) => s + (o.assi ?? []).filter((t) => t.asse === asse).reduce((a, t) => a + t.valore, 0), 0);
// top-N valori di un asse (per gli step in cui si sceglie un numero limitato)
const topNAsse = (opzioni, asse, n) => opzioni.flatMap((o) => (o.assi ?? []).filter((t) => t.asse === asse).map((t) => t.valore)).sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);
const maxAsse = (opzioni, asse) => Math.max(0, ...opzioni.flatMap((o) => (o.assi ?? []).filter((t) => t.asse === asse).map((t) => t.valore)));

function raggiungibile(slug) {
  const def = c.getMissioneDef(slug);
  const letti = new Set(def.materialiGettone.map((m) => m.id));
  // risolvi con il primo mandato scelto e tutti i materiali letti (espone i gated)
  const get = c.accessoreDaMappa(new Map([["s1_mandato", { opzioneId: def.mandati[0].id }], ["s1_materiali", { letti: [...letti] }]]));
  const mission = c.getMissione(slug, get);
  const steps = c.stepDellaMissione(mission);
  const by = (id) => steps.find((s) => s.id === id);
  const r = { analitico: 0, relazionale: 0, creativo: 0, operativo: 0 };

  const mand = by("s1_mandato");
  const dossier = by("s2_informazioni");
  const budget = by("s3_budget");
  const ruoli = steps.find((s) => s.tipo === "assegna_ruoli" || s.tipo === "assegna_persone");
  const scarto = by("s3_scarto");
  const passi = by("s5_passi");
  const priorita = by("s1_priorita");
  const haAffidabilita = priorita && priorita.elementi.some((e) => typeof e.affidabilita === "number");

  // In un playthrough reale non si massimizza OGNI opzione di un asse: si
  // enfatizzano poche scelte. Gli step a scelta multipla contano quindi solo i
  // migliori pochi valori (top-3), non la somma piena — così un asse con molte
  // opzioni (l'asse "dominante" di quella missione) non gonfia il conteggio.
  for (const asse of ASSI) {
    let v = 0;
    v += maxAsse(mand.opzioni, asse); // 1 mandato scelto
    v += topNAsse(dossier.dossier, asse, Math.min(dossier.budget, 3)); // gettoni (materiali + consulenze), realistico
    v += topNAsse(budget.tipo === "alloca_budget" ? budget.voci : budget.lavori, asse, 3); // poche voci/lavori enfatizzati
    if (ruoli) v += topNAsse(ruoli.tipo === "assegna_persone" ? ruoli.compiti : ruoli.ruoli, asse, 2); // un paio di compiti "io"
    v += topNAsse(scarto.opzioni, asse, 2); // le opzioni tenute di quell'asse
    v += topNAsse(passi.passi, asse, passi.quanti); // 3 passi
    if (asse === "operativo") v += PESO_STILE * 0.7; // piano-nei-vincoli (feasibility) ~ operativo
    if (asse === "analitico" && haAffidabilita) v += PESO_STILE * 0.7; // ordinamento per affidabilità
    r[asse] = Number((v * PESO_STILE).toFixed(2));
  }
  return r;
}

const roster = { analitico: 0, relazionale: 0, creativo: 0, operativo: 0 };
const perMissione = [];
for (const meta of c.MISSIONI) {
  const r = raggiungibile(meta.slug);
  for (const a of ASSI) roster[a] += r[a];
  perMissione.push({ slug: meta.slug, r });
}

// 1) avviso per missione (non bloccante)
console.log("== Bilanciamento per missione (avviso, max ≤ 2× min) ==");
let avvisi = 0;
for (const { slug, r } of perMissione) {
  const vals = ASSI.map((a) => r[a]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const ok = min > 0 && max <= 2 * min;
  if (!ok) {
    avvisi++;
    console.log(`  ⚠ ${slug}: A ${r.analitico} · R ${r.relazionale} · C ${r.creativo} · O ${r.operativo}  (max/min ${(max / (min || 1)).toFixed(2)})`);
  }
}
if (avvisi === 0) console.log("  (nessuna missione oltre 2×)");

// 2) roster intero (bloccante, 1,5×)
console.log("\n== Roster intero (BLOCCANTE, max ≤ 1,5× min) ==");
console.log(`  analitico ${roster.analitico.toFixed(1)} · relazionale ${roster.relazionale.toFixed(1)} · creativo ${roster.creativo.toFixed(1)} · operativo ${roster.operativo.toFixed(1)}`);
const vals = ASSI.map((a) => roster[a]);
const max = Math.max(...vals), min = Math.min(...vals);
const rapporto = max / (min || 1);
console.log(`  max/min = ${rapporto.toFixed(3)} ${rapporto <= 1.5 ? "≤ 1,5 ✓" : "> 1,5 ✗"}`);

if (rapporto > 1.5) {
  console.error(`\n✗ Roster sbilanciato: ${ASSI.find((a) => roster[a] === max)} troppo alto rispetto a ${ASSI.find((a) => roster[a] === min)}.`);
  process.exit(1);
}
console.log("\n✓ Assi bilanciati sul roster.");
