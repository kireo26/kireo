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
// LIMITE DICHIARATO: questo test cattura la FIRMA della malattia, non la verità
// di una frase. Prende il linguaggio che afferma. Una frase falsa scritta in
// linguaggio fattuale passa — e per quelle non esiste un test, esiste solo
// leggerle. Un test che promette più di quanto dà è peggio di uno che dichiara
// i suoi limiti.
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
const { PATTERN_ACCORDO } = require("@/lib/lingua/accordoGenere");
const { LESSICO_VERDETTO } = require("@/lib/lingua/registroStudente");

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
  { nome: "limite/dentro/giorni", re: /^Hai usato -?[\d.]+ giorni su -?[\d.]+\.$/ },
  { nome: "limite/oltre/giorni", re: /^Hai sforato: -?[\d.]+ giorni su -?[\d.]+\.$/ },
  { nome: "limite/dentro/soldi", re: /^Hai speso -?[\d.]+ su -?[\d.]+ \S+\.$/ },
  { nome: "limite/oltre/soldi", re: /^Hai sforato: -?[\d.]+ su -?[\d.]+ \S+\.$/ },
  { nome: "soglia/finanziamento", re: /^Per .+ hai messo -?\d[\d.]* su -?\d[\d.]* €\.$/ },
  { nome: "soglia/livello", re: /^Per .+ sei al -?\d+%\.$/ },
  { nome: "negativo/buona", re: /^Hai evitato .+\.$/ },
  { nome: "negativo/migliora", re: /^Hai scelto .+\.$/ },
  { nome: "dipendenze/buona", re: /^Hai rispettato l'ordine dei lavori\.$/ },
  { nome: "dipendenze/migliora/coppia", re: /^Prima andava .+, poi .+\.$/ },
  { nome: "dipendenze/migliora/fallback", re: /^Hai saltato l'ordine dei lavori\.$/ },
  { nome: "passi", re: /^I tuoi primi passi, in ordine: .+\.$/ },
  { nome: "affidabilita", re: /^Al primo posto hai messo .+\.$/ },
  // scarto: la lista (frasi giunte da «; ») come clausola a sé, poi la clausola
  // sulla trappola — 4 varianti (posizione × inversione), sempre separata.
  { nome: "scarto/lista", re: /^Hai scartato: .+\.$/ },
  { nome: "scarto/trappola/scartata/normale", re: /^Fra queste c'era la scelta che poteva far saltare tutto\.$/ },
  { nome: "scarto/trappola/scartata/invertita", re: /^Fra queste c'era la scelta che, lasciata fuori, poteva far saltare tutto\.$/ },
  { nome: "scarto/trappola/tenuta/normale", re: /^Hai tenuto la scelta che poteva far saltare tutto\.$/ },
  { nome: "scarto/trappola/tenuta/invertita", re: /^Hai tenuto la scelta che, lasciata fuori, avrebbe fatto saltare tutto\.$/ },
];

// Override di testo del descrittore `negativo` (testoBuona/testoMigliora): frasi
// LIBERE che bypassano le cornici. Sono ammesse solo se dichiarate QUI, come
// stringhe esatte — così un override nuovo non entra senza revisione.
const OVERRIDE_APPROVATI = new Set([
  "Non hai preso su di te tutta l'esecuzione.",
  "Hai preso su di te tutta l'esecuzione.",
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

// 1c) Esercizio DIRETTO del compositore su ogni tipo di descrittore, comprese le
//     clausole a fatto singolo (passi/affidabilita) che i piani reali non toccano.
{
  const casi = [
    { v: 0.7, voci: [{ tipo: "appartenenza", label: "la copertura", presente: true, ordine: 0 }], mecc: "piano" },
    { v: 0.7, voci: [{ tipo: "appartenenza", label: "la copertura", presente: true, ordine: 0 }], mecc: "budget" },
    { v: 0.3, voci: [{ tipo: "appartenenza", label: "la copertura", presente: false, ordine: 0 }, { tipo: "appartenenza", label: "il fondo", presente: false, ordine: 1 }], mecc: "budget" },
    { v: 0.3, voci: [{ tipo: "appartenenza", label: "la copertura", presente: true, ordine: 0 }, { tipo: "appartenenza", label: "il fondo", presente: false, ordine: 1 }], mecc: "budget" },
    { v: 0.7, voci: [{ tipo: "limite", usato: 220000, disponibile: 240000, unita: "€" }], mecc: "piano" },
    { v: 0.7, voci: [{ tipo: "limite", usato: 21000, disponibile: 18000, unita: "€" }], mecc: "piano" },
    { v: 0.7, voci: [{ tipo: "limite", usato: 215, disponibile: 110, unita: "cent" }], mecc: "budget" },
    { v: 0.7, voci: [{ tipo: "limite", usato: 77, disponibile: 83, unita: "giorni" }], mecc: "piano" },
    { v: 0.3, voci: [{ tipo: "limite", usato: 90, disponibile: 83, unita: "giorni" }], mecc: "piano" },
    { v: 0.5, voci: [{ tipo: "soglia", label: "la copertura del tetto", stile: "finanziamento", usato: 27000, soglia: 50000 }], mecc: "budget" },
    { v: 0.5, voci: [{ tipo: "soglia", label: "il traguardo del 20%", stile: "livello", usato: 15, soglia: 20 }], mecc: "piano" },
    { v: 0.7, voci: [{ tipo: "negativo", label: "la tariffa d'emergenza", presente: false }], mecc: "budget" },
    { v: 0.3, voci: [{ tipo: "negativo", label: "la tariffa d'emergenza", presente: true }], mecc: "budget" },
    { v: 0.7, voci: [{ tipo: "negativo", label: "x", presente: false, testoBuona: "Non hai preso su di te tutta l'esecuzione." }], mecc: "budget" },
    { v: 0.3, voci: [{ tipo: "negativo", label: "x", presente: true, testoMigliora: "Hai preso su di te tutta l'esecuzione." }], mecc: "budget" },
    { v: 0.7, voci: [{ tipo: "dipendenze", rispettato: true }], mecc: "piano" },
    { v: 0.3, voci: [{ tipo: "dipendenze", rispettato: false, coppiaViolata: { prima: "il controsoffitto", dopo: "la copertura" } }], mecc: "piano" },
    { v: 0.3, voci: [{ tipo: "dipendenze", rispettato: false }], mecc: "piano" },
    { v: 0.5, voci: [{ tipo: "passi", ordine: ["chiedere cosa sa", "scrivere i compiti"] }], mecc: "budget" },
    { v: 0.5, voci: [{ tipo: "affidabilita", primo: "la misura diretta" }], mecc: "budget" },
    // scarto: le 4 cornici (posizione × inversione) + il caso senza trappola.
    { v: 0.7, voci: [{ tipo: "scarto", scartati: ["la facciata", "il piano b"], trappola: "scartata", invertita: false }], mecc: "budget" },
    { v: 0.2, voci: [{ tipo: "scarto", scartati: ["il fondo", "la mostra"], trappola: "tenuta", invertita: false }], mecc: "budget" },
    { v: 0.7, voci: [{ tipo: "scarto", scartati: ["il controsoffitto", "il pvc"], trappola: "tenuta", invertita: true }], mecc: "budget" },
    { v: 0.2, voci: [{ tipo: "scarto", scartati: ["l'accessibilità", "il parquet"], trappola: "scartata", invertita: true }], mecc: "budget" },
    { v: 0.5, voci: [{ tipo: "scarto", scartati: ["la voce a", "la voce b"], trappola: null, invertita: false }], mecc: "budget" },
  ];
  const sconosciute = [];
  for (const c of casi) {
    const testo = componiPerformance(c.v, c.voci, c.mecc);
    if (!testo) continue;
    for (const cl of clausole(testo)) if (!frasePassa(cl)) sconosciute.push(cl);
  }
  ok(sconosciute.length === 0, `il compositore, su ogni tipo di descrittore, produce solo cornici approvate`);
  for (const s of sconosciute) console.error(`     ⚠ cornice SCONOSCIUTA: «${s}»`);
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMA 2 — il lessico delle parole-verdetto sulle frasi CABLATE del finale.
// ═══════════════════════════════════════════════════════════════════════════

// Tre famiglie. La lista è EDITORIALE: si fa crescere con revisione. Le voci con
// `*` matchano il prefisso (lucid*, ottim*, vantart*). "sei accorto" NON è nel
// lessico di proposito: raccontare QUANDO un fatto è affiorato è legittimo e
// succederà ancora — la linea vieta di affermare cosa lo studente ha capito o
// quanto è stato bravo, non di dire quando un fatto gli è arrivato davanti.
const LESSICO = {
  // Le famiglie del verdetto vivono in lib/lingua/registroStudente.ts, da dove
  // le legge anche la guardia sulle risposte dei revisori: il testo cablato e
  // quello generato rispondono alla stessa linea, e due liste in due file
  // divergerebbero. Il perché di ogni voce (e il perché di ciò che NON c'è, tipo
  // «sei accorto») sta accanto alla lista, non qui.
  ...LESSICO_VERDETTO,
  // Terza famiglia: le forme che CONCORDANO col genere di chi legge. La
  // definizione dei pattern (e il perché di ognuno) sta in un posto solo,
  // lib/lingua/accordoGenere.ts, condiviso con la regola scritta nei prompt e
  // con la guardia che rilegge le risposte dei revisori.
  "accordo-di-genere": PATTERN_ACCORDO,
};

// Whitelist per STRINGA INTERA (mai per pattern), ognuna con la RAGIONE (non la
// firma di chi l'ha approvata: fra sei mesi serve la ragione, non la firma). La
// linea: «l'avevi letto» è possesso d'informazione, non comprensione, e cita la
// prova; «due erano ottime» giudica le OPZIONI della missione, che la missione
// definisce, non lo studente.
const WHITELIST = new Map([
  ["Sapevi dei costi di gestione dal terzo anno — l'avevi letto — ma non hai lasciato nulla da parte per coprirli. È il tipo di dettaglio che decide se un progetto regge nel tempo.",
    "«l'avevi letto» è possesso d'informazione (M7 letto), non comprensione, e cita la prova"],
  ["Sapevi che una variante in corso d'opera costa venti giorni d'istruttoria, ma non hai lasciato un fondo imprevisti: se qualcosa fosse cambiato, non avevi margine.",
    "«sapevi» sostenuto da M11 letto: informazione che aveva davanti, non stato mentale"],
  ["Sapevi del 2019, ma non hai lasciato un minuto per spiegare al pubblico cosa stava succedendo: è esattamente quello che due anni fa fece arrabbiare la gente.",
    "«sapevi» sostenuto da M12 letto: informazione che aveva davanti, non stato mentale"],
  ["Sapevi, dal dettaglio sugli edifici pubblici, che scuole vuote, piscina chiusa e fontane accese sprecavano un 5% a costo zero e senza colpire nessuno — e non l'hai messo nel pacchetto.",
    "«sapevi, dal dettaglio» sostenuto da M8 letto: cita la fonte, non la testa"],
  ["Il tuo piano contava su tre operatori. Dalle 11 in poi ne restavano due, e una non poteva gestire un colloquio da sola.",
    "«da sola» è l'operatrice del turno, non lo studente: qui l'accordo è corretto"],
  ["I dati che hai aperto dicevano che il fabbisogno agricolo è concentrato a luglio e che dopo il 20 agosto crolla da solo dell'80%. Tagliare l'acqua all'agricoltura a metà agosto sarebbe stato un sacrificio grosso per un risparmio quasi nullo.",
    "«da solo» è il fabbisogno idrico, non lo studente"],
  ["Undici idee in tre settimane, tutte accolte con «bella idea» e nessuna scelta. Due erano ottime. Non serviva frenare nessuno: serviva che qualcuno decidesse.",
    "«ottime» giudica le idee del gruppo (opzioni che la missione definisce), non lo studente"],
]);

// Whitelist della sola famiglia accordo-di-genere: stesse regole (stringa intera,
// ragione accanto), tenuta separata perché le ragioni sono di natura diversa —
// lì il fatto è ammesso, qui l'accordo è corretto o la frase non arriva mai allo
// studente. Le due mappe sono unite subito sotto: il resto del test ne vede una.
const WHITELIST_GENERE = new Map([
  [" c'è un segnale interessante: la fiducia che avevi prima di scrivere e come te la sei cavata davvero non vanno nella stessa direzione. Vale la pena controllare se ti succede spesso — a volte ci si sottovaluta.",
    "«te la sei cavata» concorda con il pronome «la» (la cosa), non con chi legge: invariante per costruzione"],
  ["Hai messo la persona giusta al posto giusto, con criterio.",
    "motivazione di STILE (argomento posizionale di pushAssi): alimenta style_signal, mai letta dal finale — page.tsx mostra solo categoria='area' e qualita_missione"],
]);
for (const [k, v] of WHITELIST_GENERE) WHITELIST.set(k, v);

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

// Raccoglie TUTTE le stringhe (letterali + parti dei template) con la riga, e
// toglie solo i prompt quando `escludiPrompt`.
//
// Una versione precedente filtrava sulle sole `motivazione:` — e proprio per
// questo non vedeva `testoBuona`/`testoMigliora`, `esploraTesti` e le stringhe
// di `pushAssi`: il rilevatore non trovava il caso che l'aveva fatto scrivere.
// Da qui la regola: si scansiona tutto, e ciò che non arriva allo studente si
// dichiara in whitelist con la sua ragione (dove resta leggibile) invece di
// sparire dentro un filtro (dove nessuno la ritrova).
function stringheDelFile(rel, { escludiPrompt }) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const sf = ts.createSourceFile(path.basename(rel), src, ts.ScriptTarget.Latest, true);
  const out = [];
  const raccogli = (node) => {
    if (ts.isStringLiteralLike(node)) {
      if (node.text) out.push({ file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, testo: node.text });
    } else if (ts.isTemplateExpression(node)) {
      for (const p of [node.head, ...node.templateSpans.map((s) => s.literal)]) {
        if (p.text) out.push({ file: rel, line: sf.getLineAndCharacterOfPosition(p.getStart(sf)).line + 1, testo: p.text });
      }
    }
    ts.forEachChild(node, raccogli);
  };
  raccogli(sf);
  // I PROMPT dei revisori sono istruzioni al modello, non testo mostrato: il
  // revisore giudica perché ha letto, il finale riporta perché ha solo numeri.
  // Riconosciuti dalla riga-persona / dall'istruzione di formato, presenti in
  // ogni prompt e in nessuna frase del finale.
  return escludiPrompt ? out.filter((r) => !/analista di orientamento|Rispondi SOLO|Sei un tutor/i.test(r.testo)) : out;
}

console.log("\n═══ FORMA 2 — parole-verdetto nelle frasi cablate ═══\n");

const bersagli = [
  ...stringheDelFile("lib/escape/restituzione.ts", { escludiPrompt: false }),
  ...stringheDelFile("lib/escape/scoring.ts", { escludiPrompt: true }),
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

// La whitelist è essa stessa una seconda fonte di verità: se una frase viene
// riscritta e la sua voce resta qui, la voce non protegge più niente ma continua
// a sembrare una decisione presa. Quindi ogni voce deve corrispondere a una
// stringa ancora presente nel codice — altrimenti il test fallisce nominandola.
const testiPresenti = new Set(bersagli.map((b) => b.testo));
const orfane = [...WHITELIST.keys()].filter((k) => !testiPresenti.has(k));
if (orfane.length) {
  console.error(`\n  ${orfane.length} voci di whitelist ORFANE (la frase non esiste più nel codice):\n`);
  orfane.forEach((o, i) => console.error(`  [${i + 1}] ${o.slice(0, 160)}${o.length > 160 ? "…" : ""}\n`));
}
ok(orfane.length === 0, `nessuna voce di whitelist orfana (${orfane.length} orfane)`);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════════════");
if (falliti > 0) {
  console.error(`\n✗ TRIPWIRE ROSSO: ${falliti} controlli falliti.\n`);
  process.exit(1);
}
console.log("\n✓ Tripwire verde: il finale riporta, non afferma.\n");
