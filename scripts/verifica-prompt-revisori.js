// Verifica che i DUE revisori del workshop dicano le stesse regole.
//
// Perché esiste. La revisione di tappa e il feedback finale sono due prompt
// diversi con due output diversi, ma le regole di condotta sono le stesse — e
// per un po' sono state scritte due volte. Sono divergute il giorno stesso in
// cui la seconda regola è stata aggiunta: il blocco «come si verifica» è
// entrato solo nella revisione di tappa, e il feedback finale — l'unico che
// legge tutte e quattro le tappe insieme — ha rimesso fra i punti di forza
// esattamente il paragrafo per cui quel blocco era nato.
//
// Adesso i due prompt chiamano le stesse funzioni, quindi la divergenza è
// strutturalmente impossibile per quei blocchi. Questo test difende dal gesto
// successivo: qualcuno che, per aggiungere una riga a uno solo dei due, torna
// a scrivere il testo a mano dentro la funzione.
//
// Esecuzione: `npm run test:prompt`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { promptRevisore, promptFeedbackFinale } = require("@/lib/workshop/prompt-revisore");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

const CTX = {
  workshopTitolo: "Apri una palestra popolare",
  ruoloTitolo: "Responsabile attività e benessere",
  tappaTitolo: "Tappa 3 — La sicurezza, sul serio",
  tappaObiettivo: "Rendi la palestra sicura e a norma.",
  clienteNome: "Tonino",
  clienteVincoli: "budget di 30.000 €, i minori non pagano",
  revisioneFocus: ["Ci sono defibrillatore e personale formato BLSD?"],
  fiduciaMax: 25,
  sezioni: [{ id: "checklist_sicurezza", titolo: "La sicurezza — spunta ciò che prevedi" }],
  prossimaTappa: { titolo: "Tappa 4 — Il pitch", obiettivo: "Metti tutto insieme." },
};

// Una frase per blocco condiviso: se qualcuno riscrive il testo a mano in uno
// dei due, la frase esatta non sopravvive alla riscrittura.
const CONDIVISE = [
  ["la casella è un'intenzione, non una prova", "Una casella spuntata è un'intenzione dichiarata"],
  ["non elogiare l'ordine senza il caso peggiore", "non elogiare l'ordine o la completezza di un ragionamento"],
  ["due forme insieme, strutturato e prosa", "campi strutturati (caselle spuntate, righe di tabella, opzioni scelte)"],
  ["niente conclusioni sul budget", "NON dichiarare mai che il budget o un vincolo economico"],
  ["nemmeno in forma interrogativa", "è lo stesso errore, solo in forma interrogativa"],
  ["l'onestà epistemica vale più dei buchi riempiti", "le sorprese il cliente le scopre dopo, e le paga"],
  ["lo studente non è il cliente", "Lo studente NON è Tonino"],
  ["nessun dato inventato", "Non inventare dati che lo studente non ha scritto"],
];

console.log("\n═══ I due revisori dicono le stesse regole ═══\n");

const tappa = promptRevisore(CTX);
const finale = promptFeedbackFinale(CTX, 71);

for (const [nome, frase] of CONDIVISE) {
  const inTappa = tappa.includes(frase);
  const inFinale = finale.includes(frase);
  ok(inTappa && inFinale, `${nome} — revisione di tappa: ${inTappa ? "sì" : "NO"}, feedback finale: ${inFinale ? "sì" : "NO"}`);
}

// Le differenze legittime: ciascuno ha qualcosa che l'altro non deve avere.
ok(tappa.includes("IL PASSO SUCCESSIVO") && !finale.includes("IL PASSO SUCCESSIVO"), "il passo successivo riguarda solo la revisione di tappa");
ok(finale.includes("TUTTE le tappe insieme") && !tappa.includes("TUTTE le tappe insieme"), "solo il feedback finale legge tutte le tappe insieme");
ok(finale.includes("SOLO le parole di Tonino"), "la chiusura del cliente contiene solo le sue parole, senza annunciare chi parla");

// Il ramo dell'ultima tappa, che senza contesto il revisore si inventava.
const ultima = promptRevisore({ ...CTX, prossimaTappa: null });
ok(ultima.includes("IL PASSO SUCCESSIVO NON C'È"), "sull'ultima tappa è detto esplicitamente che un passo successivo non c'è");

// Nessun esempio copiabile: una frase compiuta dentro il prompt viene
// ricopiata, non imitata — e nel ricopiarla si rompe.
ok(!tappa.includes("puoi colmarlo tornando su"), "nel prompt non è tornato un esempio di frase da riusare");
ok(!tappa.includes("corso donne di sera"), "nel prompt non è tornato un fatto di un workshop solo");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Le regole comuni stanno in un posto solo, e arrivano a tutti e due.\n");
