#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// npm run test:staticonversazione — le parole degli stati di una conversazione
// fra studente ed ente stanno in un posto solo (lib/messaggi/statoConversazione.ts).
//
// 1. Le chiavi, per ognuno dei tre che guardano, sono esattamente i valori del
//    tipo `conversazione_ente_stato` letti dalle migrazioni: uno stato nuovo
//    nasce rosso finché non ha le sue parole.
// 2. Uno stato sconosciuto non si stampa com'è.
// 3. Le tre liste chiamano la funzione, e nessun file di app/ o components/
//    stampa lo stato grezzo di una conversazione (`?? c.stato`, `: c.stato}`).
//    Lessicale: sbaglia per difetto.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();
const S = require(path.join(ROOT, "lib/messaggi/statoConversazione.ts"));

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

console.log("\n§1 · le chiavi sono l'enum delle migrazioni");
const dir = path.join(ROOT, "supabase/migrations");
const valori = new Set();
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of s.matchAll(/create type public\.conversazione_ente_stato as enum \(([^)]*)\)/g))
    for (const v of m[1].matchAll(/'([^']+)'/g)) valori.add(v[1]);
  for (const m of s.matchAll(/alter type public\.conversazione_ente_stato add value (?:if not exists )?'([^']+)'/g)) valori.add(m[1]);
}
ok(valori.size >= 4, `l'enum si legge dalle migrazioni (${valori.size} valori)`, [...valori]);
for (const chi of ["ente", "studente", "admin"]) {
  const chiavi = Object.keys(S.PAROLE_STATO_CONVERSAZIONE[chi]).sort();
  ok(JSON.stringify(chiavi) === JSON.stringify([...valori].sort()), `${chi}: una parola per ogni stato, e nessuna in più`, { chiavi, enum: [...valori] });
  for (const v of valori) {
    const p = S.paroleStatoConversazione(v, chi);
    ok(p && p !== v && p !== S.STATO_CONVERSAZIONE_NON_RICONOSCIUTO, `${chi}: «${v}» ha una parola che non è il valore grezzo`, p);
  }
}
// Gli attesi scritti a mano, non letti dal file sotto esame.
ok(S.paroleStatoConversazione("account_cancellato", "ente") === "Account cancellato", "l'ente legge «Account cancellato»");

console.log("\n§2 · uno stato sconosciuto non si stampa");
ok(S.paroleStatoConversazione("stato_inventato", "ente") === "Stato non riconosciuto", "un valore sconosciuto dice che non lo riconosciamo");
ok(S.paroleStatoConversazione(null, "admin") === "Stato non riconosciuto", "un valore assente pure");
ok(S.paroleStatoConversazione("toString", "studente") === "Stato non riconosciuto", "una chiave dell'oggetto non passa per uno stato");

console.log("\n§3 · le liste chiamano la funzione, e niente stampa lo stato grezzo");
const liste = [
  ["app/ente/(dashboard)/messaggi/page.tsx", "ente"],
  ["app/app/messaggi/page.tsx", "studente"],
  ["app/admin/enti/[id]/page.tsx", "admin"],
];
for (const [f, chi] of liste) {
  const s = senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));
  ok(s.includes(`paroleStatoConversazione(`) && s.includes(`"${chi}")`), `${f} chiama paroleStatoConversazione con «${chi}»`);
  ok(!/\bconst\s+ETICHETTA_STATO\s*[:=]/.test(s), `${f} non ha una tabella sua`);
}
let letti = 0;
const grezzi = [];
function scorri(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) scorri(p);
    else if (/\.tsx$/.test(e.name)) {
      letti++;
      const s = senzaCommenti(fs.readFileSync(p, "utf8"));
      if (!/conversazion/i.test(s)) continue;
      for (const m of s.matchAll(/(\?\?\s*\w+\.stato\b|:\s*\w+\.stato\s*\}|(?<!=)\{\s*\w+\.stato\s*\})/g)) grezzi.push(`${path.relative(ROOT, p)}: ${m[0]}`);
    }
  }
}
scorri(path.join(ROOT, "app"));
scorri(path.join(ROOT, "components"));
ok(letti > 150, `file letti: ${letti}`);
ok(grezzi.length === 0, "nessun file che parla di conversazioni stampa uno stato grezzo", grezzi.join("\n"));

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:staticonversazione)`);
process.exit(falliti === 0 ? 0 : 1);
