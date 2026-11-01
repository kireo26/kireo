#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// «RIPROVA FRA POCO» SI DICE SOLO QUANDO RIPROVARE PUÒ FUNZIONARE (Mario, 01/11).
// Il caso: reimpostare la password con quella di prima diceva «Qualcosa è andato
// storto. Riprova tra qualche istante.», e riprovando identico falliva identico.
// §1 i messaggi, con gli attesi scritti a mano (mai importati da lib/authErrors.ts);
// §2 nessun rifiuto per una regola consiglia di riprovare;
// §3 i testi non accordano col genere di chi legge;
// §4 i form di autenticazione passano tutti dalla stessa funzione.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
const A = require(path.join(ROOT, "lib/authErrors.ts"));

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
const err = (o) => ({ name: "AuthApiError", message: "", status: 400, ...o });
const m = (o) => A.messaggioErroreAuth(err(o));

console.log("\n§1 — i messaggi, attesi scritti a mano\n");
ok(m({ code: "same_password", status: 422 }) === "La nuova password deve essere diversa da quella di prima.", "la stessa password di prima dice la regola", m({ code: "same_password" }));
ok(m({ code: undefined, status: 422, message: "New password should be different from the old password." }) === "La nuova password deve essere diversa da quella di prima.", "anche senza codice, dal testo di Supabase");
ok(m({ code: "weak_password", status: 422, reasons: ["length"] }) === "Questa password è troppo corta. Scegline un'altra.", "password debole per lunghezza", m({ code: "weak_password", reasons: ["length"] }));
ok(m({ code: "weak_password", status: 422, reasons: ["pwned"] }).includes("password rubate"), "password debole perché rubata");
ok(m({ code: "weak_password", status: 422, reasons: [] }) === "Questa password non è abbastanza sicura: scegline un'altra.", "password debole senza motivi");
ok(m({ code: "session_not_found", status: 403 }).includes("Password dimenticata"), "la sessione del link finita manda a chiedere un link nuovo");
ok(m({ code: "invalid_credentials" }) === "Email o password non corretti.", "le credenziali sbagliate restano com'erano");
ok(m({ code: "unexpected_failure", status: 500 }) === "Qualcosa è andato storto da parte nostra. Riprova tra qualche istante.", "un guasto del server: riprovare può servire");
ok(m({ name: "AuthRetryableFetchError", status: 0, code: undefined }) === "Qualcosa è andato storto da parte nostra. Riprova tra qualche istante.", "un guasto di rete: riprovare può servire");
ok(m({ code: "codice_mai_visto", status: 400 }) === "La richiesta non è stata accettata, e non sappiamo dirti perché. Se ti succede di nuovo, scrivici da Contatti.", "un rifiuto sconosciuto non promette che riprovare funzioni", m({ code: "codice_mai_visto" }));

console.log("\n§2 — un rifiuto per una regola non consiglia di riprovare\n");
const REGOLE = ["same_password", "weak_password", "invalid_credentials", "email_not_confirmed", "user_already_exists", "email_exists", "email_address_invalid", "signup_disabled", "session_not_found", "session_expired", "codice_mai_visto"];
for (const c of REGOLE) {
  const t = m({ code: c, status: 422, reasons: ["length"] });
  ok(!/riprova/i.test(t), `«${c}» non dice di riprovare`, t);
}
// I soli che possono dire «riprova»: i limiti di frequenza (aspettare serve) e i guasti.
ok(/riprova tra qualche minuto/i.test(m({ code: "over_request_rate_limit", status: 429 })), "il limite di frequenza dice di aspettare, ed è vero");

console.log("\n§3 — nessun accordo di genere\n");
const testi = [
  ...REGOLE.map((c) => m({ code: c, status: 422, reasons: ["length", "characters", "pwned"] })),
  A.TESTO_GUASTO_PASSEGGERO,
  A.TESTO_RIFIUTO_SCONOSCIUTO,
];
const accordi = testi.flatMap((t) => trovaAccordi(t).map((a) => `${a.forma} in «${t}»`));
ok(testi.length >= 12 && accordi.length === 0, `${testi.length} testi senza accordi di genere`, accordi);

console.log("\n§4 — i form di autenticazione passano tutti da messaggioErroreAuth\n");
const FORM = ["components/ReimpostaPasswordForm.tsx", "components/AccediForm.tsx", "components/RecuperaPasswordForm.tsx", "components/RegistrazioneForm.tsx"];
for (const f of FORM) {
  const src = senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));
  ok(src.includes("messaggioErroreAuth(error)"), `${f} traduce l'errore di Supabase con la funzione`);
}
const sorgente = senzaCommenti(fs.readFileSync(path.join(ROOT, "lib/authErrors.ts"), "utf8"));
ok(!sorgente.includes('const FALLBACK = "Qualcosa è andato storto. Riprova tra qualche istante."'), "il ripiego unico che diceva di riprovare a tutto non c'è più");

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà (npm run test:erroriauth)`);
process.exit(falliti === 0 ? 0 : 1);
