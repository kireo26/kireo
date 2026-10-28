#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:sqleditor` — uno script per Mario è SQL e basta (28/10/2026).
//
// Gli script di `scripts/` finiscono nel SQL Editor di Supabase, e lì un
// meta-comando di psql (`\set`, `\if`, `\echo`, `\pset`) fa rifiutare il file
// intero prima della prima istruzione: `verifica-gesti-dei-minorenni.sql` si è
// fermato alla riga 10 su `\set ON_ERROR_STOP off`, e Mario l'ha fatto girare
// togliendo le righe a mano. *Uno strumento di verifica scritto per un posto
// diverso da quello in cui verrà eseguito non è una verifica più difficile: è
// una verifica che non parte.*
//
// Dove serve una scelta di psql, sta sulla riga di comando di chi lancia:
// `verifica-sql-tutti.sh` passa `-v ON_ERROR_STOP=1`, `controprova-sql.sh` lo
// lascia spento perché una replica nata senza la cosa deve andare avanti.
//
// Guarda anche le migrazioni: Mario le incolla nello stesso posto.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}

function sqlIn(dir) {
  const out = [];
  for (const voce of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...sqlIn(rel));
    else if (voce.name.endsWith(".sql")) out.push(rel);
  }
  return out;
}

// Una riga che comincia con una barra rovescia, fuori da un commento: è la
// forma di ogni meta-comando di psql. Dentro una stringa SQL una riga che
// comincia così non c'è in nessun file del repo (lo direbbe questo stesso
// controllo, con il nome del file).
function metaComandi(testo) {
  return testo
    .split("\n")
    .map((riga, i) => ({ riga: riga.trim(), n: i + 1 }))
    .filter(({ riga }) => /^\\[a-z]/i.test(riga));
}

// §0 la controprova del lettore, prima dei file veri.
ok(metaComandi("select 1;\n\\set ON_ERROR_STOP off\n").length === 1, "il lettore vede un \\set");
ok(metaComandi("  \\if :{?nome}\n").length === 1, "e uno rientrato");
ok(metaComandi("-- \\set nel commento\nselect '\\\\n';\n").length === 0, "non scambia un commento o una stringa per un meta-comando");

const file = [...sqlIn("scripts"), ...sqlIn("supabase/migrations")];
// Il pavimento sta su una quantità che non scende quando il prodotto migliora:
// i file letti. Al 28/10 sono 63 script e 141 migrazioni.
ok(file.length >= 150, `il lettore trova i file SQL (${file.length}, pavimento 150)`);
const conMeta = file
  .map((f) => ({ f, righe: metaComandi(fs.readFileSync(path.join(ROOT, f), "utf8")) }))
  .filter((x) => x.righe.length > 0);
ok(
  conMeta.length === 0,
  "nessuno script e nessuna migrazione contiene un meta-comando di psql",
  conMeta.map((x) => `${x.f}:${x.righe.map((r) => r.n).join(",")}`).join(" · "),
);

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
