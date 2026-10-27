#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// I CARATTERI STANNO DENTRO IL PROGETTO (Mario, 27/10). Con `next/font/google`
// la costruzione andava a prenderli da fuori, ed è fallita due volte in due
// giorni con lo stesso codice che poco prima era verde.
//
// §1 vieta la forma: nessun import di `next/font/google` in app/, components/,
// lib/ (commenti esclusi, perché il commento in testa al layout la nomina per
// dire di non farlo). §2 pretende che ogni `src` di `localFont` esista, sia un
// woff2 vero e abbia la sua licenza accanto (la OFL va distribuita con il
// carattere). §3 pretende le tre variabili CSS che il resto del sito legge.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? `\n      → ${typeof dettaglio === "string" ? dettaglio : JSON.stringify(dettaglio)}` : ""}`);
  }
}
function fileSorgenti(dir) {
  const out = [];
  for (const voce of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...fileSorgenti(rel));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(voce.name)) out.push(rel);
  }
  return out;
}

console.log("\n§1 — nessun carattere scaricato durante la costruzione\n");
{
  const sorgenti = ["app", "components", "lib"].flatMap(fileSorgenti);
  ok(sorgenti.length > 100, `file guardati: ${sorgenti.length}`);
  const conGoogle = sorgenti.filter((f) => /from\s+["']next\/font\/google["']/.test(senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"))));
  ok(conGoogle.length === 0, "nessun import di next/font/google", conGoogle);
  const css = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
  ok(!/fonts\.(googleapis|gstatic)\.com/.test(css), "e nessun @import di Google Fonts nel CSS");
}

console.log("\n§2 — ogni file dichiarato c'è, è un woff2 e ha la sua licenza\n");
{
  const layout = senzaCommenti(fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8"));
  const src = [...layout.matchAll(/src:\s*"(\.\/fonts\/[^"]+)"/g)].map((m) => m[1]);
  ok(src.length === 3, `il layout dichiara tre caratteri locali (${src.length})`, src);
  for (const s of src) {
    const file = path.join(ROOT, "app", s);
    const esiste = fs.existsSync(file);
    const firma = esiste ? fs.readFileSync(file).subarray(0, 4).toString("latin1") : "";
    ok(esiste && firma === "wOF2", `${s}: c'è ed è un woff2`, firma);
    ok(fs.existsSync(path.join(path.dirname(file), "LICENSE")), `${s}: la licenza è accanto`);
  }
}

console.log("\n§3 — le variabili che il sito legge\n");
{
  const layout = senzaCommenti(fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8"));
  for (const v of ["--font-display", "--font-dm-sans", "--font-poppins"]) ok(layout.includes(`variable: "${v}"`), `${v} è dichiarata`);
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:caratteri)`);
process.exit(falliti === 0 ? 0 : 1);
