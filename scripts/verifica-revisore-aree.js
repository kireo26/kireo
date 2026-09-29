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
const { MAX_MOTIVAZIONE, RIPIEGHI_MOTIVAZIONE, REGOLA_MOTIVAZIONE } = require("@/lib/escape/chiamaEscape");
const { AREE } = require("@/data/aree");
const { senzaCommenti } = require("./lib/senza-commenti");

const SLUG_TUTTI = AREE.map((a) => a.slug);
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
  // I system COMPLETI, come li riceve il modello: è l unico posto da cui si può
  // verificare che una regola appesa centralmente arrivi davvero. Un controllo
  // lessicale sul sorgente direbbe che la riga esiste, non che passa di qui.
  const sistemi = [];
  return {
    chiamate,
    ignoti,
    sistemi,
    messages: {
      create: async ({ system }) => {
        const quale = ["proposta", "riflessione", "nonApprofondire"].find((k) => system.startsWith(prompt[k]));
        if (!quale) { ignoti.push(system.slice(0, 120)); throw new Error("prompt non riconosciuto dal cliente finto"); }
        chiamate.push(quale);
        sistemi.push(system);
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

    // B1bis · LA REGOLA SENZA VOTO arriva a tutti e tre i revisori di Escape.
    // Il 27/09 una motivazione diceva «Quello che riduce il voto è…» dentro il
    // blocco che dichiara di non mostrare nessun punteggio: due frasi che si
    // contraddicono sulla stessa schermata, e quella falsa era la nostra. Si
    // verifica sul SYSTEM VERO ricevuto dal modello, non sul sorgente: una riga
    // che esiste nel file e non passa di qui è la specie che inseguiamo.
    const senzaVoto = cliente.sistemi.filter((x) => /non nominare mai il voto/i.test(x));
    ok(
      cliente.sistemi.length > 0 && senzaVoto.length === cliente.sistemi.length,
      senzaVoto.length === cliente.sistemi.length
        ? `B1bis · la regola «chi legge non vede nessun numero» arriva a tutti e ${cliente.sistemi.length} i revisori`
        : `B1bis · la regola arriva solo a ${senzaVoto.length} dei ${cliente.sistemi.length} revisori: gli altri possono parlare di un voto che lo studente non vede`,
    );
    ok(
      cliente.sistemi.every((x) => /resta il punto più fragile/.test(x)),
      "B1bis · …e porta la sostituzione svolta, non solo il divieto (è la forma che in questo progetto prende)",
    );

    // B1ter · LA REGOLA CHE LA MOTIVAZIONE NON GIUDICA, e che porta una MISURA.
    // Il 29/09 il prompt chiedeva già una motivazione «breve» — un aggettivo
    // senza numero, che non impegna nessuno — e nel blocco «Aree che stai
    // sfiorando» sono comparsi due paragrafi in cui il prodotto spiegava a un
    // diciassettenne cosa aveva sbagliato. Si verifica sul system vero, come
    // sopra, e si pretendono tutte e tre le metà: il divieto, il NUMERO (che deve
    // essere quello applicato dal codice, o le due copie divergono) e una
    // sostituzione svolta.
    const senzaGiudizio = cliente.sistemi.filter((x) => /MAI COSA HA SBAGLIATO/.test(x));
    ok(
      cliente.sistemi.length > 0 && senzaGiudizio.length === cliente.sistemi.length,
      senzaGiudizio.length === cliente.sistemi.length
        ? `B1ter · la regola «dice cosa ha fatto, mai cosa ha sbagliato» arriva a tutti e ${cliente.sistemi.length} i revisori`
        : `B1ter · la regola arriva solo a ${senzaGiudizio.length} dei ${cliente.sistemi.length} revisori: gli altri possono spiegare a un ragazzo cosa ha sbagliato`,
    );
    ok(
      cliente.sistemi.every((x) => x.includes(`${MAX_MOTIVAZIONE} caratteri`)),
      `B1ter · …e dichiara la MISURA vera (${MAX_MOTIVAZIONE} caratteri), non l'aggettivo «breve»: il numero nel prompt è quello che il codice applica`,
    );
    ok(
      cliente.sistemi.every((x) => /chiedere a Sofia di spiegare/.test(x)),
      "B1ter · …con una riscrittura svolta, presa dal paragrafo vero del 29/09",
    );
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
      const ripiego = RIPIEGHI_MOTIVAZIONE.proposta;
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

  // B4 · una motivazione più lunga del tetto
  //
  // IL CASO VERO DEL 29/09, in forma riproducibile: il modello scrive un
  // paragrafo, e il paragrafo arriva a schermo perché il campo non ha un tetto.
  // Tre proprietà, e la terza è quella che si dimentica:
  //   — al suo posto va il RIPIEGO contestuale, non il testo tagliato a metà
  //     (un giudizio amputato è peggio di un giudizio intero);
  //   — il paragrafo non compare in NESSUNA prova, nemmeno accorciato;
  //   — NESSUNA SECONDA CHIAMATA: il tetto è un terminale, non un ritentativo.
  //     Una lunghezza non è un errore di fatto come una cifra inventata, e
  //     ripagare una chiamata per una proprietà di stile non si fa.
  {
    const lungo = `${MOT_PROPOSTA} ${"Qui hai scelto il documento invece che la conversazione, e se l'area ti interessa è proprio perché vedi che questa scelta è stata uno sbaglio. ".repeat(3)}`;
    ok(lungo.length > MAX_MOTIVAZIONE, `B4 · il caso di prova è davvero sopra il tetto (${lungo.length} > ${MAX_MOTIVAZIONE})`);
    const cliente = clienteFinto(prompt, {
      proposta: jsonProposta(dentro, lungo),
      riflessione: jsonRiflessione(dentro, MOT_RIFLESSIONE),
      nonApprofondire: JSON_NON_APPROFONDIRE,
    });
    const { evidenze, revisoreEsito, righe } = await esegui(mission, risposte, cliente);
    const perf = evidenze.find((e) => e.step_id === "s4_proposta" && e.area_slug === dentro && e.dimensione === "performance");
    const ripiego = RIPIEGHI_MOTIVAZIONE.proposta;
    const pezzoAschermo = evidenze.some((e) => String(e.motivazione ?? "").includes("è stata uno sbaglio"));
    const avviso = righe.find((r) => r.includes("Motivazione troppo lunga"));
    const oltre = evidenze.filter((e) => String(e.motivazione ?? "").length > MAX_MOTIVAZIONE);
    ok(
      revisoreEsito === "letto" &&
        perf?.motivazione === ripiego &&
        !pezzoAschermo &&
        oltre.length === 0 &&
        Boolean(avviso) &&
        cliente.chiamate.length === 3,
      `B4 · motivazione di ${lungo.length} caratteri: sostituita dal ripiego, il paragrafo non arriva a schermo, nessuna seconda chiamata` +
        ` [motivazione=${perf?.motivazione === ripiego ? "ripiego" : "ALTRA"} paragrafo_a_schermo=${pezzoAschermo ? "SÌ" : "no"} oltre_il_tetto=${oltre.length} avviso=${avviso ? "sì" : "no"} chiamate=${cliente.chiamate.length}]`,
    );
  }
}

// ───────────────────────────────── C · il corpus a mano contro il tetto
//
// DA DOVE VIENE IL NUMERO. 220 non è scelto in mezzo al nulla: è ancorato alle
// motivazioni SCRITTE A MANO in `scoring.ts`, la forma che consideriamo giusta.
// Se un giorno una di loro cresce oltre il tetto, il terminale la sostituirebbe
// con la riga generica — e lo studente perderebbe un testo buono per colpa di un
// numero tarato su un mondo che non c'è più. Questo controllo è il solo posto in
// cui quel legame è scritto: qui si misura il corpus vero, non un'idea del corpus.
function corpusAMano() {
  const src = fs.readFileSync(path.join(ROOT, "lib", "escape", "scoring.ts"), "utf8");
  // I letterali `motivazione: "…"` / `motivazione: \`…\``. Le interpolazioni si
  // sostituiscono con una stima generosa (venti caratteri per placeholder): una
  // stima al RIBASSO direbbe che il corpus sta nel tetto quando non ci sta, cioè
  // sbaglierebbe nella direzione comoda.
  const trovate = [];
  const re = /motivazione:\s*(`[^`]*`|"(?:[^"\\]|\\.)*")/g;
  let m;
  while ((m = re.exec(src))) {
    const testo = m[1].slice(1, -1).replace(/\$\{[^}]*\}/g, "X".repeat(20));
    trovate.push(testo);
  }
  const lunghezze = trovate.map((t) => t.length).sort((a, b) => b - a);
  ok(trovate.length >= 15, `C · il corpus a mano si legge: ${trovate.length} motivazioni cablate in scoring.ts`);
  ok(
    lunghezze.length > 0 && lunghezze[0] <= MAX_MOTIVAZIONE,
    lunghezze[0] <= MAX_MOTIVAZIONE
      ? `C · …e la più lunga (${lunghezze[0]} caratteri) sta nel tetto di ${MAX_MOTIVAZIONE}: il numero contiene la forma che consideriamo giusta`
      : `C · una motivazione cablata è SOPRA il tetto (${lunghezze[0]} > ${MAX_MOTIVAZIONE}): oggi uno studente ne riceverebbe la riga generica. Alza il tetto o accorcia quel testo`,
  );
  // L'altra metà: un tetto molto più alto del corpus non protegge da niente.
  // 2000 (quello che c'era prima del 29/09) è appunto il caso.
  ok(
    MAX_MOTIVAZIONE <= lunghezze[0] * 2,
    `C · …e non è tanto più alto del corpus (${MAX_MOTIVAZIONE} contro ${lunghezze[0]}): un tetto a 2000, come prima del 29/09, non era un tetto`,
  );
}

// ───────────────────────────────── D · la FORMA dei ripieghi
//
// PERCHÉ È SORVEGLIATA, e perché guarda TUTTI E QUATTRO invece che uno.
// Fino al 29/09 i ripieghi erano quattro frasi in tre file diversi, e tre su
// quattro erano nate nominando l'area — che il blocco delle aree sfiorate
// prefissa già («**Nome area** — testo»): il nome usciva due volte sulla stessa
// riga. Il quarto diceva «Segnale rilevato durante la missione.», lingua da
// radar in un riquadro che parla a un ragazzo di quello che ha fatto.
//
// La cura non è stata quattro sostituzioni ma UNA FORMA scritta accanto a loro
// (`RIPIEGHI_MOTIVAZIONE` in lib/escape/chiamaEscape.ts): «<Nome area> — Da <la
// cosa che hai fatto>.» Questo controllo la tiene ferma sui VALORI — li importa,
// non li cerca nel sorgente — così una frase nuova aggiunta là dentro deve
// rispettarla, e non può nascere nominando l'area: è successo tre volte perché
// nominarla sembra la cosa premurosa da fare.
//
// LA PREMESSA SI VERIFICA, non si dà per buona: «non ripetere il nome» ha senso
// solo perché `AreeSfiorate` lo prefissa già. Se quel componente smettesse, il
// controllo starebbe gridando su niente (regola già pagata il 19/09: un test che
// accetta una forma deve verificare la premessa su cui la accetta).
function formaDeiRipieghi() {
  const voci = Object.entries(RIPIEGHI_MOTIVAZIONE);
  ok(voci.length === 4, `D · i ripieghi vivono in un posto solo, e sono ${voci.length}`);

  for (const [chiave, testo] of voci) {
    ok(/^Da(l|lla)? /.test(testo), `D · «${chiave}» è un frammento che completa il nome dopo il trattino: «${testo}»`);
    ok(testo.endsWith("."), `D · «${chiave}» finisce con un punto`);
    ok(testo.length <= MAX_MOTIVAZIONE, `D · «${chiave}» sta sotto il tetto (${testo.length}/${MAX_MOTIVAZIONE})`);
    // Nessun nome d'area, in nessuna delle diciotto forme: è il difetto che la
    // forma esiste per chiudere.
    const nominata = AREE.find((a) => testo.includes(a.nome) || testo.includes(a.dalleParti));
    ok(!nominata, `D · «${chiave}» non nomina nessun'area${nominata ? ` (nomina «${nominata.nome}»)` : ""}`);
    ok(!/segnale rilevat/i.test(testo), `D · «${chiave}» non è lingua da radar`);
  }

  // I tre che non sono il terminale nominano il PROPRIO passo: è l'unica
  // informazione che il nome dell'area non sostituiva, e perderla renderebbe le
  // quattro frasi intercambiabili.
  ok(/proposta/i.test(RIPIEGHI_MOTIVAZIONE.proposta), "D · il ripiego della proposta nomina la proposta");
  ok(/riflessione/i.test(RIPIEGHI_MOTIVAZIONE.riflessione), "D · quello della riflessione nomina la riflessione");
  ok(/risposta/i.test(RIPIEGHI_MOTIVAZIONE.consegnaEvento), "D · quello della consegna nomina la risposta");

  // I tre punti di produzione li USANO, invece di riscriverli: senza questa
  // metà, la forma sarebbe ferma su quattro stringhe che nessuno legge più.
  const scoring = senzaCommenti(fs.readFileSync(path.join(ROOT, "lib", "escape", "scoring.ts"), "utf8"));
  const consegna = senzaCommenti(fs.readFileSync(path.join(ROOT, "lib", "eventi", "consegna.ts"), "utf8"));
  ok(/RIPIEGHI_MOTIVAZIONE\.missione/.test(scoring), "D · scoring.ts prende il terminale da lì");
  ok(/RIPIEGHI_MOTIVAZIONE\.proposta/.test(scoring), "D · …e così la proposta");
  ok(/RIPIEGHI_MOTIVAZIONE\.riflessione/.test(scoring), "D · …e la riflessione");
  ok(/RIPIEGHI_MOTIVAZIONE\.consegnaEvento/.test(consegna), "D · consegna.ts prende il suo da lì");
  // E nessuno dei due si tiene in casa un modo comodo di scrivere il nome di
  // un'area: `nomeArea` è uscito da scoring.ts insieme all'ultimo ripiego che
  // la nominava.
  ok(!/nomeArea/.test(scoring), "D · scoring.ts non ha più un helper che restituisce il nome di un'area");

  // La regola arriva anche all'AI, non solo ai ripieghi: la motivazione
  // scritta dal modello finisce nello stesso posto.
  ok(/NON NOMINARE L'AREA/.test(REGOLA_MOTIVAZIONE), "D · e il prompt dice al modello di non nominarla, con la sostituzione svolta");

  // La premessa: il componente che rende quella riga prefissa il nome dell'area.
  const areeSfiorate = fs.readFileSync(path.join(ROOT, "components", "escape", "AreeSfiorate.tsx"), "utf8");
  ok(/\{v\.nome\}<\/span> — \{v\.testo\}/.test(areeSfiorate), "D · premessa: AreeSfiorate rende «Nome area — testo», quindi un ripiego che nomina l'area la ripete");
}

(async () => {
  corpusAMano();
  formaDeiRipieghi();
  for (const m of MISSIONI) await perMissione(m.slug);

  console.log("");
  if (nonApplicabili > 0) console.log(`→ ${nonApplicabili} non applicabili (non passate: non si sono potute fare)`);
  if (falliti > 0) { console.error(`✗ ${falliti} verifiche fallite (${passati} superate)`); process.exit(1); }
  console.log(`✓ Tutte le ${passati} verifiche del revisore superate su ${MISSIONI.length} missioni.`);
})();
