#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// «IN PRESENZA» E «A DISTANZA» DICEVANO IL CONTRARIO DI QUELLO CHE SUCCEDE
// (Mario, 01/11). Tutti gli incontri sono online: i due modi di iscrivere una
// classe si distinguono per chi misura la presenza. Qui si sorveglia che:
// §1 le etichette e la riga sotto la scelta siano quelle (attesi scritti a mano);
// §2 il modulo le legga da lib/scuola/modalitaIscrizione.ts e mostri la riga che
//    cambia con l'opzione;
// §3 nessuna superficie della scuola, dello studente o dell'ente dica ancora le
//    parole vecchie per un'iscrizione (i valori `individuale`/`dad` restano nel
//    database, e non si guardano).
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

const M = require(path.join(ROOT, "lib/scuola/modalitaIscrizione.ts"));

console.log("\n§1 — le parole, contro gli attesi scritti a mano\n");
ok(JSON.stringify(M.MODALITA_ISCRIZIONE) === JSON.stringify(["individuale", "dad"]), "le due modalità sono i due valori del database, in quest'ordine");
ok(M.ETICHETTA_MODALITA.individuale === "Ognuno dal proprio account", "individuale → «Ognuno dal proprio account»", M.ETICHETTA_MODALITA.individuale);
ok(M.ETICHETTA_MODALITA.dad === "Un collegamento solo per la classe", "dad → «Un collegamento solo per la classe»", M.ETICHETTA_MODALITA.dad);
ok(M.CHI_MISURA_LA_PRESENZA.individuale === "La presenza la misura KIREO, dal tempo di collegamento di ciascuno.", "la riga sotto «ognuno dal proprio account» dice che misura KIREO");
ok(M.CHI_MISURA_LA_PRESENZA.dad === "La presenza la certifichi tu dopo l'incontro, dal registro presenze.", "la riga sotto «un collegamento solo» dice che certifica la scuola");

console.log("\n§2 — il modulo legge da lì, e la riga segue l'opzione\n");
{
  const f = leggi("components/scuola/IscriviClasseEventoForm.tsx");
  ok(/ETICHETTA_MODALITA\[m\]/.test(f) && /MODALITA_ISCRIZIONE\.map/.test(f), "le opzioni nascono dall'elenco, non sono scritte nel componente");
  ok(/CHI_MISURA_LA_PRESENZA\[modalita\]/.test(f), "la riga sotto la scelta è quella della modalità scelta");
  ok(/p_modalita: modalita/.test(f), "alla funzione va il valore del database, non l'etichetta");
}

console.log("\n§3 — le parole vecchie non dicono più un'iscrizione\n");
{
  const file = ["app", "lib", "components"].flatMap(fileSorgenti);
  ok(file.length > 300, `letti i sorgenti (${file.length}, pavimento 300)`);
  const vietate = /In presenza \(individuale\)|A distanza \(gruppo\)|come gruppo, a distanza/;
  const colpevoli = file.filter((f) => vietate.test(leggi(f)));
  ok(colpevoli.length === 0, "nessun file dice «In presenza (individuale)», «A distanza (gruppo)» o «come gruppo, a distanza»", colpevoli);
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:modalita)`);
process.exit(falliti === 0 ? 0 : 1);
