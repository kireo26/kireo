#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// IL CODICE D'INVITO DEL TUTOR E IL TETTO AI TENTATIVI, lato codice (01/11).
// La metà del database la prova scripts/verifica-codice-invito.sql. Qui:
// §1 la forma: un codice a metà non si verifica (la verifica conta i tentativi);
// §2 nessuno chiama più le due porte di prima;
// §3 la pagina passa dalla route, la route dal server, il riscatto dice il tetto.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
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
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((v) => {
    const rel = path.join(dir, v.name);
    return v.isDirectory() ? fileSorgenti(rel) : /\.(ts|tsx)$/.test(v.name) ? [rel] : [];
  });
}

const C = require(path.join(ROOT, "lib/scuola/codiceInvito.ts"));

console.log("\n§1 — la forma, con attesi scritti a mano\n");
// Il codice nuovo è quello che la replica ha generato il 01/11; il vecchio è
// quello del giro del 28/10.
ok(C.codiceInvitoCompleto("TUTOR-7151-E683-105C-4156"), "il codice nuovo (quattro gruppi) è completo");
ok(C.codiceInvitoCompleto("TUTOR-727A35CA"), "il codice di prima (otto caratteri) resta completo: gli inviti già mandati valgono");
for (const meta of ["TUTOR-", "TUTOR-727A", "TUTOR-7151-E683", "TUTOR-7151-E683-105C-415", "727A35CA", "TUTOR-727A35CAX"]) {
  ok(!C.codiceInvitoCompleto(meta), `«${meta}» non è un codice intero, e non si verifica`);
}
ok(C.normalizzaCodiceInvito("  tutor-727a35ca ") === "TUTOR-727A35CA", "il codice si normalizza (spazi, maiuscole)");
ok(C.leggiEsitoVerifica(null).esito === "non_controllato", "una risposta che non si legge non è «non valido»");
ok(C.leggiEsitoVerifica({ esito: "valido", nome_scuola: "Liceo X" }).nomeScuola === "Liceo X", "un codice valido porta il nome della scuola");
ok(C.leggiEsitoVerifica({ esito: "troppi_tentativi" }).esito === "troppi_tentativi", "il tetto arriva fino alla pagina");

console.log("\n§2 — le due porte di prima non le chiama nessuno\n");
{
  const file = ["app", "lib", "components"].flatMap(fileSorgenti);
  ok(file.length > 300, `letti i sorgenti (${file.length}, pavimento 300)`);
  const chi = file.filter((f) => /rpc\("(verifica_invito_tutor|redeem_invito_staff)"/.test(leggi(f)));
  ok(chi.length === 0, "nessun file chiama verifica_invito_tutor o redeem_invito_staff", chi);
}

console.log("\n§3 — la pagina, la route, il riscatto\n");
{
  const form = leggi("components/scuola/RiscattaInvitoTutorForm.tsx");
  ok(/fetch\("\/api\/scuola\/invito\/verifica"/.test(form), "la pagina verifica dalla route, non dal browser");
  const iCompleto = form.search(/if \(!codiceInvitoCompleto\(codiceNormalizzato\)\)/);
  const iFetch = form.search(/fetch\("\/api\/scuola\/invito\/verifica"/);
  ok(iCompleto >= 0 && iFetch > iCompleto, "un codice a metà si ferma prima della verifica", { iCompleto, iFetch });
  ok(/TESTI_CODICE_INVITO\.troppiTentativi/.test(form) && /troppi_tentativi:/.test(form), "la pagina dice il tetto, nella verifica e dopo la conferma");

  const route = leggi("app/api/scuola/invito/verifica/route.ts");
  ok(/createServiceRoleClient\(\)/.test(route) && /rpc\("controlla_codice_invito", \{ p_codice: codice, p_impronta: impronta\(req\) \}\)/.test(route),
    "la route passa alla funzione solo il codice e l'impronta");
  ok(/if \(!codiceInvitoCompleto\(codice\)\)/.test(route), "anche la route non conta un codice a metà");
  ok(/createHash\("sha256"\)/.test(route), "l'impronta è un hash, non l'indirizzo");

  const fin = leggi("lib/finalizzaInvitoTutor.ts");
  ok(/rpc\("riscatta_invito_tutor"/.test(fin), "il riscatto passa dalla funzione che conta");
  ok(/esito === "troppi_tentativi"\) return \{ ok: false, motivo: "troppi_tentativi" \}/.test(fin), "il tetto del riscatto diventa un motivo");

  const ctx = leggi("lib/scuola/context.ts");
  ok(/\/scuola\/invito\?errore=\$\{esito\.motivo\}/.test(ctx), "un tutor che non riscatta torna alla pagina dell'invito, che sa dire perché");
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:invito)`);
process.exit(falliti === 0 ? 0 : 1);
