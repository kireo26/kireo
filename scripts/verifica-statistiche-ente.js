#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LE STATISTICHE DELL'ENTE (Mario, 27/10): «Download guida: 0» con la guida
// scaricata, e «0 iscritti · 1 partecipati» sulla stessa riga. Le due cure
// stanno nel database (20261102110000, 20261102120000, provate da
// `scripts/verifica-statistiche-ente.sql`); qui si sorveglia la metà del client
// che le fa funzionare, cioè DOVE e COME si scrive `recinto_enti`.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
abilitaTypeScript();

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
const leggi = (f) => senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));

function fileSorgenti(dir) {
  const out = [];
  for (const voce of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...fileSorgenti(rel));
    else if (/\.(ts|tsx)$/.test(voce.name)) out.push(rel);
  }
  return out;
}

console.log("\n§1 — chi scrive il recinto, e su quale vincolo\n");
{
  // L'insieme: ogni file del prodotto che nomina la tabella in una `.from(...)`.
  const sorgenti = ["app", "components", "lib"].flatMap(fileSorgenti);
  const scrittori = sorgenti.filter((f) => /\.from\(\s*["']recinto_enti["']\s*\)\s*\.\s*(insert|upsert|update|delete)\b/.test(leggi(f)));
  ok(scrittori.length === 1 && scrittori[0] === path.join("lib", "app", "recinto.ts"),
    "una sola scrittura su recinto_enti in tutto il prodotto, in lib/app/recinto.ts", scrittori);

  // L'atteso viene dalle MIGRAZIONI, non dal file sotto esame: l'ultimo vincolo
  // unique su recinto_enti che nessuna migrazione successiva ha tolto.
  const dir = path.join(ROOT, "supabase/migrations");
  const vincoli = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
    // Per nome: un file che crea il recinto crea anche altre tabelle, coi loro vincoli.
    for (const m of sql.matchAll(/constraint (recinto_enti_\w+) unique \(([^)]*)\)/g)) {
      vincoli.set(m[1], m[2].split(",").map((c) => c.trim()).sort().join(","));
    }
    for (const m of sql.matchAll(/alter table public\.recinto_enti drop constraint (\w+)/g)) vincoli.delete(m[1]);
  }
  ok(vincoli.size === 1, `le migrazioni lasciano un vincolo unique sul recinto (${[...vincoli.keys()].join(", ") || "nessuno"})`);
  const atteso = [...vincoli.values()][0] ?? "";
  const recinto = leggi("lib/app/recinto.ts");
  const bersaglio = (recinto.match(/onConflict:\s*"([^"]+)"/) ?? [])[1] ?? "";
  ok(bersaglio.split(",").map((c) => c.trim()).sort().join(",") === atteso,
    "il bersaglio del conflitto è il vincolo delle migrazioni", { bersaglio, atteso });
  ok(atteso.split(",").includes("origine"), "…e il vincolo comprende l'origine: una guida dopo un evento lascia la sua riga", atteso);
  ok(/if \(error\) console\.error/.test(recinto), "un errore della scrittura si scrive nel log, non si butta");

  // Ogni gesto passa da lì, ognuno con la sua origine.
  for (const [f, origine] of [
    ["components/app/GuidaEnteForm.tsx", "guida"],
    ["components/app/IscrivitiNewsletterButton.tsx", "newsletter"],
    ["components/app/IscrivitiEventoButton.tsx", "evento"],
  ]) {
    ok(new RegExp(`segnaNelRecinto\\([^)]*"${origine}"\\)`).test(leggi(f)), `${f} segna l'origine «${origine}»`);
  }
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:statistiche)`);
process.exit(falliti === 0 ? 0 : 1);
