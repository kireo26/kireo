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

const { statoSblocco, guideDiArea, TUTTE_LE_GUIDE, SOGLIA_L2_INTEREST, SOGLIA_L3_INTEREST, GUIDE_PRONTE, guidaPronta, percorsoGuidaUno, GATE_GUIDE_ATTIVO } = require("@/lib/guide/config");
const { AREE } = require("@/data/aree");
const { avvisoRifiuto } = require("@/lib/guide/avvisoRifiuto");
const { TESTO_SBLOCCO_GUIDE } = require("@/lib/guide/config");
const { passiPagina } = require("@/lib/guide/passiPagina");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// Segnale «vuoto»: area non ancora emersa, niente T3, niente missioni, nessuna
// guida ancora aperta.
const vuoto = { status: null, interestScore: 0, confidence: 0, t3Completato: false, missioniBloccoCompletate: 0, giaAperte: [] };
const con = (o) => ({ ...vuoto, ...o });
// Dal 2026-09-26 la SEQUENZA sta prima delle condizioni di merito, quindi per
// provare il merito bisogna prima soddisfarla: questi due helper lo fanno. Le
// asserzioni dei blocchi 2 e 3 sono le stesse di prima — se un giorno la
// sequenza cadesse, resterebbero a dire cosa il merito deve fare.
const meritoL2 = (o) => con({ giaAperte: [1], ...o });
const meritoL3 = (o) => con({ giaAperte: [1, 2], ...o });

// ── L1 sempre disponibile ─────────────────────────────────────────────────────
console.log("\n1) Guida 1 — sempre disponibile");
ok(statoSblocco(1, vuoto).sbloccata, "L1 sbloccata anche senza alcun segnale");
ok(statoSblocco(1, con({ status: "emergente" })).sbloccata, "L1 sbloccata a prescindere dallo stato");

// ── L2 — l'area «si rafforza» (condizioni-azione) ─────────────────────────────
console.log("\n2) Guida 2 — si sblocca quando l'area si rafforza");
ok(!statoSblocco(2, meritoL2({})).sbloccata, "L2 BLOCCATA con segnale vuoto");
ok(statoSblocco(2, meritoL2({ t3Completato: true })).sbloccata, "L2 sbloccata se T3 completato");
ok(statoSblocco(2, meritoL2({ missioniBloccoCompletate: 1 })).sbloccata, "L2 sbloccata con ≥1 missione del blocco");
ok(statoSblocco(2, meritoL2({ status: "confermata" })).sbloccata, "L2 sbloccata se area confermata");
ok(statoSblocco(2, meritoL2({ status: "da_verificare" })).sbloccata, "L2 sbloccata se area da_verificare (segnali forti)");
ok(statoSblocco(2, meritoL2({ interestScore: SOGLIA_L2_INTEREST })).sbloccata, `L2 sbloccata alla soglia di backup (${SOGLIA_L2_INTEREST})`);
ok(!statoSblocco(2, meritoL2({ status: "emergente", interestScore: SOGLIA_L2_INTEREST - 1 })).sbloccata, "L2 bloccata sotto soglia, area solo emergente");

// ── L3 — l'area «si consolida» ────────────────────────────────────────────────
console.log("\n3) Guida 3 — si sblocca quando l'area è consolidata");
ok(!statoSblocco(3, meritoL3({})).sbloccata, "L3 bloccata con segnale vuoto");
ok(statoSblocco(3, meritoL3({ status: "confermata", missioniBloccoCompletate: 1 })).sbloccata, "L3 sbloccata: confermata + missione");
ok(!statoSblocco(3, meritoL3({ status: "confermata", missioniBloccoCompletate: 0 })).sbloccata, "L3 BLOCCATA: confermata ma nessuna missione");
ok(statoSblocco(3, meritoL3({ status: "da_verificare", confidence: 0.85, missioniBloccoCompletate: 1 })).sbloccata, "L3 sbloccata: da_verificare con confidenza alta + missione");
ok(!statoSblocco(3, meritoL3({ status: "da_verificare", confidence: 0.5, missioniBloccoCompletate: 1 })).sbloccata, "L3 bloccata: da_verificare con confidenza bassa");
ok(statoSblocco(3, meritoL3({ status: "emergente", interestScore: SOGLIA_L3_INTEREST, missioniBloccoCompletate: 1 })).sbloccata, `L3 sbloccata al backup: interesse ${SOGLIA_L3_INTEREST} + missione`);
ok(!statoSblocco(3, meritoL3({ status: "emergente", interestScore: SOGLIA_L3_INTEREST })).sbloccata, "L3 bloccata: interesse alto ma nessuna missione");

// ── Struttura del banco ───────────────────────────────────────────────────────
console.log("\n4) Struttura del config");
ok(TUTTE_LE_GUIDE.length === AREE.length * 3, `${AREE.length} aree × 3 = ${AREE.length * 3} guide (${TUTTE_LE_GUIDE.length})`);
let strutturaOk = true;
for (const a of AREE) {
  const g = guideDiArea(a.slug);
  if (g.length !== 3) strutturaOk = false;
  if (g.map((x) => x.livello).join() !== "1,2,3") strutturaOk = false;
  if (g[0].pdf !== `/guide/${a.slug}/1.pdf`) strutturaOk = false;
  if (g.slice(1).some((x) => x.pdf !== `/api/guide/${a.slug}/${x.livello}`)) strutturaOk = false;
  if (g.some((x) => !x.titolo || !x.sottotitolo)) strutturaOk = false;
}
ok(strutturaOk, "ogni area: 3 guide; la 1 statica in /guide/<area>/1.pdf, la 2 e la 3 dietro /api/guide/<area>/<livello>");

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


// ── La clausola e la sequenza ─────────────────────────────────────────────────
// Le due regole entrate col cancello acceso (2026-09-26). L'ORDINE fra loro è la
// parte che conta: la clausola sta SOPRA la sequenza, perché chi ha preso la 2
// quando il cancello era spento non deve trovarsela chiusa oggi.
console.log("\n7) Il cancello acceso: la clausola e la sequenza");

ok(GATE_GUIDE_ATTIVO === true, "il cancello è acceso (se torna false, la regola qui sotto non governa niente)");

// «Una guida già scaricata resta sua» — il no che un cancello non deve mai dire.
ok(statoSblocco(2, con({ giaAperte: [2] })).sbloccata, "L2 già scaricata resta aperta, anche senza nessun merito");
ok(statoSblocco(3, con({ giaAperte: [3] })).sbloccata, "L3 già scaricata resta aperta, anche senza nessun merito");
ok(
  statoSblocco(2, con({ giaAperte: [2] })).motivo.includes("già"),
  "e lo dice: il motivo spiega che è già sua, non inventa un merito"
);
// Il caso che ha richiesto quest'ordine: la 2 presa con la bandiera spenta,
// senza aver mai aperto la 1. Con la sequenza sopra la clausola, oggi sarebbe
// chiusa — cioè accendere una bandiera avrebbe TOLTO qualcosa a qualcuno.
ok(statoSblocco(2, con({ giaAperte: [2] })).sbloccata, "la 2 presa a cancello spento senza la 1 resta aperta (clausola sopra la sequenza)");
ok(statoSblocco(3, con({ giaAperte: [3], status: null })).sbloccata, "idem per la 3, senza nemmeno un'area emersa");

// La sequenza: non si salta l'ordine, e il motivo nomina il passo che manca.
const senzaUno = statoSblocco(2, con({ t3Completato: true, status: "confermata", interestScore: 100 }));
ok(!senzaUno.sbloccata, "L2 BLOCCATA senza aver aperto la 1, anche con tutti i meriti possibili");
ok(senzaUno.motivo.includes("Guida 1"), `e il motivo nomina la Guida 1 ("${senzaUno.motivo}")`);
const senzaDue = statoSblocco(3, con({ giaAperte: [1], status: "confermata", missioniBloccoCompletate: 1 }));
ok(!senzaDue.sbloccata, "L3 BLOCCATA con la 1 aperta ma non la 2, anche con merito pieno");
ok(senzaDue.motivo.includes("Guida 2"), `e il motivo nomina la Guida 2 ("${senzaDue.motivo}")`);
// Il passo che manca è quello che si può fare subito: la sequenza parla PRIMA
// del merito, se no la persona legge «fai una missione» invece di «apri la 1».
ok(!senzaUno.motivo.includes("missione"), "con la 1 da aprire non si chiede una missione: si chiede la 1");

// La sequenza è PER AREA: il segnale arriva già filtrato per area, quindi la
// prova è che `giaAperte` di un'altra area non abbia alcun effetto qui.
ok(!statoSblocco(2, con({ giaAperte: [], t3Completato: true })).sbloccata, "L2 di un'area dove non ho aperto la 1 resta chiusa (la sequenza non è globale)");

// E la Panoramica non è toccata da nessuna delle due: è il magnete del funnel.
ok(statoSblocco(1, con({ giaAperte: [] })).sbloccata, "L1 aperta anche senza nulla: nessuna sequenza davanti al primo gradino");

// ── Dove vivono i PDF ─────────────────────────────────────────────────────────
// La proprietà che rende il cancello un cancello: dei livelli riservati non
// esiste NESSUNA copia a un indirizzo pubblico. Se un giorno uno tornasse in
// public/, sarebbe di nuovo scaricabile da chiunque e questo test lo dice.
console.log("\n8) I PDF riservati non hanno una copia pubblica");

let pubbliciDiTroppo = [];
let riservatiMancanti = [];
let panoramicheMancanti = [];
for (const a of AREE) {
  for (const liv of GUIDE_PRONTE[a.slug] ?? []) {
    const inPublic = path.join(ROOT, "public", "guide", a.slug, `${liv}.pdf`);
    const riservato = path.join(ROOT, "content", "guide", a.slug, `${liv}.pdf`);
    if (liv === 1) {
      if (!fs.existsSync(inPublic)) panoramicheMancanti.push(`${a.slug}/1.pdf`);
    } else {
      if (fs.existsSync(inPublic)) pubbliciDiTroppo.push(`${a.slug}/${liv}.pdf`);
      if (!fs.existsSync(riservato)) riservatiMancanti.push(`${a.slug}/${liv}.pdf`);
    }
  }
}
ok(
  pubbliciDiTroppo.length === 0,
  pubbliciDiTroppo.length === 0
    ? "nessuna guida 2 o 3 è rimasta in public/ (là sarebbe scaricabile da chiunque)"
    : `guide riservate ancora in public/: ${pubbliciDiTroppo.join(", ")}`
);
ok(riservatiMancanti.length === 0, riservatiMancanti.length === 0 ? "ogni guida 2/3 dichiarata pronta esiste in content/guide/" : `mancanti: ${riservatiMancanti.join(", ")}`);
ok(
  panoramicheMancanti.length === 0,
  panoramicheMancanti.length === 0
    ? "ogni Panoramica dichiarata pronta è ancora in public/ (è l'URL che sta nelle email: non si sposta mai più)"
    : `Panoramiche spostate per errore: ${panoramicheMancanti.join(", ")}`
);

// E il bundle della funzione: senza questa riga in next.config.ts la rotta
// legge un file che non c'è, e il sintomo è un 500 su una guida.
const cfg = fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
ok(/outputFileTracingIncludes/.test(cfg), "next.config.ts traccia i PDF riservati nel bundle della funzione");
ok(/content\/guide/.test(cfg), "…e li traccia da content/guide");


// ── Il testo del rifiuto ──────────────────────────────────────────────────────
// Tre esiti, non due: bloccata / non ho potuto controllare / nel frattempo si è
// aperta. E dove atterra conta quanto cosa dice — vedi avvisoRifiuto.ts.
console.log("\n9) Il testo del rifiuto");

const treGuide = [
  { livello: 1, titolo: "Panoramica", sbloccata: true, motivo: "Sempre disponibile." },
  { livello: 2, titolo: "Le strade dentro l'area", sbloccata: false, motivo: "Si apre dopo la Guida 1 di quest'area: aprila e torna qui." },
  { livello: 3, titolo: "Come partire davvero", sbloccata: false, motivo: "Si sblocca quando l'area è consolidata e hai completato una missione." },
];

const bloccato = avvisoRifiuto(treGuide, "2");
ok(bloccato !== null, "un rifiuto produce un avviso");
ok(bloccato.includes("Le strade dentro l'area"), "…che nomina la guida chiesta");
ok(bloccato.includes("Guida 1"), "…e porta dentro il motivo ricalcolato dalla pagina");

const guasto = avvisoRifiuto(treGuide, "2", "1");
ok(guasto.includes("problema nostro"), "se non abbiamo potuto controllare, lo dice: è un problema nostro");
ok(!guasto.includes("Guida 1"), "…e non finge un motivo che non conosce");

ok(avvisoRifiuto(treGuide, "1") === null, "una guida già aperta non produce nessun no");
ok(avvisoRifiuto(treGuide, undefined) === null, "chi arriva senza `bloccata` non legge nessun avviso");
ok(avvisoRifiuto(treGuide, "9") === null, "un livello inventato nell'URL non produce un avviso");
ok(avvisoRifiuto([], "2") === null, "nessuna guida da valutare: nessun avviso");

// La lingua del prodotto non conosce il genere di chi legge (vedi CLAUDE.md).
const accordi = [bloccato, guasto, ...treGuide.map((g) => g.motivo)].flatMap((x) => trovaAccordi(x));
ok(accordi.length === 0, `nessuna forma accordata col genere di chi legge${accordi.length ? ` — ${accordi.join(", ")}` : ""}`);

// E la pagina la CHIAMA invece di ricomporre il testo.
const pag = fs.readFileSync(path.join(ROOT, "app/app/guide/[areaSlug]/page.tsx"), "utf8");
ok(/avvisoRifiuto\s*\(/.test(pag), "la pagina dell'area chiama avvisoRifiuto");
ok(!/problema nostro/.test(pag), "…e non tiene una seconda copia del testo");

// ── La frase che descrive la regola ───────────────────────────────────────────
// Era scritta a mano in DUE introduzioni e tutte e due si erano fermate alla
// versione di prima della sequenza. Non si può generare (descrive la regola in
// generale, non lo stato di uno studente), quindi la proprietà sorvegliabile è
// un'altra: **non enumera i segnali**. L'elenco dei modi di sbloccare ha quattro
// voci alternative e cambia; la sequenza no.
console.log("\n10) La frase sullo sblocco: una sola, e non enumera i segnali");

const SEGNALI_ENUMERATI = [/Più a fondo/i, /mission/i, /profilo/i, /interess/i, /consolidat/i];
const enumerati = SEGNALI_ENUMERATI.filter((r) => r.test(TESTO_SBLOCCO_GUIDE)).map(String);
ok(
  enumerati.length === 0,
  enumerati.length === 0
    ? "TESTO_SBLOCCO_GUIDE non nomina nessun segnale di sblocco (quello lo dice la card, dove è generato)"
    : `la frase enumera i segnali (${enumerati.join(", ")}): è la forma che si è scollata due volte — il «cosa manca» lo dice «motivo», che non si scrive a mano`,
);
ok(/in ordine/i.test(TESTO_SBLOCCO_GUIDE), "…e dice la sequenza, che è la metà che mancava");
// «una alla volta» è la forma che Mario ha scartato rileggendola: si legge anche
// come «ne puoi tenere aperta una sola», cioè che aprire la seconda chiude la
// prima. Non è quello che succede, e per chi guarda tre lucchetti è la lettura
// più naturale — quindi la guardia impedisce che ci si torni per abitudine.
ok(
  !/una alla volta/i.test(TESTO_SBLOCCO_GUIDE),
  "…senza «una alla volta», che si legge come «ne puoi tenere aperta una sola» (e aperta resta aperta)",
);
ok(trovaAccordi(TESTO_SBLOCCO_GUIDE).length === 0, "…e non concorda col genere di chi legge");

// Le due pagine la CHIAMANO invece di riscriverla.
const indice = fs.readFileSync(path.join(ROOT, "app/app/guide/page.tsx"), "utf8");
for (const [nome, src] of [["l'indice /app/guide", indice], ["la pagina dell'area", pag]]) {
  ok(/TESTO_SBLOCCO_GUIDE/.test(src), `${nome} usa TESTO_SBLOCCO_GUIDE`);
  ok(
    !/si aprono man mano/.test(src),
    `${nome} non tiene più il riassunto scritto a mano`,
  );
}

// ── I passi in fondo alla pagina seguono il passo che MANCA ────────────────────
console.log("\n11) La riga di azioni: il passo che manca, non l'elenco dei passi");

const G = (livello, titolo, sbloccata, causa, disponibile = true) => ({ livello, titolo, sbloccata, causa, disponibile });
const PANORAMICA = "Panoramica";
const STRADE = "Le strade dentro l'area";

// Bloccata dalla sequenza: il passo è aprire la guida precedente, che è lì sopra.
const seq = passiPagina("salute-professioni-sanitarie", [
  G(1, PANORAMICA, true, "aperta"),
  G(2, STRADE, false, "sequenza"),
  G(3, "Come partire davvero", false, "sequenza"),
]);
ok(seq[0]?.tipo === "apri" && seq[0].livello === 1, "sequenza: il primo passo APRE la guida precedente");
ok(seq[0]?.etichetta.includes(PANORAMICA), "…e la nomina, invece di dire «guida 1»");
ok(
  !seq.some((p) => /Più a fondo|missione/i.test(p.etichetta)),
  "…e NON offre insieme le strade del merito: due strade offerte insieme fanno leggere la seconda, che costa un'ora invece di un clic",
);

// La 2 aperta ma non ancora LETTA: la 3 è bloccata dalla sequenza su di lei.
const seq3 = passiPagina("salute-professioni-sanitarie", [
  G(1, PANORAMICA, true, "aperta"),
  G(2, STRADE, true, "aperta"),
  G(3, "Come partire davvero", false, "sequenza"),
]);
ok(seq3[0]?.tipo === "apri" && seq3[0].livello === 2, "sequenza sulla 3: il passo è aprire la 2, non la 1");
// E L'ETICHETTA VA CONTROLLATA A PARTE DAL LIVELLO, perché è lì che il difetto
// si nasconderebbe: un'etichetta FISSA («Apri la Panoramica») lascerebbe l'assert
// qui sopra verde — il `livello` sarebbe comunque 2 — e manderebbe alla Panoramica
// chi ce l'ha già aperta. Un no che indica il posto sbagliato è peggio di un no
// generico, perché sembra preciso. E nessuno se ne accorgerebbe finché uno
// studente non arriva alla TERZA guida, cioè fra molto tempo e lontano da qui.
ok(
  seq3[0]?.etichetta.includes(STRADE) && !seq3[0].etichetta.includes(PANORAMICA),
  "…e l'etichetta nomina la 2 («Le strade dentro l'area»), non la 1: viene dal titolo della guida precedente, non da una stringa fissa",
);

// Il PDF precedente non pronto: non si promette una strada chiusa.
const seqSenzaPdf = passiPagina("x", [G(1, PANORAMICA, true, "aperta", false), G(2, STRADE, false, "sequenza")]);
ok(
  !seqSenzaPdf.some((p) => p.tipo === "apri"),
  "se la guida da aprire non è ancora pronta, nessun bottone la promette (è un buco nostro, non un passo dello studente)",
);

// Merito sulla 2: entrambe le strade la aprono.
const meritoDue = passiPagina("x", [G(1, PANORAMICA, true, "aperta"), G(2, STRADE, false, "merito")]);
ok(meritoDue.some((p) => /Più a fondo/.test(p.etichetta)), "merito sulla 2: «Più a fondo» c'è");
ok(meritoDue.some((p) => /missione/i.test(p.etichetta)), "…e anche la missione");

// Merito sulla 3: «Più a fondo» da solo non la apre MAI (sbloccoL3 richiede una
// missione in ogni suo ramo), quindi quel bottone non si mostra.
const meritoTre = passiPagina("x", [
  G(1, PANORAMICA, true, "aperta"),
  G(2, STRADE, true, "aperta"),
  G(3, "Come partire davvero", false, "merito"),
]);
ok(
  !meritoTre.some((p) => /Più a fondo/.test(p.etichetta)),
  "merito sulla 3: «Più a fondo» NON compare — non può aprirla da solo, e un bottone che non porta dove dice è peggio di nessun bottone",
);
ok(meritoTre.some((p) => /missione/i.test(p.etichetta)), "…e la missione, che serve sempre, sì");

// E la coerenza col motore vero: la causa la mette `statoSblocco`, non il test.
ok(statoSblocco(2, con({})).causa === "sequenza", "statoSblocco marca «sequenza» quando manca la guida precedente");
ok(statoSblocco(2, meritoL2({})).causa === "merito", "…e «merito» quando la sequenza è a posto ma il segnale no");
ok(statoSblocco(1, vuoto).causa === "aperta", "…e «aperta» su una guida sbloccata");
ok(statoSblocco(3, con({ giaAperte: [1, 2, 3] })).causa === "aperta", "…compresa una già scaricata");

// Niente bloccato: la riga torna a essere navigazione.
const tutteAperte = passiPagina("x", [G(1, PANORAMICA, true, "aperta"), G(2, STRADE, true, "aperta"), G(3, "C", true, "aperta")]);
ok(tutteAperte.every((p) => p.tipo === "vai"), "con tutto aperto la riga è sola navigazione: nessun bottone di sblocco");
ok(tutteAperte.length === 3, "…e sono le tre di sempre");

// La pagina li RENDE dalla funzione, e non tiene una riga fissa.
ok(/passiPagina\s*\(/.test(pag), "la pagina dell'area chiama passiPagina");
ok(!/Fai «Più a fondo»/.test(pag), "…e non tiene più la riga di bottoni scritta a mano");

// ── Aprire una guida passa da UN posto solo ───────────────────────────────────
// La sequenza avanza solo se l'apertura finisce in activity_log col livello. Un
// link diretto al PDF dal fondo pagina aprirebbe il file senza registrare
// niente: la guida successiva resterebbe chiusa e la pagina continuerebbe a
// chiedere lo stesso passo a chi l'ha appena fatto. Un giro chiuso, e il PDF si
// scarica davvero — quindi nessuna prova automatica se ne accorgerebbe da sola.
console.log("\n12) Aprire una guida registra l'apertura, sempre");

const opener = fs.readFileSync(path.join(ROOT, "components/app/ApriGuidaButton.tsx"), "utf8");
ok(/registraAttivita\(/.test(opener) && /window\.open\(/.test(opener), "ApriGuidaButton registra l'apertura e poi apre");
ok(/"download_guida",\s*livello/.test(opener), "…col LIVELLO, che è il fatto che la sequenza legge");

const card = fs.readFileSync(path.join(ROOT, "components/app/CardGuida.tsx"), "utf8");
ok(/ApriGuidaButton/.test(card), "la card apre attraverso quel componente");
ok(!/window\.open\(/.test(card), "…e non tiene una seconda copia del gesto");
ok(!/window\.open\(/.test(pag), "nemmeno la pagina");
ok(
  !/href=\{[^}]*percorsoGuida\(/.test(pag) && !/href="\/guide\//.test(pag),
  "e nessun link diretto al PDF in pagina: aprirebbe il file senza registrare l'apertura, e la sequenza non avanzerebbe mai",
);

console.log("");
if (falliti > 0) { console.error(`✗ ${falliti} verifiche fallite`); process.exit(1); }
console.log("✓ Tutte le verifiche Guide superate.");
