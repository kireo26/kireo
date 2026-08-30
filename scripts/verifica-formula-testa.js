// La formula sulla testa, tolta in codice: la trasformazione e i suoi confini.
//
// PERCHÉ CONTA PIÙ DEGLI ALTRI CONTROLLI. Questa è la prima volta che il
// codice RISCRIVE un testo destinato a uno studente: fin qui poteva rifiutarlo
// (la guardia, il validatore), non modificarlo. Quindi la metà importante di
// questi controlli non è «riscrive bene», è **NON riscrive dove non deve**: una
// regex troppo larga qui non produce un allarme, produce una frase storta
// dentro il feedback di un ragazzo.
//
// Esecuzione: `npm run test:formula`.

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

const { togliFormulaTesta } = require("@/lib/lingua/formulaTesta");
const { mappaStringheInJson } = require("@/lib/lingua/scansione");
const { trovaRegistro } = require("@/lib/lingua/registroStudente");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };
const uguale = (dato, atteso, msg) => ok(dato === atteso, `${msg}${dato === atteso ? "" : `\n      atteso: ${JSON.stringify(atteso)}\n      ossia:  ${JSON.stringify(dato)}`}`);

console.log("\n═══ «Hai capito che X» → «X» ═══\n");

const t = (s) => togliFormulaTesta(s).testo;

// ── quello che deve fare ───────────────────────────────────────────────────
uguale(t("Hai capito che il margine non è uno spreco."), "Il margine non è uno spreco.", "a inizio frase la maiuscola si sposta sulla subordinata");
uguale(t("La tabella regge, e hai capito che la ZTL è il discrimine."), "La tabella regge, e la ZTL è il discrimine.", "a metà frase resta tutto minuscolo");
uguale(t("Hai riconosciuto che il defibrillatore serve."), "Il defibrillatore serve.", "vale per tutti i verbi mentali, non solo «capito»");
uguale(t("Hai subito capito che il costo era alto."), "Il costo era alto.", "un avverbio in mezzo non la nasconde");
uguale(t("HAI CAPITO CHE il costo era alto."), "Il costo era alto.", "e nemmeno le maiuscole");
uguale(
  t("Hai riconosciuto che il rischio c'è. Hai capito che serve il BLSD."),
  "Il rischio c'è. Serve il BLSD.",
  "due occorrenze nella stessa stringa si tolgono tutte e due, ognuna con la sua maiuscola",
);
uguale(t("Un punto: hai capito che serve il BLSD."), "Un punto: Serve il BLSD.", "dopo i due punti la subordinata apre una frase nuova");

// ── quello che NON deve fare, che è la metà che conta ──────────────────────
const intatti = [
  ["Hai capito quanto conta il margine.", "senza «che» la frase resterebbe un frammento: non si tocca"],
  ["Questo è maturo.", "un giudizio vero non è una formula: resta, e resta visibile alla misura"],
  ["Il contratto di manutenzione è saggio.", "idem per «saggio»"],
  ["Hai messo la ZTL al centro del confronto.", "un verbo d'azione non è un verbo mentale"],
  ["Hai scelto che cosa lasciare fuori.", "«hai scelto che» non è un'attribuzione di comprensione"],
  ["La tabella dice che il margine tiene.", "il soggetto è già la pagina: niente da spostare"],
  ["Hai capitolato che significa?", "«capitolato» non è «capito»: il confine di parola tiene"],
  ["Ha capito che serviva.", "terza persona: non è la formula rivolta a chi legge (e il registro la conta a parte)"],
];
for (const [testo, perche] of intatti) uguale(t(testo), testo, perche);

// ── proprietà ──────────────────────────────────────────────────────────────
const doppio = t(t("Hai capito che il margine non è uno spreco."));
uguale(doppio, "Il margine non è uno spreco.", "applicarla due volte dà lo stesso risultato: è idempotente");

const e = togliFormulaTesta("Hai capito che serve. Hai capito quanto serve.");
ok(e.riscritte === 1 && e.residue === 1, `conta a parte quello che copre (${e.riscritte}) e quello che resta scoperto (${e.residue})`);
uguale(togliFormulaTesta("").testo, "", "una stringa vuota resta vuota");
uguale(togliFormulaTesta(null).testo, "", "e un valore assente non fa esplodere niente");

// ── il testo riscritto non contiene più la formula, per la misura ──────────
const primaDopo = "Hai capito che il margine non è uno spreco.";
ok(trovaRegistro(primaDopo).length > 0, "la misura del registro vede la formula nel testo di partenza");
ok(trovaRegistro(t(primaDopo)).length === 0, "…e non la vede più in quello riscritto: è la prova che la trasformazione è quella giusta");

// ── dentro un JSON: si toccano i valori, mai le chiavi ─────────────────────
const risposta = {
  cosa_regge: ["Hai capito che il margine non è uno spreco.", "La tabella tiene."],
  annidato: { commento: "Hai riconosciuto che serve il BLSD.", punteggio: 18 },
  hai_capito_che: "questa è una CHIAVE e non si tocca",
};
const pulita = mappaStringheInJson(risposta, (s) => t(s));
uguale(pulita.cosa_regge[0], "Il margine non è uno spreco.", "riscrive dentro gli array");
uguale(pulita.cosa_regge[1], "La tabella tiene.", "e lascia stare quello che non la contiene");
uguale(pulita.annidato.commento, "Serve il BLSD.", "scende negli oggetti annidati");
ok(pulita.annidato.punteggio === 18, "i numeri non diventano stringhe per strada");
ok(Object.keys(pulita).includes("hai_capito_che"), "le CHIAVI non si toccano: sono nomi di campo, non lingua");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Toglie la formula dove la trasformazione è esatta, e non tocca niente altro.\n");
