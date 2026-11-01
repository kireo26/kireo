#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// UN LINK DELLE EMAIL GIÀ USATO NON PORTA AL MODULO DI ACCESSO IN SILENZIO (01/11).
// §1 le regole, con gli attesi scritti a mano;
// §2 i tre punti in cui un link fallito finisce: /auth/confirm, /reimposta-password, il frammento;
// §3 i testi: niente promesse che non si possono mantenere, nessun accordo di genere.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
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
const L = require(path.join(ROOT, "lib/auth/linkEmail.ts"));

console.log("\n§1 — le regole\n");
ok(L.erroreLinkFallito("recovery") === "link_reset_usato", "un reset fallito ha il suo errore");
ok(L.erroreLinkFallito("signup") === "link_scaduto", "una conferma fallita ha l'altro");
ok(L.erroreLinkFallito("email") === "link_scaduto", "anche il tipo «email»");
ok(L.erroreDalFrammento("#error=access_denied&error_code=otp_expired&error_description=x") === "link_scaduto", "il frammento di Supabase con otp_expired");
ok(L.erroreDalFrammento("#error=server_error") === "link_non_valido", "un altro errore nel frammento: non valido");
ok(L.erroreDalFrammento("") === null && L.erroreDalFrammento("#") === null, "nessun frammento: nessun errore");
ok(L.erroreDalFrammento("#sezione") === null, "un'àncora qualunque non è un errore");

ok(L.erroreScambioFallito("recovery", "pkce_code_verifier_not_found") === "link_reset_altro_browser", "reset aperto in un altro browser: non si dice «scaduto»");
ok(L.erroreScambioFallito("signup", "pkce_code_verifier_not_found") === "link_conferma_altro_browser", "conferma aperta in un altro browser: idem");
ok(L.erroreScambioFallito("recovery", "flow_state_expired") === "link_reset_usato", "un altro errore dello scambio: usato o scaduto");
ok(L.erroreScambioFallito("signup", undefined) === "link_scaduto", "e per la conferma il suo");

console.log("\n§1bis — il codice del link diventa una sessione (01/11: il reset non funzionava da pulito)\n");
const instr = (p, q) => L.instradaCodiceEmail(p, new URLSearchParams(q));
ok(instr("/reimposta-password", "code=abc") === "/auth/confirm?code=abc&type=recovery&next=%2Freimposta-password", "il reset con ?code= va a farsi scambiare", instr("/reimposta-password", "code=abc"));
ok(instr("/app", "code=x") === "/auth/confirm?code=x&type=signup&next=%2Fapp", "la conferma di uno studente (/app)");
ok(instr("/dopo-accesso", "code=x") === "/auth/confirm?code=x&type=signup&next=%2Fdopo-accesso", "la conferma degli altri ruoli (/dopo-accesso)");
ok(instr("/reimposta-password", "") === null, "senza codice: niente");
ok(instr("/news", "code=x") === null && instr("/accedi", "code=x") === null, "un ?code= altrove non è nostro: niente");
const proxySrc = leggi("lib/supabase/proxy.ts");
ok(/instradaCodiceEmail\(request\.nextUrl\.pathname, request\.nextUrl\.searchParams\)/.test(proxySrc), "il proxy lo chiama");
ok(ancora(proxySrc, "instradaCodiceEmail(") < ancora(proxySrc, "isProtetta ="), "e prima della guardia delle aree (altrimenti /app?code= finisce all'accesso)");

console.log("\n§2 — i tre punti di arrivo\n");
const conferma = leggi("app/auth/confirm/route.ts");
ok(/erroreLinkFallito\(type\)/.test(conferma), "/auth/confirm sceglie l'errore dal tipo");
ok(!/errore=link_scaduto"/.test(conferma), "e non rimanda più a un errore fisso");
ok(/exchangeCodeForSession\(codice/.test(conferma), "/auth/confirm scambia il codice per una sessione");
ok(/erroreScambioFallito\(type, error\?\.code\)/.test(conferma), "e uno scambio fallito dice perché");
const reimposta = leggi("app/reimposta-password/page.tsx");
ok(/redirect\("\/accedi\?errore=link_reset_usato"\)/.test(reimposta), "/reimposta-password senza sessione dice perché");
ok(!/redirect\("\/accedi"\)/.test(reimposta), "e non rimanda più al modulo muto");
const accedi = leggi("components/AccediForm.tsx");
ok(/erroreDalFrammento\(window\.location\.hash\)/.test(accedi), "il modulo di accesso legge il frammento");
ok(/\.\.\.MESSAGGI_LINK_EMAIL/.test(accedi), "e prende i testi da un posto solo");
for (const codice of ["link_reset_usato", "link_scaduto", "link_non_valido", "link_reset_altro_browser", "link_conferma_altro_browser"]) {
  ok(typeof L.MESSAGGI_LINK_EMAIL[codice] === "string", `«${codice}» ha un testo`);
}

console.log("\n§3 — i testi\n");
const M = L.MESSAGGI_LINK_EMAIL;
ok(M.link_reset_usato === "Questo link è già stato usato, oppure è scaduto. Chiedine un altro da «Password dimenticata».", "il testo del reset è quello di Mario", M.link_reset_usato);
ok(/Password dimenticata/.test(accedi), "e «Password dimenticata» c'è davvero sul modulo");
const tutti = Object.values(M).join(" ");
ok(!/richiedi un nuovo link/i.test(tutti), "nessun testo promette un link di conferma nuovo (non esiste)");
ok(!/\d+\s*(ore|ora|minuti|giorni)/.test(tutti), "nessuna durata non misurata");
ok(trovaAccordi(tutti).length === 0, "nessun accordo di genere", trovaAccordi(tutti));

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:linkemail)`);
process.exit(falliti === 0 ? 0 : 1);
