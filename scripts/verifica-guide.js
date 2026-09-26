// KIREO — verifica di logica pura della sezione Guide. Nessun DB, nessun fs:
// esercita la regola di sblocco (statoSblocco) e la struttura del config.
//
// Copre: L1 sempre sbloccata; le condizioni-azione della L2 (T3, missione,
// status confermata/da_verificare, soglia di backup); le condizioni della L3
// (consolidata + missione); struttura del banco (18 aree × 3, percorsi PDF).
//
// Esecuzione: `npm run test:guide` (o `node scripts/verifica-guide.js`).

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

const { statoSblocco, guideDiArea, TUTTE_LE_GUIDE, SOGLIA_L2_INTEREST, SOGLIA_L3_INTEREST, GUIDE_PRONTE, guidaPronta, percorsoGuidaUno } = require("@/lib/guide/config");
const { AREE } = require("@/data/aree");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// Segnale «vuoto»: area non ancora emersa, niente T3, niente missioni.
const vuoto = { status: null, interestScore: 0, confidence: 0, t3Completato: false, missioniBloccoCompletate: 0 };
const con = (o) => ({ ...vuoto, ...o });

// ── L1 sempre disponibile ─────────────────────────────────────────────────────
console.log("\n1) Guida 1 — sempre disponibile");
ok(statoSblocco(1, vuoto).sbloccata, "L1 sbloccata anche senza alcun segnale");
ok(statoSblocco(1, con({ status: "emergente" })).sbloccata, "L1 sbloccata a prescindere dallo stato");

// ── L2 — l'area «si rafforza» (condizioni-azione) ─────────────────────────────
console.log("\n2) Guida 2 — si sblocca quando l'area si rafforza");
ok(!statoSblocco(2, vuoto).sbloccata, "L2 BLOCCATA con segnale vuoto");
ok(statoSblocco(2, con({ t3Completato: true })).sbloccata, "L2 sbloccata se T3 completato");
ok(statoSblocco(2, con({ missioniBloccoCompletate: 1 })).sbloccata, "L2 sbloccata con ≥1 missione del blocco");
ok(statoSblocco(2, con({ status: "confermata" })).sbloccata, "L2 sbloccata se area confermata");
ok(statoSblocco(2, con({ status: "da_verificare" })).sbloccata, "L2 sbloccata se area da_verificare (segnali forti)");
ok(statoSblocco(2, con({ interestScore: SOGLIA_L2_INTEREST })).sbloccata, `L2 sbloccata alla soglia di backup (${SOGLIA_L2_INTEREST})`);
ok(!statoSblocco(2, con({ status: "emergente", interestScore: SOGLIA_L2_INTEREST - 1 })).sbloccata, "L2 bloccata sotto soglia, area solo emergente");

// ── L3 — l'area «si consolida» ────────────────────────────────────────────────
console.log("\n3) Guida 3 — si sblocca quando l'area è consolidata");
ok(!statoSblocco(3, vuoto).sbloccata, "L3 bloccata con segnale vuoto");
ok(statoSblocco(3, con({ status: "confermata", missioniBloccoCompletate: 1 })).sbloccata, "L3 sbloccata: confermata + missione");
ok(!statoSblocco(3, con({ status: "confermata", missioniBloccoCompletate: 0 })).sbloccata, "L3 BLOCCATA: confermata ma nessuna missione");
ok(statoSblocco(3, con({ status: "da_verificare", confidence: 0.85, missioniBloccoCompletate: 1 })).sbloccata, "L3 sbloccata: da_verificare con confidenza alta + missione");
ok(!statoSblocco(3, con({ status: "da_verificare", confidence: 0.5, missioniBloccoCompletate: 1 })).sbloccata, "L3 bloccata: da_verificare con confidenza bassa");
ok(statoSblocco(3, con({ status: "emergente", interestScore: SOGLIA_L3_INTEREST, missioniBloccoCompletate: 1 })).sbloccata, `L3 sbloccata al backup: interesse ${SOGLIA_L3_INTEREST} + missione`);
ok(!statoSblocco(3, con({ status: "emergente", interestScore: SOGLIA_L3_INTEREST })).sbloccata, "L3 bloccata: interesse alto ma nessuna missione");

// ── Struttura del banco ───────────────────────────────────────────────────────
console.log("\n4) Struttura del config");
ok(TUTTE_LE_GUIDE.length === AREE.length * 3, `${AREE.length} aree × 3 = ${AREE.length * 3} guide (${TUTTE_LE_GUIDE.length})`);
let strutturaOk = true;
for (const a of AREE) {
  const g = guideDiArea(a.slug);
  if (g.length !== 3) strutturaOk = false;
  if (g.map((x) => x.livello).join() !== "1,2,3") strutturaOk = false;
  if (g.some((x) => x.pdf !== `/guide/${a.slug}/${x.livello}.pdf`)) strutturaOk = false;
  if (g.some((x) => !x.titolo || !x.sottotitolo)) strutturaOk = false;
}
ok(strutturaOk, "ogni area: 3 guide (livelli 1/2/3), percorso PDF /guide/<area>/<livello>.pdf, titoli non vuoti");

// ── Disponibilità config-driven (non fs) ──────────────────────────────────────
console.log("\n5) Disponibilità dichiarata da config (GUIDE_PRONTE)");
// guidaPronta riflette esattamente la mappa, per ogni area/livello.
let coerente = true;
for (const a of AREE) for (const liv of [1, 2, 3]) {
  const atteso = (GUIDE_PRONTE[a.slug] ?? []).includes(liv);
  if (guidaPronta(a.slug, liv) !== atteso) coerente = false;
}
ok(coerente, "guidaPronta() coincide con GUIDE_PRONTE per ogni area/livello");
// ── La scelta fra guida vera e segnaposto, in un posto solo ───────────────────
// PERCHÉ È QUI. Fino al 2026-09-26 questa scelta era scritta a mano in TRE
// punti con due meccanismi diversi, e il terzo — il follow-up via email — se
// n'era dimenticato: mandava il segnaposto a chi aveva appena scaricato la
// guida vera dalla pagina. Un PDF che dichiara di non essere ancora scritto,
// spedito all'indirizzo di una persona. Nessun test poteva accorgersene, perché
// quell'email non la riceve mai nessuno di noi.
console.log("\n6) Il percorso della Guida 1: una scelta, un posto solo");

let percorsiOk = true;
let mandanoSegnaposto = [];
for (const a of AREE) {
  const atteso = guidaPronta(a.slug, 1) ? `/guide/${a.slug}/1.pdf` : `/api/guida/${a.slug}`;
  if (percorsoGuidaUno(a.slug) !== atteso) percorsiOk = false;
  // La proprietà che conta: dove la guida vera ESISTE, nessuno può ricevere il
  // segnaposto — né dalla pagina, né dal chip, né dall'email.
  if (guidaPronta(a.slug, 1) && percorsoGuidaUno(a.slug).includes("/api/guida/")) mandanoSegnaposto.push(a.slug);
}
ok(percorsiOk, "percorsoGuidaUno(): guida reale dove dichiarata pronta, segnaposto altrove");
ok(
  mandanoSegnaposto.length === 0,
  mandanoSegnaposto.length === 0
    ? `nessuna delle ${AREE.length} aree manda il segnaposto dove la guida vera esiste`
    : `aree con guida vera che ricevono il segnaposto: ${mandanoSegnaposto.join(", ")}`
);
ok(percorsoGuidaUno("area-che-non-esiste") === "/api/guida/area-che-non-esiste", "uno slug sconosciuto ricade sul segnaposto, non su un file che non c'è");

// E i quattro consumatori la CHIAMANO invece di riscriverla: senza questa
// guardia, il quinto punto che scarica una guida nascerà con la sua copia — che
// è esattamente come è nato il difetto dell'email.
const CONSUMATORI = [
  ["app/api/guida-email/route.ts", "il follow-up via email"],
  ["app/aree/[slug]/page.tsx", "il lead-magnet pubblico"],
  ["components/app/BloccoLeMieAree.tsx", "il chip «Scarica la guida»"],
];
// Il percorso del segnaposto NON si cerca solo a inizio di stringa: la prima
// stesura di questa guardia pretendeva una virgoletta subito prima
// (`/["\'`]\/api\/guida\//`) e sulla controprova è rimasta MUTA — la riga vera
// del difetto era `${SITE_URL}/api/guida/${area.slug}`, dove prima della barra
// c'è una graffa. Ha parlato solo l'altra asserzione, quella sulla chiamata: la
// guardia che conta guardava troppo stretto. *Un verde ottenuto guardando nel
// posto sbagliato non vuol dire niente, e lo si scopre solo provando a
// romperlo.* I commenti si togliono prima, o questo file stesso sarebbe rosso.
function senzaCommenti(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

for (const [file, cosa] of CONSUMATORI) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  ok(/percorsoGuidaUno\s*\(/.test(senzaCommenti(src)), `${cosa} chiama percorsoGuidaUno (${file})`);
  ok(!/\/api\/guida\//.test(senzaCommenti(src)), `${cosa} non nomina il segnaposto in nessuna forma (${file})`);
}
// Il form non decide: riceve. Un ripiego qui sarebbe la quarta copia.
const form = fs.readFileSync(path.join(ROOT, "components/GuidaAreaForm.tsx"), "utf8");
ok(!/\/api\/guida\//.test(senzaCommenti(form)), "GuidaAreaForm non ha nessun ripiego al segnaposto: usa l'url che riceve");

// E la guardia si prova su sé stessa, a ogni giro: due forme sintetiche, quella
// del difetto vero e quella letterale, devono essere tutte e due catturate.
ok(/\/api\/guida\//.test(senzaCommenti('linkGuida = `${SITE_URL}/api/guida/${area.slug}`;')), "la guardia cattura la forma interpolata (quella del difetto vero)");
ok(/\/api\/guida\//.test(senzaCommenti('const url = "/api/guida/" + slug;')), "la guardia cattura anche la forma letterale");
ok(!/\/api\/guida\//.test(senzaCommenti("// il segnaposto di /api/guida/<area> resta il ripiego\nconst x = 1;")), "e non grida su un commento che lo nomina");

console.log("");
if (falliti > 0) { console.error(`✗ ${falliti} verifiche fallite`); process.exit(1); }
console.log("✓ Tutte le verifiche Guide superate.");
