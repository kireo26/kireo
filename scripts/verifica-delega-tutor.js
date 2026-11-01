#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA DELEGA DI UN TUTOR DICE CHE È SALVATA, E LO DICE SOLO SE È VERO (01/11).
// §1 l'esito si decide dalla riga riletta (attesi scritti a mano);
// §2 la frase di conferma;
// §3 il componente rilegge, gira la casella sul valore riletto, e conferma dopo.
// Misurato sulla replica il 01/11: il referente riceve la riga riletta, un tutor
// che scrive la propria delega ne riceve zero, senza errore.
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
const D = require(path.join(ROOT, "lib/scuola/delega.ts"));

console.log("\n§1 — l'esito viene dalla riga riletta\n");
ok(D.esitoDelega([], "puo_gestire_classi", true).esito === "non_toccato", "zero righe: la scrittura non è atterrata (il caso del tutor sulla replica)");
ok(D.esitoDelega(null, "puo_gestire_classi", true).esito === "non_toccato", "nessuna risposta: non toccato, non salvato");
ok(D.esitoDelega([{ puo_gestire_classi: false }], "puo_gestire_classi", true).esito === "diverso", "riletto un valore diverso da quello chiesto: non si dice salvato");
const s = D.esitoDelega([{ puo_gestire_classi: true }], "puo_gestire_classi", true);
ok(s.esito === "salvato" && s.valore === true, "riletto il valore chiesto: salvato");

console.log("\n§2 — la frase\n");
const si = D.testoConfermaDelega("Anna Montefusco", "puo_verificare_studenti", true);
const no = D.testoConfermaDelega("Anna Montefusco", "puo_certificare_presenze", false);
ok(si === "Salvato: ora Anna Montefusco può verificare gli studenti.", "dato: dice a chi e cosa", si);
ok(no === "Salvato: Anna Montefusco non può più certificare le presenze.", "tolto: dice a chi e cosa", no);
ok(D.testoConfermaDelega(null, "puo_gestire_classi", true) === "Salvato: ora il tutor può gestire le classi.", "senza nome: «il tutor»");
const tutte = D.PERMESSI.flatMap((p) => [D.testoConfermaDelega("Anna", p.chiave, true), D.testoConfermaDelega("Anna", p.chiave, false)]);
ok(D.PERMESSI.length === 4 && tutte.every((t) => !t.includes("questo")), "le quattro deleghe hanno ognuna la sua azione");
const accordi = tutte.flatMap((t) => trovaAccordi(t));
ok(accordi.length === 0, "nessuna frase accorda col genere di chi legge", accordi);

console.log("\n§3 — il componente\n");
{
  const c = leggi("components/scuola/TogglePermessiTutor.tsx");
  ok(/\.update\(\{ \[chiave\]: nuovoValore \}\)\s*\.eq\("id", staffId\)\s*\.select\(chiave\)/.test(c), "l'update rilegge la colonna che ha scritto");
  const iEsito = c.search(/esitoDelega\(data, chiave, nuovoValore\)/);
  const iGira = c.search(/setPermessi\(\(prev\) => \(\{ \.\.\.prev, \[chiave\]: esito\.valore \}\)\)/);
  const iConf = c.search(/setConferma\(testoConfermaDelega\(/);
  ok(iEsito >= 0 && iGira > iEsito && iConf > iEsito, "la casella si gira e la conferma si dice solo dopo l'esito", { iEsito, iGira, iConf });
  ok(/if \(esito\.esito !== "salvato"\)[\s\S]{0,200}setErrore\(TESTI_DELEGA\.nonToccato\)[\s\S]{0,40}return;/.test(c), "zero righe è un errore detto, e si ferma lì");
  ok(/role="status"/.test(c), "la conferma la legge anche uno schermo letto ad alta voce");
  const pagina = leggi("app/scuola/(dashboard)/staff/page.tsx");
  ok(/<TogglePermessiTutor[\s\S]{0,120}nome=\{/.test(pagina), "la pagina dello staff passa il nome della persona");
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:delega)`);
process.exit(falliti === 0 ? 0 : 1);
