// KIREO Escape — TRIPWIRE del finale. Principio che governa questo file:
//
//                    IL FINALE RIPORTA, NON AFFERMA.
//
// Il finale (restituzione + le motivazioni di qualità di missione dello scoring)
// non ha letto niente: ha solo dei numeri. Quindi RIPORTA fatti — cosa hai
// scelto, dove è andato il budget, cosa non hai letto. Non AFFERMA stati
// d'animo che non può conoscere («hai capito»), né dà verdetti di qualità
// («scelta lucida»), né dichiara significati («è la risposta più sottile»).
//
// L'unico che può giudicare è il REVISORE AI, perché ha davvero letto la
// proposta dello studente. I suoi prompt sono esentati da questo controllo.
//
// Due forme:
//   FORMA 1 — le frasi COMPOSTE (componiPerformance): lista CHIUSA. Ogni frase
//     composta deve corrispondere a UNA cornice approvata, con le sole variabili
//     sostituite. Una cornice nuova non passa finché non entra nella lista qui.
//   FORMA 2 — le frasi CABLATE (restituzione.ts + le motivazioni qualita_missione
//     di scoring.ts): lint su un LESSICO di parole-verdetto in tre famiglie.
//     Whitelist per STRINGA INTERA (mai per pattern), ognuna con motivo.
//
// Esecuzione: `npm run test:finale` (o `node scripts/verifica-finale-riporta.js`).

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
require.extensions[".ts"] = require.extensions[".tsx"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { componiPerformance } = require("@/lib/escape/componiPerformance");
const { getMissione, stepDellaMissione } = require("@/lib/escape/config");
const { descrittoriPerformancePerTest } = require("@/lib/escape/scoring");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

const SLUGS = [
  "progetto-quartiere", "crisi-mediateca", "guasto-serra", "cantiere-scuola",
  "sportello-insieme", "filiera-borea", "museo-seta", "citta-acqua",
  "palco-programma", "classe-partecipa", "viaggio-impossibile",
];

// ═══════════════════════════════════════════════════════════════════════════
// FORMA 1 — la lista CHIUSA delle cornici approvate di componiPerformance.
// Ogni frase composta dal finale deve corrispondere a UNA di queste. Aggiungere
// una cornice è una decisione editoriale: si aggiunge QUI, con revisione.
// ═══════════════════════════════════════════════════════════════════════════

const CORNICI_APPROVATE = [
  { nome: "appartenenza/buona/piano", re: /^Nel piano hai tenuto .+\.$/ },
  { nome: "appartenenza/buona/budget", re: /^Hai finanziato .+\.$/ },
  { nome: "appartenenza/migliora/tutto", re: /^Hai lasciato fuori quasi tutto\.$/ },
  { nome: "appartenenza/migliora", re: /^Hai lasciato fuori .+\.$/ },
  { nome: "limite/buona/giorni", re: /^Hai usato -?\d[\d.]* giorni su -?\d[\d.]*\.$/ },
  { nome: "limite/buona/soldi", re: /^Hai speso -?\d[\d.]* su -?\d[\d.]*\.$/ },
  { nome: "limite/migliora", re: /^Hai sforato: -?\d[\d.]* su -?\d[\d.]*\.$/ },
  { nome: "soglia/finanziamento", re: /^Per .+ hai messo -?\d[\d.]* su -?\d[\d.]* €\.$/ },
  { nome: "soglia/livello", re: /^Per .+ sei arrivato al -?\d+%\.$/ },
  { nome: "negativo/buona", re: /^Hai evitato .+\.$/ },
  { nome: "negativo/migliora", re: /^Hai scelto .+\.$/ },
  { nome: "dipendenze/buona", re: /^Hai rispettato l'ordine dei lavori\.$/ },
  { nome: "dipendenze/migliora/coppia", re: /^Prima andava .+, poi .+\.$/ },
  { nome: "dipendenze/migliora/fallback", re: /^Hai saltato l'ordine dei lavori\.$/ },
];

// Override di testo del descrittore `negativo` (testoBuona/testoMigliora): frasi
// LIBERE che bypassano le cornici. Sono ammesse solo se dichiarate QUI, come
// stringhe esatte — così un override nuovo non entra senza revisione.
const OVERRIDE_APPROVATI = new Set([
  "Non ti sei preso tutta l'esecuzione da solo.",
  "Ti sei preso tutta l'esecuzione da solo.",
]);

// Divide una frase composta nelle sue clausole (giunte da ". ").
function clausole(testo) {
  const parti = testo.split(". ");
  return parti.map((p, i) => (i === parti.length - 1 ? p : p + "."));
}

function frasePassa(clausola) {
  if (OVERRIDE_APPROVATI.has(clausola)) return "override approvato";
  const c = CORNICI_APPROVATE.find((f) => f.re.test(clausola));
  return c ? c.nome : null;
}

// Genera alcuni piani per una missione, così da esercitare buona/migliora e la
// presenza/assenza delle voci a materiale (soglie, limiti, dipendenze, negativo).
function pianiPerMissione(slug) {
  const m0 = getMissione(slug);
  if (!m0) return [];
  const stepMandato = stepDellaMissione(m0).find((s) => s.id === "s1_mandato");
  const mandatoId = stepMandato?.opzioni?.[0]?.id;
  // Tutti i materiali "letti", così le voci a gate compaiono tutte.
  const lettiTutti = Array.from({ length: 14 }, (_, i) => "M" + (i + 1));
  const base = new Map();
  base.set("s1_mandato", { opzioneId: mandatoId });
  base.set("s1_materiali", { letti: lettiTutti });
  const get1 = (id) => base.get(id);
  const m = getMissione(slug, get1);
  const stepBudget = stepDellaMissione(m).find((s) => s.id === "s3_budget");
  if (!stepBudget) return [];

  const piani = [];
  const conPayload = (payload) => {
    const map = new Map(base);
    map.set("s3_budget", payload);
    return (id) => map.get(id);
  };

  if (stepBudget.tipo === "alloca_budget") {
    const voci = stepBudget.voci;
    const totale = stepBudget.totale;
    // vuoto → migliora; concentrato → sbilanciato; distribuito → pieno.
    piani.push({ etichetta: "vuoto", get: conPayload({ allocazioni: {} }) });
    piani.push({ etichetta: "concentrato", get: conPayload({ allocazioni: { [voci[0].id]: totale } }) });
    const quota = Math.max(1, Math.floor(totale / voci.length));
    const distr = {}; for (const v of voci) distr[v.id] = quota;
    piani.push({ etichetta: "distribuito", get: conPayload({ allocazioni: distr }) });
  } else if (stepBudget.tipo === "pianifica_lavori") {
    const lavori = stepBudget.lavori;
    piani.push({ etichetta: "niente", get: conPayload({ selezionati: [] }) });
    piani.push({ etichetta: "tutti", get: conPayload({ selezionati: lavori.map((l) => l.id) }) });
    piani.push({ etichetta: "metà", get: conPayload({ selezionati: lavori.slice(0, Math.ceil(lavori.length / 2)).map((l) => l.id) }) });
    // Un piano con solo un lavoro dipendente, per far scattare "Prima andava…".
    const dip = lavori.find((l) => (l.richiede ?? []).length > 0);
    if (dip) piani.push({ etichetta: "dip-sola", get: conPayload({ selezionati: [dip.id] }) });
  }
  return piani.map((p) => ({ ...p, mission: getMissione(slug, p.get) }));
}

console.log("═══ FORMA 1 — cornici composte (lista chiusa) ═══\n");

// 1a) Ogni override negativo dichiarato in scoring.ts deve essere approvato qui.
{
  const src = fs.readFileSync(path.join(ROOT, "lib/escape/scoring.ts"), "utf8");
  const sf = ts.createSourceFile("scoring.ts", src, ts.ScriptTarget.Latest, true);
  const overrideTrovati = [];
  const walk = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const nome = node.name.getText(sf);
      if ((nome === "testoBuona" || nome === "testoMigliora") && ts.isStringLiteralLike(node.initializer)) {
        overrideTrovati.push(node.initializer.text);
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  for (const o of overrideTrovati) ok(OVERRIDE_APPROVATI.has(o), `override negativo dichiarato è approvato: «${o}»`);
  if (overrideTrovati.length === 0) console.log("  (nessun override negativo dichiarato nello scoring)");
}

// 1b) Ogni clausola composta, su tutte le missioni e su piani diversi, deve
//     corrispondere a una cornice approvata (o a un override approvato).
{
  let clausoleTot = 0;
  const sconosciute = [];
  for (const slug of SLUGS) {
    for (const piano of pianiPerMissione(slug)) {
      const r = descrittoriPerformancePerTest(piano.mission, piano.get);
      if (!r) continue;
      const testo = componiPerformance(r.valore, r.voci, r.meccanismo);
      if (!testo) continue;
      for (const cl of clausole(testo)) {
        clausoleTot++;
        if (!frasePassa(cl)) sconosciute.push({ slug, piano: piano.etichetta, clausola: cl });
      }
    }
  }
  ok(sconosciute.length === 0, `tutte le ${clausoleTot} clausole composte corrispondono a una cornice approvata`);
  for (const s of sconosciute) console.error(`     ⚠ [${s.slug}/${s.piano}] cornice SCONOSCIUTA: «${s.clausola}»`);
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMA 2 — il lessico delle parole-verdetto sulle frasi CABLATE del finale.
// ═══════════════════════════════════════════════════════════════════════════

// Tre famiglie. La lista è EDITORIALE: si fa crescere con revisione. Le voci con
// `*` matchano il prefisso (lucid*, ottim*, vantart*). "sei accorto" copre sia
// "ti sei accorto" (lessico) sia "te ne sei accorto" (candidato aggiunto).
const LESSICO = {
  "stato-d'animo": [
    /\bhai capito\b/, /\bhai compreso\b/, /\bhai intuito\b/, /\bhai realizzato\b/,
    /\bsei accorto\b/, /\bhai scoperto\b/, /\bsapevi\b/, /\bavevi capito\b/,
    /\bhai imparato\b/, /\bhai riconosciuto\b/,
  ],
  "verdetto-di-qualità": [
    /\blucid\w*/, /\bcon criterio\b/, /\bsottile\b/, /\belegante\b/, /\bmaturo\b/,
    /\bsaggio\b/, /\bcoraggioso\b/, /\bbrillante\b/, /\bnotevole\b/, /\bottim\w*/,
    /\bben fatto\b/, /\befficace\b/,
  ],
  "dichiara-significato": [
    /è la risposta più/, /è uno stile, non/, /questo cambia tutto/,
    /vuol dire che sei/, /sopra le impressioni/, /senza vantart\w*/,
  ],
};

// Whitelist per STRINGA INTERA (mai per pattern). VUOTA per ora, di proposito:
// prima l'elenco completo di cosa il tripwire becca, poi si decide riga per riga
// quali sono fatti (whitelist con motivo) e quali vanno riscritti.
const WHITELIST = new Map([
  // ["<stringa esatta>", "motivo per cui questo fatto è ammesso"],
]);

// Il revisore AI può giudicare perché ha letto: i suoi prompt sono esentati.
// Riconosciuti dalla riga-persona presente in ogni prompt e in nessuna frase del
// finale.
const MARCATORE_REVISORE = "analista di orientamento";

function scanFamiglie(testo) {
  const t = testo.toLowerCase();
  const colpi = [];
  for (const [fam, patterns] of Object.entries(LESSICO)) {
    for (const re of patterns) {
      const m = t.match(re);
      if (m) colpi.push({ famiglia: fam, parola: m[0] });
    }
  }
  return colpi;
}

// Raccoglie le stringhe (letterali + parti dei template) di un file, con la riga.
function stringheDelFile(rel, { esentaRevisore }) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const sf = ts.createSourceFile(path.basename(rel), src, ts.ScriptTarget.Latest, true);
  const out = [];
  const push = (text, pos) => {
    if (!text) return;
    if (esentaRevisore && text.toLowerCase().includes(MARCATORE_REVISORE)) return; // prompt del revisore
    const { line } = sf.getLineAndCharacterOfPosition(pos);
    out.push({ file: rel, line: line + 1, testo: text });
  };
  const walk = (node) => {
    if (ts.isStringLiteralLike(node)) {
      push(node.text, node.getStart(sf));
    } else if (ts.isTemplateExpression(node)) {
      // Head + le parti letterali fra le sostituzioni: le variabili non sono
      // parole-verdetto, solo il testo cablato attorno conta.
      const parti = [node.head, ...node.templateSpans.map((s) => s.literal)];
      // Esenta l'intero template se una sua parte è un prompt del revisore.
      const testoIntero = parti.map((p) => p.text).join(" ");
      if (esentaRevisore && testoIntero.toLowerCase().includes(MARCATORE_REVISORE)) { ts.forEachChild(node, walk); return; }
      for (const p of parti) push(p.text, p.getStart(sf));
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

console.log("\n═══ FORMA 2 — parole-verdetto nelle frasi cablate ═══\n");

const bersagli = [
  ...stringheDelFile("lib/escape/restituzione.ts", { esentaRevisore: false }),
  ...stringheDelFile("lib/escape/scoring.ts", { esentaRevisore: true }),
];

const catturati = [];
for (const b of bersagli) {
  const colpi = scanFamiglie(b.testo);
  if (colpi.length === 0) continue;
  if (WHITELIST.has(b.testo)) continue; // fatto ammesso, con motivo
  catturati.push({ ...b, colpi });
}

// Ordina per file poi riga; stampa l'elenco completo.
catturati.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
if (catturati.length === 0) {
  console.log("  (nessuna cattura — il finale riporta)");
} else {
  console.log(`  ${catturati.length} stringhe catturate:\n`);
  catturati.forEach((c, i) => {
    const parole = c.colpi.map((x) => `${x.famiglia}:«${x.parola}»`).join(", ");
    const testo = c.testo.length > 240 ? c.testo.slice(0, 240) + "…" : c.testo;
    console.error(`  [${i + 1}] ${c.file}:${c.line}  (${parole})\n      ${testo}\n`);
  });
}
ok(catturati.length === 0, `nessuna parola-verdetto fuori whitelist (${catturati.length} catture)`);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════════════");
if (falliti > 0) {
  console.error(`\n✗ TRIPWIRE ROSSO: ${falliti} controlli falliti.\n`);
  process.exit(1);
}
console.log("\n✓ Tripwire verde: il finale riporta, non afferma.\n");
