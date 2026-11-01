#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:account` — l'area dello studente dice con quale account si è
// dentro (Mario, 01/11: due giorni di schermi di test7 chiamati «test11»).
//   §1 la regola delle righe (attesi scritti a mano)
//   §2 la barra la monta nei due posti, e il layout le passa l'email vera
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");

abilitaTypeScript();
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
const { righeAccount } = require("@/lib/app/account");

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
const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("\n§1 — le righe\n");
const casi = [
  [{ nome: "Mario Izzo", email: "consulente.izzo+test7@gmail.com" }, { principale: "Mario Izzo", secondaria: "consulente.izzo+test7@gmail.com" }, "nome ed email: tutti e due, perché due account possono chiamarsi uguale"],
  [{ nome: "  ", email: "a@b.it" }, { principale: "a@b.it", secondaria: null }, "senza nome: l'email, una riga sola"],
  [{ nome: "Anna Rossi", email: null }, { principale: "Anna Rossi", secondaria: null }, "senza email: il nome"],
  [{ nome: "", email: "" }, { principale: null, secondaria: null }, "senza niente: niente, mai una riga vuota"],
];
for (const [ingresso, atteso, testo] of casi) {
  const esito = righeAccount(ingresso);
  ok(uguale(esito, atteso), testo, JSON.stringify(esito));
}

console.log("\n§2 — la barra e il layout\n");
const shell = leggi("components/app/AppShell.tsx");
const montaggi = (shell.match(/<AccountInUso\b/g) ?? []).length;
ok(montaggi === 2, "montato nei due posti: la barra del computer e l'header del telefono", String(montaggi));
ok(/<AccountInUso account=\{account\} compatto \/>/.test(shell), "…e sul telefono nella forma compatta (l'email)");
ok(/^\s+account: Account;/m.test(shell), "la prop è obbligatoria: un chiamante che non la passa non compila");
const layout = leggi("app/app/layout.tsx");
ok(/account=\{\{[^\n]*email: contesto\.email/.test(layout), "il layout passa l'email del contesto");
const ctx = leggi("lib/app/studentContext.ts");
ok(/email: user\.email \?\? null/.test(ctx), "…che viene da auth, cioè dall'account con cui si è dentro, non da un campo che si scrive");
const comp = leggi("components/app/AccountInUso.tsx");
ok(trovaAccordi(comp).length === 0, "nessun accordo col genere di chi legge", JSON.stringify(trovaAccordi(comp)));

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
