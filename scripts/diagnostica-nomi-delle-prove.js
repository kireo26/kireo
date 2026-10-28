// Legge le righe «SONDA|…» stampate da scripts/diagnostica-nomi-delle-prove.sql e
// confronta il SOGGETTO del titolo di ogni prova («l'ente …», «uno studente …»,
// «anon …») con le identità che il database ha visto agire. Il quattordicesimo
// modo: una prova che si chiama come uno scenario che non esegue.
//
// Tre esiti per prova: concorda, ✗ un'altra identità, · nessuna sessione vista.
// Le ultime due SI LEGGONO: la sonda è cieca sui rifiuti per privilegio e
// attribuisce male gli script che scrivono gli esiti in fondo (vedi la testa del
// .sql). Il 28/10, su 74 titoli col soggetto: 1 disaccordo vero
// (verifica-scuola-dichiarata §10), 5 attribuiti male, 22 cieche concordi alla
// lettura. Non è una guardia per questa ragione: sbaglia anche su codice giusto.
const fs = require("fs");
const righe = fs.readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean);
const ART = "(?:l'|lo |la |il |un |uno |una |un altro |un'altra |gli |i |le )?";
const SOGGETTI = [
  ["istituzione", new RegExp("^" + ART + "(?:ente|organizzatore|istituzione)\\b", "i")],
  ["studente", new RegExp("^" + ART + "studente\\b", "i")],
  ["referente_scuola", new RegExp("^" + ART + "referente\\b", "i")],
  ["tutor_scuola", new RegExp("^" + ART + "tutor\\b", "i")],
  ["admin", new RegExp("^" + ART + "admin\\b(?! ·)", "i")], // «admin · …» nomina una route, non chi agisce
  ["docente", new RegExp("^" + ART + "docente\\b", "i")],
  ["@anon", /^anon\b/i],
];
let col = 0, contro = 0, ciechi = 0;
for (const r of righe) {
  const [testa, n, titolo, visti, alla] = r.split("|");
  const file = testa.replace(/SONDA$/, "");
  const sogg = SOGGETTI.find(([, re]) => re.test(titolo.trim()));
  if (!sogg) continue;
  col++;
  const ruoli = new Set();
  for (const v of `${visti || ""} ${alla || ""}`.trim().split(/\s+/).filter(Boolean)) {
    const [cu, ru] = v.split(":");
    if (cu === "anon") ruoli.add("@anon");
    if (ru && ru !== "-") ruoli.add(ru);
  }
  if (!ruoli.size) { ciechi++; console.log(`· ${file} §${n} «${titolo}» → nessuna sessione vista`); continue; }
  if (!ruoli.has(sogg[0])) { contro++; console.log(`✗ ${file} §${n} «${titolo}» → il database ha visto: ${[...ruoli].join(", ")}`); }
}
console.log(`\n${righe.length} esiti letti; ${col} titoli nominano chi agisce; ${contro} con un'altra identità; ${ciechi} senza sessione vista.`);
if (righe.length < 300) console.log("⚠️ Meno di 300 esiti letti: la sonda non si è agganciata a tutti gli script, e il conto qui sopra non vale.");
