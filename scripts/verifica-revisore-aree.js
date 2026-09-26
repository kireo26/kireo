// KIREO Escape — il revisore, su tutte e undici le missioni, senza una chiamata.
//
// PERCHÉ ESISTE. `npm run censimento` simula sei giocatori su tutte e undici le
// missioni, ma li fa giocare con l'AI SPENTA (`calcolaEvidenze(mission, risposte,
// null)`): quindi copre gli step strutturati e non tocca i tre step aperti —
// non-approfondire, proposta, riflessione — che sono gli unici in cui una prova
// nasce da un testo che lo studente ha scritto. La validazione della whitelist
// («il revisore può nominare solo le aree candidate di QUESTA missione») e il gate
// delle cifre citabili sono stati esercitati su una missione su undici, quella
// giocata dal robot.
//
// Il modello non serve per provarli: il validatore vive a valle della risposta,
// quindi basta FINGERE la risposta. Questo controllo non fa nessuna chiamata, non
// legge nessuna riga, non spende niente.
//
// TRE COSE, E LA TERZA È QUELLA CHE RENDE CREDIBILI LE ALTRE DUE.
//
//   A. I tre prompt si ASSEMBLANO davvero (chiamando `costruisciPromptPropostaPerTest`,
//      `PROMPT_RIFLESSIONE`, `PROMPT_NON_APPROFONDIRE`) e l'elenco di aree ammesse
//      che finisce nel testo coincide ESATTAMENTE con `mission.areeCandidate`.
//      Copiare la lista qui sarebbe la seconda definizione della stessa cosa.
//   B. Tre risposte finte per missione (33 casi): una buona, una con un'area FUORI
//      whitelist, una con una cifra che lo studente non poteva sapere. La prima
//      deve passare, le altre due essere scartate NOMINANDO il motivo.
//   C. Le calibrazioni, cioè la metà «cosa guarda» di questo controllo:
//      - la SENTINELLA: ogni prompt deve interpolare la lista che riceve (se la
//        tenesse cablata, A sarebbe verde su una lista che nessuno passa);
//      - il CONTEGGIO DELLE CHIAMATE: 3 per un caso pulito, 4 per il caso della
//        cifra (il `controlloExtra` di chiamaJson chiede una seconda risposta).
//        Se la guardia smette di scattare il conteggio cala, e il caso è rosso
//        anche se il ripiego arrivasse per un'altra strada;
//      - il PROMPT NON RICONOSCIUTO: il cliente finto solleva invece di
//        rispondere a caso. Uno stub che risponde a un prompt che non ha
//        riconosciuto è il modo più economico di essere verdi su niente.
//
// Esecuzione: `npm run test:revisore` (o `node scripts/verifica-revisore-aree.js`).

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

const { MISSIONI, getMissione, stepDellaMissione, materialiLetti } = require("@/lib/escape/config");
const {
  calcolaEvidenze,
  costruisciPromptPropostaPerTest,
  PROMPT_RIFLESSIONE,
  PROMPT_NON_APPROFONDIRE,
} = require("@/lib/escape/scoring");
const { insiemeCifreCitabili } = require("@/lib/escape/cifreCitabili");
const { AREE, getAreaBySlug } = require("@/data/aree");

const SLUG_TUTTI = AREE.map((a) => a.slug);
const nomeArea = (slug) => getAreaBySlug(slug)?.nome ?? slug;
const accessore = (obj) => (id) => obj[id];

let falliti = 0;
let passati = 0;
let nonApplicabili = 0;
function ok(cond, msg) {
  if (cond) { passati++; console.log(`  ✓ ${msg}`); }
  else { falliti++; console.log(`  ✗ FAIL ${msg}`); }
}
function na(msg, ragione) {
  nonApplicabili++;
  console.log(`  — N/A ${msg}\n      non applicabile: ${ragione}`);
}

// ───────────────────────────────────── il giocatore minimo
//
// Serve solo ad arrivare ai tre step aperti con del testo dentro: il mandato (per
// risolvere la missione), i materiali e i dossier (l'insieme delle cifre citabili
// si deriva da quello che lo studente ha APERTO), e i tre testi. Gli step
// strutturati non si riempiono: le loro prove le esercita il censimento, e
// riempirli qui vorrebbe dire una seconda copia di quel giocatore.
function giocatoreMinimo(slug) {
  const base = getMissione(slug);
  const passi0 = stepDellaMissione(base);
  const mandato = passi0.find((s) => s.id === "s1_mandato").opzioni[0];
  const liberi = (passi0.find((s) => s.id === "s1_materiali")?.materiali ?? []).map((m) => m.id);

  const get0 = accessore({ s1_materiali: { letti: liberi }, s1_mandato: { opzioneId: mandato.id } });
  const dossier = (stepDellaMissione(getMissione(slug, get0)).find((s) => s.id === "s2_informazioni")?.dossier ?? []).map((d) => d.id);

  const risposte = new Map([
    ["s1_materiali", { letti: liberi }],
    ["s1_mandato", { opzioneId: mandato.id }],
    ["s2_informazioni", { selezionati: dossier }],
    ["s2_non_approfondire", { testo: "Non ho aperto il registro degli accessi: mi sono fidato di quello che mi hanno raccontato." }],
    ["s4_proposta", { testo: "La mia proposta parte da chi usa il posto ogni giorno e dice cosa si apre per primo." }],
    ["s5_riflessione", { testo: "Mi sono trovato meglio quando c'era da parlare con le persone che quando c'era da fare i conti." }],
  ]);

  const get = (id) => risposte.get(id);
  const mission = getMissione(slug, get);
  return { mission, risposte, letti: materialiLetti(get) };
}

// ───────────────────────────────────── il cliente finto
//
// Riconosce quale dei tre prompt gli è arrivato confrontandolo con quelli
// ASSEMBLATI dal gruppo A (chiamaJson appende le sue regole in coda, quindi il
// prompt vero è un prefisso). Un prompt che non riconosce lo fa SOLLEVARE, non
// rispondere a caso: se un giorno un prompt cambia forma, questo controllo deve
// diventare rosso, non continuare a misurare un'altra cosa.
function clienteFinto(prompt, jsonPer) {
  const chiamate = [];
  const ignoti = [];
  return {
    chiamate,
    ignoti,
    messages: {
      create: async ({ system }) => {
        const quale = ["proposta", "riflessione", "nonApprofondire"].find((k) => system.startsWith(prompt[k]));
        if (!quale) { ignoti.push(system.slice(0, 120)); throw new Error("prompt non riconosciuto dal cliente finto"); }
        chiamate.push(quale);
        return {
          content: [{ type: "text", text: jsonPer[quale] }],
          stop_reason: "end_turn",
          usage: { output_tokens: 120 },
        };
      },
    },
  };
}

// Esegue un caso: cattura warn/error/log (il motore ci scrive i motivi degli
// scarti, e quei motivi sono metà di quello che stiamo verificando) e restituisce
// prove, esito e righe di log.
async function esegui(mission, risposte, cliente) {
  const righe = [];
  const orig = { warn: console.warn, error: console.error, log: console.log };
  for (const k of ["warn", "error", "log"]) console[k] = (...a) => righe.push(a.map(String).join(" "));
  try {
    const r = await calcolaEvidenze(mission, risposte, cliente);
    return { ...r, righe };
  } finally {
    Object.assign(console, orig);
  }
}

const jsonProposta = (slug, motivazione) =>
  JSON.stringify({
    aree: [{ area_slug: slug, performance: 0.7, interest: 0.6, motivazione }],
    giudizio_complessivo: "La tua proposta sta in piedi e dice da dove parte.",
  });
const jsonRiflessione = (slug, motivazione) =>
  JSON.stringify({ aree: [{ area_slug: slug, curiosity: 0.7, self_efficacy: 0.5, motivazione }] });
const JSON_NON_APPROFONDIRE = JSON.stringify({
  consapevolezza: 0.6,
  motivazione: "Hai detto a che cosa hai rinunciato, e perché: è una scelta, non una dimenticanza.",
});

const MOT_PROPOSTA = "La tua proposta tiene insieme le persone e i conti.";
const MOT_RIFLESSIONE = "Nella tua riflessione torna il lavoro con le persone.";

// ───────────────────────────────────── A · l'extractor, e la sua taratura

console.log("KIREO Escape — il revisore su tutte e undici le missioni (nessuna chiamata AI)\n");

console.log("0) L'estrattore di slug è affidabile");
// Se uno slug fosse sottostringa di un altro, cercarli tutti nel testo del prompt
// conterebbe due volte: la proprietà «l'elenco coincide» diventerebbe illeggibile.
const sovrapposti = SLUG_TUTTI.filter((a) => SLUG_TUTTI.some((b) => b !== a && b.includes(a)));
ok(sovrapposti.length === 0, `nessuno dei ${SLUG_TUTTI.length} slug è sottostringa di un altro${sovrapposti.length ? ` (${sovrapposti.join(", ")})` : ""}`);

const slugNelTesto = (testo) => SLUG_TUTTI.filter((s) => testo.includes(s));
const SENTINELLA = "zona-sentinella-di-prova";

async function perMissione(slug) {
  console.log(`\n── ${slug}`);
  const { mission, risposte, letti } = giocatoreMinimo(slug);
  const cand = mission.areeCandidate;

  const prompt = {
    proposta: costruisciPromptPropostaPerTest(slug, cand, letti),
    riflessione: PROMPT_RIFLESSIONE(cand),
    nonApprofondire: PROMPT_NON_APPROFONDIRE,
  };

  // A · l'elenco ammesso nel prompt coincide con areeCandidate
  ok(typeof prompt.proposta === "string" && prompt.proposta.length > 0, `A1 · il prompt della proposta si assembla (${cand.length} aree candidate)`);
  const inProposta = slugNelTesto(prompt.proposta ?? "");
  ok(
    inProposta.length === cand.length && cand.every((s) => inProposta.includes(s)),
    `A1 · le aree ammesse nel prompt della proposta sono esattamente le candidate (${inProposta.length}/${cand.length})`,
  );
  const inRiflessione = slugNelTesto(prompt.riflessione);
  ok(
    inRiflessione.length === cand.length && cand.every((s) => inRiflessione.includes(s)),
    `A2 · …e lo stesso per la riflessione (${inRiflessione.length}/${cand.length})`,
  );
  // Il terzo non nomina nessuna area, e non per dimenticanza: emette
  // `area_slug: null`, quindi una whitelist non avrebbe niente da filtrare.
  ok(slugNelTesto(prompt.nonApprofondire).length === 0, "A3 · il prompt di non-approfondire non nomina nessuna area");

  // C · la sentinella: il prompt interpola la lista che riceve, non ne tiene una sua
  const sentProp = costruisciPromptPropostaPerTest(slug, [SENTINELLA], letti) ?? "";
  const sentRifl = PROMPT_RIFLESSIONE([SENTINELLA]);
  ok(
    sentProp.includes(SENTINELLA) && slugNelTesto(sentProp).length === 0,
    "C1 · con una lista finta il prompt della proposta nomina solo quella (non ne tiene una cablata)",
  );
  ok(
    sentRifl.includes(SENTINELLA) && slugNelTesto(sentRifl).length === 0,
    "C1 · …e lo stesso il prompt della riflessione",
  );

  // ── B · le tre risposte finte ───────────────────────────────────────────────
  const dentro = cand[0];
  const cifreOk = insiemeCifreCitabili(mission, risposte, letti);

  // B1 · buona
  {
    const cliente = clienteFinto(prompt, {
      proposta: jsonProposta(dentro, MOT_PROPOSTA),
      riflessione: jsonRiflessione(dentro, MOT_RIFLESSIONE),
      nonApprofondire: JSON_NON_APPROFONDIRE,
    });
    const { evidenze, revisoreEsito, righe } = await esegui(mission, risposte, cliente);
    const perf = evidenze.find((e) => e.step_id === "s4_proposta" && e.area_slug === dentro && e.dimensione === "performance");
    const cur = evidenze.find((e) => e.step_id === "s5_riflessione" && e.area_slug === dentro && e.dimensione === "curiosity");
    const na2 = evidenze.filter((e) => e.step_id === "s2_non_approfondire");
    const sporche = righe.filter((r) => /Cifra non citabile|senza credito/.test(r));
    ok(cliente.ignoti.length === 0, `B1 · i tre prompt sono stati riconosciuti tutti${cliente.ignoti.length ? ` (ignoto: ${cliente.ignoti[0]})` : ""}`);
    ok(
      revisoreEsito === "letto" &&
        perf?.motivazione === MOT_PROPOSTA &&
        cur?.motivazione === MOT_RIFLESSIONE &&
        na2.length === 2 &&
        sporche.length === 0 &&
        cliente.chiamate.length === 3,
      `B1 · risposta buona: accettata con la sua motivazione, esito «letto», 3 chiamate` +
        ` [esito=${revisoreEsito} perf=${perf ? "sì" : "no"} curiosity=${cur ? "sì" : "no"} nonAppr=${na2.length} chiamate=${cliente.chiamate.length}${sporche.length ? ` scarti=${sporche.length}` : ""}]`,
    );
  }

  // B2 · un'area fuori whitelist
  {
    const fuoriReale = SLUG_TUTTI.find((s) => !cand.includes(s));
    // Missione 01: ammette tutte e 18 le aree, quindi «un'area reale fuori
    // whitelist» NON ESISTE. Il caso resta valido — e realistico — con uno slug
    // che il modello si è inventato: la guardia è la stessa (`!includes`).
    //
    // MA UNA METÀ DEL CASO, LÌ, È VACUA, e va detto invece di lasciarla contare:
    // uno slug inventato lo ferma ANCHE il paracadute di sanitizzazione in coda a
    // calcolaEvidenze (misurato togliendo la guardia: `trapelate` resta 0 sulla
    // Missione 01 e diventa 2 sulle altre dieci). Quindi lì la whitelist si
    // osserva solo dall'esito e dal motivo; su un'area REALE ma non ammessa la
    // whitelist è l'unica cosa che la ferma.
    const fuori = fuoriReale ?? "area-che-non-esiste";
    const cliente = clienteFinto(prompt, {
      proposta: jsonProposta(fuori, MOT_PROPOSTA),
      riflessione: jsonRiflessione(fuori, MOT_RIFLESSIONE),
      nonApprofondire: JSON_NON_APPROFONDIRE,
    });
    const { evidenze, revisoreEsito, righe } = await esegui(mission, risposte, cliente);
    const trapelate = evidenze.filter((e) => e.area_slug === fuori);
    const motivo = righe.find((r) => r.includes("fuori whitelist") && r.includes(fuori));
    ok(
      revisoreEsito === "letto_senza_credito" &&
        trapelate.length === 0 &&
        Boolean(motivo) &&
        motivo.includes("Ammesse:") &&
        cliente.chiamate.length === 3,
      `B2 · area fuori whitelist («${fuori}»${fuoriReale ? "" : ", slug inventato: qui sono candidate tutte e 18, e il paracadute lo ferma comunque"}): scartata, esito «letto_senza_credito», motivo nominato` +
        ` [esito=${revisoreEsito} trapelate=${trapelate.length} motivo=${motivo ? "sì" : "no"} chiamate=${cliente.chiamate.length}]`,
    );
  }

  // B3 · una cifra che lo studente non poteva sapere
  {
    let cifra = null;
    for (let n = 987654; n < 987754 && cifra === null; n++) if (!cifreOk.has(String(n))) cifra = n;
    if (cifra === null) {
      na("B3 · cifra non citabile", "non si è trovata una cifra fuori dall'insieme citabile in cento tentativi");
    } else {
      const motSporca = `${MOT_PROPOSTA} Il conto torna a ${cifra} euro.`;
      const cliente = clienteFinto(prompt, {
        proposta: jsonProposta(dentro, motSporca),
        riflessione: jsonRiflessione(dentro, MOT_RIFLESSIONE),
        nonApprofondire: JSON_NON_APPROFONDIRE,
      });
      const { evidenze, revisoreEsito, righe } = await esegui(mission, risposte, cliente);
      const perf = evidenze.find((e) => e.step_id === "s4_proposta" && e.area_slug === dentro && e.dimensione === "performance");
      const ripiego = `La tua proposta valorizza ${nomeArea(dentro)}.`;
      const letta = evidenze.some((e) => String(e.motivazione ?? "").includes(String(cifra)));
      const avviso = righe.find((r) => r.includes("Cifra non citabile") && r.includes(String(cifra)));
      ok(
        revisoreEsito === "letto" &&
          perf?.motivazione === ripiego &&
          !letta &&
          Boolean(avviso) &&
          cliente.chiamate.length === 4,
        `B3 · cifra non citabile (${cifra}): sostituita dal ripiego, mai letta dallo studente, seconda risposta chiesta` +
          ` [motivazione=${perf?.motivazione === ripiego ? "ripiego" : "ALTRA"} cifra_a_schermo=${letta ? "SÌ" : "no"} avviso=${avviso ? "sì" : "no"} chiamate=${cliente.chiamate.length}]`,
      );
    }
  }
}

(async () => {
  for (const m of MISSIONI) await perMissione(m.slug);

  console.log("");
  if (nonApplicabili > 0) console.log(`→ ${nonApplicabili} non applicabili (non passate: non si sono potute fare)`);
  if (falliti > 0) { console.error(`✗ ${falliti} verifiche fallite (${passati} superate)`); process.exit(1); }
  console.log(`✓ Tutte le ${passati} verifiche del revisore superate su ${MISSIONI.length} missioni.`);
})();
