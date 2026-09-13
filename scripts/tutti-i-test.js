// Tutte le suite, in fila. `npm test`.
//
// PERCHÉ ESISTE. Le suite sono ventitré e si lanciavano a mano, una per una,
// scegliendo quelle «collegate» alla modifica. Il 13/09 quel criterio ha
// mancato `test:prova`: la modifica precedente aveva aggiunto un file che
// nomina `workshop_fasi_stato` in una regex, e il controllo delle misure
// depurate l'ha letto come una misura. È rimasta rossa per un'unità intera,
// perché nessuno che la riguardasse era nella lista che avevo scelto io.
//
// Il difetto non è la suite mancata: è il CRITERIO. «Quali suite riguardano
// questa modifica» è una domanda a cui si risponde con quello che si ha in
// mente, e quello che si ha in mente è esattamente ciò che la modifica ha
// cambiato — mai gli effetti che non si erano previsti, che sono gli unici per
// cui i test esistono.
//
// L'elenco si LEGGE da package.json invece di essere scritto qui: una suite
// nuova entra da sola. Una lista da aggiornare a mano avrebbe lo stesso
// difetto di quella che si teneva in testa, solo scritta.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { spawnSync } = require("child_process");
const path = require("path");

const pkg = require(path.join(__dirname, "..", "package.json"));
const suite = Object.keys(pkg.scripts ?? {})
  .filter((k) => k.startsWith("test:"))
  .sort();

if (suite.length === 0) {
  console.error("Nessuno script `test:*` in package.json: non c'è niente da lanciare, e non è una buona notizia.");
  process.exit(1);
}

console.log(`\n═══ ${suite.length} suite ═══\n`);

const falliti = [];
for (const s of suite) {
  const nome = s.slice(5);
  process.stdout.write(`  ${nome.padEnd(14)}`);
  const t = Date.now();
  // L'output completo si vede rilanciando la singola suite: qui serve sapere
  // QUALI sono rosse, e un muro di righe verdi nasconde le due che contano.
  const r = spawnSync("npm", ["run", s], { encoding: "utf8" });
  const secondi = ((Date.now() - t) / 1000).toFixed(1);
  if (r.status === 0) {
    console.log(`✓  ${secondi}s`);
  } else {
    console.log(`✗  ${secondi}s`);
    falliti.push({ nome, s, uscita: [r.stdout, r.stderr].filter(Boolean).join("\n") });
  }
}

console.log("");
if (falliti.length === 0) {
  console.log("✓ Tutte verdi.\n");
  process.exit(0);
}

for (const f of falliti) {
  console.error(`\n─── ${f.nome} ───`);
  // Le ultime righe: i nostri script mettono in fondo il conto dei falliti e il
  // perché. Chi vuole tutto rilancia `npm run ${f.s}`.
  console.error(f.uscita.split("\n").slice(-25).join("\n"));
  console.error(`(tutto l'output: npm run ${f.s})`);
}
// «1 suite rosse» si legge come una svista, e una svista nella riga di
// riepilogo fa dubitare del riepilogo — stessa cura già fatta sull'appello.
const rosse = falliti.length === 1 ? "1 suite rossa" : `${falliti.length} suite rosse`;
console.error(`\n✗ ${rosse} su ${suite.length}: ${falliti.map((f) => f.nome).join(", ")}\n`);
process.exit(1);
