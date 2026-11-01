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
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

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

console.log("\n§4 — il modulo dell'invito (passo 5.3)\n");
{
  const I = require(path.join(ROOT, "lib/scuola/invitoTutor.ts"));
  ok(I.erroreInvitoTutor("Anna", "Montefusco") === "emailNonValida", "«Montefusco» nel campo email non passa (il caso del 28/10)");
  ok(I.erroreInvitoTutor("Anna Montefusco", "") === null, "l'email lasciata vuota va bene");
  ok(I.erroreInvitoTutor("Anna Montefusco", "anna@scuola.it") === null, "un'email vera va bene");
  ok(I.erroreInvitoTutor("   ", "") === "nomeMancante", "il nome vuoto no");
  ok(I.erroreInvitoTutor("x".repeat(121), "") === "nomeLungo", "un nome di 121 caratteri no");
  // La forma è la stessa del database (attesi scritti a mano, non letti da qui).
  const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261201120000_invito_tutor_controlla_i_campi.sql"), "utf8");
  ok(sql.includes("'^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'") && I.FORMA_EMAIL_INVITO.source === "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
    "il controllo dell'email è lo stesso nel modulo e nel database");
  ok(sql.includes("length(v_nome) > 120") && I.LUNGHEZZA_MASSIMA_NOME_INVITO === 120, "anche il tetto del nome");

  const f = leggi("components/scuola/InvitaTutorForm.tsx");
  ok(/flex-col/.test(f) && !/flex-wrap items-end/.test(f), "i due campi stanno uno sotto l'altro, non affiancati");
  ok(/\{T\.etichettaEmail\}/.test(f) && /\{T\.notaEmail\}/.test(f) && !/solo per tuo riferimento/.test(f), "l'etichetta dell'email dice cos'è, e la nota sta sotto");
  ok(/erroreInvitoTutor\(nome, email\)/.test(f) && /noValidate/.test(f), "il controllo è nostro, non del browser");
  ok(/email_non_valida/.test(f), "un rifiuto del database dice quale campo");
  const p = leggi("app/scuola/(dashboard)/staff/page.tsx");
  ok(/email: \$\{t\.email_invitato\}/.test(p), "l'email sta sulla riga dell'invito in attesa: «per tuo riferimento» è vero");
  const testi = Object.values(I.TESTI_INVITO_TUTOR);
  ok(testi.flatMap((t) => trovaAccordi(t)).length === 0, "nessun testo accorda col genere");
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:invito)`);
process.exit(falliti === 0 ? 0 : 1);
