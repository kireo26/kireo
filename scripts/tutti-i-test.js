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

const fs = require("fs");
const RADICE = path.join(__dirname, "..");
const pkg = require(path.join(RADICE, "package.json"));
const suite = Object.keys(pkg.scripts ?? {})
  .filter((k) => k.startsWith("test:"))
  .sort();

if (suite.length === 0) {
  console.error("Nessuno script `test:*` in package.json: non c'è niente da lanciare, e non è una buona notizia.");
  process.exit(1);
}

// ═══ PRIMA DI LANCIARE: che l'ELENCO sia quello che sembra ═══════════════════
//
// ⚠️ IL 5/10 UNA SUITE È SPARITA E L'HA DETTO UN AVVISO DELL'EDITOR, NON UN
// CONTROLLO. Scrivendo un test nuovo ho dato a un file un nome che era già
// preso (`scripts/verifica-attivita.js`, il test del 29/09 sui tipi di
// attività) e l'ho sovrascritto: 23 asserzioni cancellate, e `npm test` è
// rimasto verde perché la chiave `test:attivita` puntava ancora a un file
// esistente — un altro file. Nello stesso gesto `package.json` ha preso una
// chiave DOPPIA (`test:studente` due volte): in JSON vince l'ultima, quindi
// una suite era già pronta a sparire in silenzio al prossimo giro.
//
// Le tre domande qui sotto costano niente e falliscono rumorose. Nessuna
// avrebbe impedito la sovrascrittura — a quella il segnale era «updated»
// invece di «created» — ma la (a) e la (b) avrebbero preso l'ELENCO rotto, e
// la (c) prende il caso peggiore dei tre: un file che esiste, è verde quando lo
// si lancia, e non lo lancia nessuno.
{
  const problemi = [];

  // (a) CHIAVI DOPPIE: `require` le collassa, quindi si guarda il testo grezzo.
  const grezzo = fs.readFileSync(path.join(RADICE, "package.json"), "utf8");
  const viste = new Map();
  for (const m of grezzo.matchAll(/"(test:[\w:-]+)"\s*:/g)) viste.set(m[1], (viste.get(m[1]) ?? 0) + 1);
  for (const [k, n] of viste) {
    if (n > 1) problemi.push(`la chiave "${k}" compare ${n} volte: in JSON vince l'ultima, e l'altra suite non gira più`);
  }

  // (b) DUE CHIAVI SULLO STESSO FILE: una delle due è un residuo, e se qualcuno
  // la cancella credendo di togliere un doppione porta via una suite.
  const perFile = new Map();
  for (const k of suite) {
    const f = (pkg.scripts[k].match(/scripts\/[\w.-]+\.js/) ?? [])[0];
    if (!f) continue;
    perFile.set(f, [...(perFile.get(f) ?? []), k]);
  }
  for (const [f, chiavi] of perFile) {
    if (chiavi.length > 1) problemi.push(`${f} è lanciato da ${chiavi.length} chiavi (${chiavi.join(", ")}): una è un residuo`);
  }

  // (c) UN `verifica-*.js` CHE NESSUNO LANCIA. È il caso peggiore: il file c'è,
  // è verde quando lo si lancia a mano, e non gira mai. Un test che nessuno
  // esegue è peggio di un test che non c'è, perché sembra una copertura.
  const lanciati = new Set([...perFile.keys()]);
  const orfani = fs
    .readdirSync(path.join(RADICE, "scripts"))
    .filter((n) => /^verifica-.*\.js$/.test(n))
    .filter((n) => !lanciati.has(`scripts/${n}`));
  for (const o of orfani) problemi.push(`scripts/${o} non è lanciato da nessuno script npm`);

  if (problemi.length > 0) {
    console.error("\n✗ L'elenco delle suite non è quello che sembra:\n");
    for (const p of problemi) console.error(`  • ${p}`);
    console.error("");
    process.exit(1);
  }
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
