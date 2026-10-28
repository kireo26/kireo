#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:comunicazioni` — il consenso alle comunicazioni di KIREO e
// l'uscita dalle newsletter degli enti (28/10/2026, 20261107100000).
//   §1 la casella della registrazione è il consenso, e viene scritta
//   §2 l'uscita da una newsletter conta le righe che ha tolto
//   §3 /disiscrizione legge il consenso vero
//   §4 i testi: tre stati distinti, nessun accordo col genere
// La parte sul database (chi può scrivere la colonna) la prova
// scripts/verifica-consenso-comunicazioni.sql.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
abilitaTypeScript();
const C = require("@/lib/app/comunicazioniKireo");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

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
// Un'àncora mancante o doppia è un rosso, non un crash.
function posizione(src, nome) {
  try {
    return ancora(src, nome);
  } catch (e) {
    console.log(`    ${e.message.split("\n")[0]}`);
    return -1;
  }
}
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

console.log("\n§1 — la casella è il consenso\n");
const reg = leggi("components/RegistrazioneForm.tsx");
ok(reg.includes("{TESTO_CASELLA_REGISTRAZIONE}"), "la casella mostra il testo del consenso, da un posto solo");
ok(/KIREO/.test(C.TESTO_CASELLA_REGISTRAZIONE), "il testo della casella dice che sono le comunicazioni di KIREO", C.TESTO_CASELLA_REGISTRAZIONE);
const fin = leggi("lib/finalizzaRegistrazione.ts");
const iRpc = posizione(fin, 'supabase.rpc("finalize_registration"');
const iConsenso = posizione(fin, 'impostaComunicazioniKireo(supabase, meta.newsletter, "registrazione")');
ok(iRpc > 0 && iConsenso > iRpc, "la registrazione scrive il consenso dopo aver creato il profilo", `${iRpc} / ${iConsenso}`);
ok(/typeof meta\.newsletter === "boolean"/.test(fin), "solo una risposta vera e propria diventa un consenso (nessun default)");

console.log("\n§2 — l'uscita conta quello che ha tolto\n");
const com = leggi("components/app/ComunicazioniStudente.tsx");
ok(/\.from\("newsletter_iscrizioni"\)\.delete\(\)\.eq\("id", id\)\.select\(/.test(com), "la cancellazione rilegge le righe toccate (.select)");
ok(/data\.length === 0/.test(com), "zero righe è un rifiuto, non un'uscita");
ok(/impostaComunicazioniKireo\(createClient\(\), valore, origine\)/.test(com), "il profilo scrive il consenso dalla funzione, non dalla tabella");
ok(!/\.from\("profiles"\)\.update/.test(com), "nessun update diretto di profiles");
const profilo = leggi("app/app/profilo/page.tsx");
ok(profilo.includes("<ComunicazioniStudente"), "il profilo dello studente ha la sezione");

console.log("\n§3 — /disiscrizione legge il consenso\n");
const dis = leggi("app/disiscrizione/page.tsx");
ok(dis.includes("comunicazioni_kireo") && dis.includes("<ComunicazioniStudente"), "la pagina legge il consenso e lo fa cambiare");
ok(dis.includes('origine="disiscrizione"'), "con la sua origine");
ok(!/non c&apos;è quindi alcuna preferenza da revocare/.test(dis), "la frase «non c'è niente da revocare» è uscita");

console.log("\n§4 — i testi\n");
const stati = [true, false, null].map((v) => C.testoStatoConsenso(v));
ok(new Set(stati).size === 3, "tre stati, tre testi (mai chiesto non è un no)", JSON.stringify(stati));
const testi = [
  C.TESTO_CASELLA_REGISTRAZIONE,
  C.TESTO_A_COSA_SERVE,
  C.TESTO_SOLO_MAGGIORENNI,
  ...stati,
  ...[...com.matchAll(/>\s*([A-ZÈ][^<>{}]{8,})\s*</g)].map((m) => m[1]),
];
ok(testi.length >= 10, "testi letti (soglia)", String(testi.length));
const accordi = testi.flatMap((t) => trovaAccordi(t).map((a) => `${a} in «${t}»`));
ok(accordi.length === 0, "nessun accordo col genere di chi legge", accordi.join("; "));

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
