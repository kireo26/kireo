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

console.log("\n§5 — un consenso vale solo se dato da maggiorenni (20261107110000)\n");
// Le date sono scritte a mano qui, e sono le stesse di
// scripts/verifica-consenso-maggiorenni.sql: due copie della regola (TS e SQL)
// devono dire la stessa cosa sugli stessi casi.
ok(C.consensoDatoDaMaggiorenne("2025-03-10T00:00:00Z", "2007-03-10") === true, "il giorno dei 18 anni vale");
ok(C.consensoDatoDaMaggiorenne("2025-03-09T12:00:00Z", "2007-03-10") === false, "il giorno prima non vale");
ok(C.consensoDatoDaMaggiorenne("2023-03-10T00:00:00Z", "2007-03-10") === false, "un sì a 16 anni non vale nemmeno dopo (non si eredita)");
ok(C.consensoDatoDaMaggiorenne(new Date(), null) === false, "senza data di nascita non vale");
ok(/consensoDatoDaMaggiorenne\(user\.created_at, dataNascita\)/.test(fin), "la registrazione guarda l'età di QUANDO ha risposto, non di adesso");
const iCasellaCondizione = posizione(reg, "{dataNascita && isMaggiorenne(dataNascita) && (");
const iCasella = posizione(reg, "{TESTO_CASELLA_REGISTRAZIONE}");
ok(iCasellaCondizione > 0 && iCasella > iCasellaCondizione, "la casella si mostra solo a una data di nascita maggiorenne", `${iCasellaCondizione} / ${iCasella}`);
ok(/dataNascita && isMaggiorenne\(dataNascita\) \? \{ newsletter \} : \{\}/.test(reg), "a un minorenne la chiave non si scrive (resta «mai chiesto»)");
const bottone = leggi("components/app/IscrivitiNewsletterButton.tsx");
ok(/maggiorenne: boolean;/.test(bottone), "il bottone della newsletter pretende l'età (nessun default)");
ok(posizione(bottone, "if (!maggiorenne) {") > 0 && posizione(bottone, "if (!maggiorenne) {") < posizione(bottone, "async function handleClick()"), "a un minorenne la frase al posto del bottone, prima del clic");
ok(leggi("app/istituzioni/[slug]/page.tsx").includes("maggiorenne={maggiorenne}"), "la pagina dell'ente gliela passa");
const iRamoMinore = posizione(com, "{!maggiorenne ? (");
ok(iRamoMinore > 0 && iRamoMinore < posizione(com, "Sì, voglio riceverle"), "a un minorenne il profilo non fa la domanda");
// Gli attesi dei testi sono scritti a mano: il primo è di Mario, parola per parola.
ok(C.TESTO_SOLO_MAGGIORENNI === "KIREO non invia comunicazioni facoltative a chi ha meno di 18 anni.", "la regola detta come una regola nostra (testo di Mario)", C.TESTO_SOLO_MAGGIORENNI);
for (const t of [C.TESTO_SOLO_MAGGIORENNI, C.TESTO_NEWSLETTER_SOLO_MAGGIORENNI]) {
  ok(!/non puoi/i.test(t) && trovaAccordi(t).length === 0, "nessun «non puoi» e nessun accordo", t);
}
ok(/Non siamo riusciti a toglierti/.test(com) && !/non risult/i.test(com), "un'uscita fallita dice che non è riuscita, mai che non risulti iscritto");
const stat = leggi("app/ente/(dashboard)/statistiche/page.tsx");
ok(/valore: stats\?\.iscritti_newsletter_raggiungibili/.test(stat), "il numero grande dell'ente è chi la riceverà");
ok(/su \$\{stats\?\.iscritti_newsletter \?\? 0\} iscritti/.test(stat), "e accanto quanti si sono iscritti in tutto");

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
