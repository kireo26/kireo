#!/usr/bin/env node
// Le parole che dicono «rosso» negli script SQL sono un vocabolario CHIUSO
// (30/10, Mario: «chiudi il vocabolario con una guardia, invece di allargarlo
// una parola alla volta»).
//
// Il caso: `verifica-newsletter.sql` scriveva «ROSSA», e `sql:tutti` e
// `controprova-sql.sh` riconoscevano solo «ROTTA/ROTTO/ROTTE»: un rosso vero si
// leggeva verde. E la controprova non contava «✗», che `sql:tutti` contava.
// Due lanciatori, due vocabolari, e nessuno lo diceva.
//
// Tre cose:
//   §1 le parole stanno in un posto solo, `scripts/lib/parole-rosse.regex`, e i
//      due lanciatori lo leggono (nessuna copia della regex);
//   §2 ogni esito che uno script SQL scrive per dire com'è andata usa una
//      parola di quel vocabolario quando è rosso. Le forme lette:
//      - `case when … then 'ok' else '<rosso>' end`, la forma della casa;
//      - una tabella `esiti (…, esito text)` scritta riga per riga: il terzo
//        valore è 'OK' oppure comincia con un rosso;
//      - una tabella con `ok boolean`, stampata senza la forma col case: lì il
//        rosso è il `f`, e deve stare in fondo alla riga (`select *` con `ok`
//        come ultima colonna);
//   §3 nessuno script dice rosso con una parola che i lanciatori non leggono:
//      un `else '<parola maiuscola>'` dopo un verde, fuori dal vocabolario, è
//      rosso qui.
// ⚠️ Lessicale: legge le forme che conosce. Per questo ha un pavimento sugli
// script letti e sulle forme trovate, e un elenco di script che non stampano
// esiti (le diagnostiche) con la ragione.

const fs = require("fs");
const path = require("path");
const { senzaCommentiSql } = require("./lib/senza-commenti");

const RADICE = path.join(__dirname, "..");
let fatte = 0;
let rotte = 0;
function ok(cond, msg) {
  fatte++;
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    rotte++;
    console.log(`  ✗ ${msg}`);
  }
}

const sorgenteRegex = fs.readFileSync(path.join(RADICE, "scripts/lib/parole-rosse.regex"), "utf8").trim();
const ROSSO = new RegExp(sorgenteRegex);
const VERDE = /^(ok|OK|✓|verde|VERDE|pulita)$/;

// Le diagnostiche stampano dati da leggere, non esiti: niente da chiudere.
const SENZA_ESITI = new Set([
  "diagnostica-colonne-che-decidono.sql", // stampa cosa riesce a scrivere un client: lo si legge
  "verifica-tipi-tabella.sql", // ha il suo riassunto: ✗ ROTTA, ⚠ non raggiunta (non un rosso: dichiarato in testa)
]);

console.log("§1 un vocabolario solo, letto dai lanciatori");
ok(sorgenteRegex.length > 0, `scripts/lib/parole-rosse.regex: ${sorgenteRegex}`);
ok(ROSSO.test("ROTTA") && ROSSO.test("ROTTO") && ROSSO.test("ROSSA") && ROSSO.test("✗"), "riconosce ROTTA, ROTTO, ROSSA e ✗");
ok(!ROSSO.test("ok") && !ROSSO.test("RESPINTO dal CHECK") && !ROSSO.test("0 ROTTEX"), "non riconosce ok, RESPINTO, né una parola che contiene ROTTE");
for (const lanciatore of ["scripts/verifica-sql-tutti.sh", "scripts/controprova-sql.sh"]) {
  const s = fs.readFileSync(path.join(RADICE, lanciatore), "utf8");
  ok(s.includes("parole-rosse.regex") && s.includes('"$PAROLE_ROSSE"'), `${lanciatore} legge le parole dal file`);
  ok(!/ROTT\[AOE\]|ROSS\[AOE\]/.test(s.replace(/^#.*$/gm, "")), `${lanciatore} non ha una copia sua della regex`);
}

// Gli script da guardare: tutti quelli che hanno una tabella `esiti`.
function scriptSql() {
  const fuori = [];
  for (const dir of ["scripts", "scripts/quarantena"]) {
    for (const f of fs.readdirSync(path.join(RADICE, dir))) {
      if (f.endsWith(".sql")) fuori.push(path.join(dir, f));
    }
  }
  return fuori;
}

const tutti = scriptSql();
let conEsiti = 0;
let formeTrovate = 0;
const fuoriVocabolario = [];
const senzaForma = [];

for (const rel of tutti) {
  const nome = path.basename(rel);
  const src = senzaCommentiSql(fs.readFileSync(path.join(RADICE, rel), "utf8"));
  const tabella = src.match(/create\s+temp(?:orary)?\s+table\s+esiti\s*\(([^)]*)\)/i);
  if (!tabella || SENZA_ESITI.has(nome)) continue;
  conEsiti++;
  const colonne = tabella[1].split(",").map((c) => c.trim().split(/\s+/)[0]);

  // §3: ogni else dopo un verde, con una parola maiuscola, sta nel vocabolario.
  let forme = 0;
  for (const m of src.matchAll(/then\s+'([^']*)'\s+else\s+'([^']*)'/gi)) {
    if (!VERDE.test(m[1].trim())) continue;
    forme++;
    if (!ROSSO.test(m[2])) fuoriVocabolario.push(`${rel}: then '${m[1]}' else '${m[2]}'`);
  }
  // `esiti (n, nome, esito text)`: il terzo valore di ogni insert.
  if (colonne[2] === "esito") {
    for (const m of src.matchAll(/insert\s+into\s+esiti\s+values\s*\(\s*\d+\s*,\s*'(?:[^']|'')*'\s*,\s*'([^']*)'/gi)) {
      forme++;
      if (!VERDE.test(m[1].trim()) && !ROSSO.test(m[1])) fuoriVocabolario.push(`${rel}: esito '${m[1]}'`);
    }
  }
  // Una tabella con `ok boolean` senza la forma col case: il `f` in fondo alla riga.
  if (forme === 0 && colonne.includes("ok")) {
    if (colonne[colonne.length - 1] === "ok" && /select\s+\*\s+from\s+esiti/i.test(src)) forme++;
  }
  formeTrovate += forme;
  if (forme === 0) senzaForma.push(rel);
}

console.log("§2 ogni script con esiti dice rosso in una forma che i lanciatori leggono");
ok(tutti.length >= 50, `script SQL letti: ${tutti.length} (pavimento 50)`);
ok(conEsiti >= 45, `script con una tabella esiti: ${conEsiti} (pavimento 45)`);
ok(formeTrovate >= 80, `forme dell'esito trovate: ${formeTrovate} (pavimento 80)`);
ok(senzaForma.length === 0, `script con esiti e nessuna forma letta: ${senzaForma.length}${senzaForma.length ? " → " + senzaForma.join(", ") : ""}`);

console.log("§3 nessuna parola rossa fuori dal vocabolario");
ok(fuoriVocabolario.length === 0, `esiti rossi fuori vocabolario: ${fuoriVocabolario.length}`);
for (const f of fuoriVocabolario) console.log(`      ${f}`);

// Le tarature: la forma di ieri e una nuova sono rosse, quella giusta no.
console.log("§4 tarature");
const prova = (s) => [...s.matchAll(/then\s+'([^']*)'\s+else\s+'([^']*)'/gi)].filter((m) => VERDE.test(m[1]) && !ROSSO.test(m[2])).length;
ok(prova("case when ok then 'ok' else 'ROTTA' end") === 0, "«else 'ROTTA'» è nel vocabolario");
ok(prova("case when ok then 'ok' else 'ROSSA' end") === 0, "«else 'ROSSA'» è nel vocabolario (il caso del 30/10)");
ok(prova("case when ok then 'ok' else 'FALLITA' end") === 1, "«else 'FALLITA'» è fuori, e qui sarebbe rosso");

console.log(`\n${fatte - rotte}/${fatte} proprietà${rotte ? ` — ${rotte} ROTTE` : ""}`);
process.exit(rotte ? 1 : 0);
