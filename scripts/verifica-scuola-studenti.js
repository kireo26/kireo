#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:scuolastudenti` — la scuola legge i suoi studenti da una
// funzione sola (01/11, 20261128100000).
//   §1 le regole dell'email (attesi scritti a mano)
//   §2 nessun file dell'area scuola legge `student_profiles` o il profilo di
//      uno studente dalla tabella: dopo la migrazione riceverebbe zero righe in
//      silenzio, e la pagina direbbe «nessuno studente»
//   §3 le pagine passano dalla funzione, e l'email di un dichiarato compare
//      solo sulle righe in attesa
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");

abilitaTypeScript();
const { emailPerVerifica, emailVerificato } = require("@/lib/scuola/studenti");

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
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

console.log("\n§1 — l'email\n");
const dic = { userId: "a", nome: "D", cognome: "D", classe: "5A", stato: "dichiarato", dichiaratoIl: null, verificatoIl: null, email: "d@x.it" };
const ver = { ...dic, userId: "b", stato: "verificato", email: "v@x.it" };
ok(emailPerVerifica(dic) === "d@x.it", "un dichiarato ha l'email per la verifica");
ok(emailPerVerifica(ver) === null, "la verifica non dà l'email di un verificato");
ok(emailVerificato(ver) === "v@x.it", "un verificato ha la sua email");
ok(emailVerificato(dic) === null, "fuori dalla verifica un dichiarato non ha l'email");

console.log("\n§2 — nessuna lettura dalla tabella\n");
const CARTELLE = ["app/scuola", "lib/scuola", "components/scuola", "app/api/scuola"];
const file = [];
function cammina(dir) {
  const ass = path.join(ROOT, dir);
  if (!fs.existsSync(ass)) return;
  for (const e of fs.readdirSync(ass, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) cammina(rel);
    else if (/\.tsx?$/.test(e.name)) file.push(rel);
  }
}
CARTELLE.forEach(cammina);
// Il pavimento sta sui file letti, che non scendono quando il prodotto migliora.
ok(file.length >= 25, `file dell'area scuola letti: ${file.length} (pavimento 25)`);
const leggono = [];
for (const rel of file) {
  const src = leggi(rel);
  if (/\.from\(\s*["']student_profiles["']\s*\)/.test(src)) leggono.push(`${rel}: from("student_profiles")`);
  // `profiles!student_id(…)` è sempre uno studente. `profiles!user_id(…)` no: su
  // `school_staff` sono i colleghi dello staff (policy loro, staff/page.tsx), e
  // su `student_profiles` lo prende già la riga sopra.
  if (/profiles!student_id\s*\(/.test(src)) leggono.push(`${rel}: profiles!student_id di uno studente`);
  if (/email_studenti_scuola/.test(src)) leggono.push(`${rel}: email_studenti_scuola`);
}
ok(leggono.length === 0, "nessun file dell'area scuola legge gli studenti dalla tabella", leggono.join("; "));

console.log("\n§3 — le pagine passano dalla funzione\n");
const PAGINE = [
  "app/scuola/(dashboard)/page.tsx",
  "app/scuola/(dashboard)/studenti/page.tsx",
  "app/scuola/(dashboard)/classi/page.tsx",
  "app/scuola/(dashboard)/comunicazioni/page.tsx",
  "app/scuola/(dashboard)/eventi/page.tsx",
  "lib/scuola/studenteDettaglio.ts",
];
for (const rel of PAGINE) ok(leggi(rel).includes("leggiStudentiDellaScuola(supabase)"), `${rel} legge da studenti_della_scuola`);
ok(/rpc\(\s*["']studenti_della_scuola["']\s*\)/.test(leggi("lib/scuola/studenti.ts")), "il caricatore chiama studenti_della_scuola");
const studenti = leggi("app/scuola/(dashboard)/studenti/page.tsx");
ok(/soloDichiarati\([^)]*\)[\s\S]{0,300}email: emailPerVerifica\(s\)/.test(studenti), "sulle righe in attesa l'email viene da emailPerVerifica");
ok(!/emailPerVerifica/.test(studenti.slice(studenti.indexOf("Studenti verificati"))), "l'elenco dei verificati non usa l'email della verifica");
for (const rel of PAGINE.filter((r) => !r.includes("/studenti/page.tsx"))) {
  ok(!leggi(rel).includes("emailPerVerifica"), `${rel} non mostra l'email di un dichiarato`);
}

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} ${falliti === 0 ? "verdi" : `— ${falliti} rosse`}`);
process.exit(falliti === 0 ? 0 : 1);
