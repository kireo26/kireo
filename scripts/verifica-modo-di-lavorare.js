// Il blocco sul modo di lavorare: le proprietà che non dipendono dal modello.
//
// PERCHÉ ESISTE. Il blocco dice a un ragazzo cosa si vede di come lavora e
// dove quel modo di fare si usa. Quasi tutto quello che conta lì dentro lo
// scrive un modello, e di quello si giudica leggendo — la trappola
// `domande-sparse` serve a questo. Ma tre cose sono nostre e si possono
// pretendere in modo deterministico:
//
//   1. il PROMPT chiede la cosa giusta (afferma azioni, cita, può tacere,
//      conta solo ciò che si può ricontare, parla di mestieri e non di
//      persone) e NON contiene un esemplare di frase da ricopiare;
//   2. il LETTORE della risposta rifiuta la forma incoerente — in
//      particolare «dove porta» pieno con «quello che si vede» vuoto, che è
//      una direzione affermata senza niente sotto: l'invenzione nella sua
//      forma più difficile da riconoscere leggendo;
//   3. l'attribuzione delle domande alla tappa è vera o è `null`, mai una
//      tappa plausibile — perché il blocco su quel dato ci CONTA, e un numero
//      che il lettore non può rifare gli toglie fiducia in tutto il resto.
//
// Esecuzione: `npm run test:modo`.

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

const { promptModoDiLavorare } = require("@/lib/workshop/prompt-revisore");
const { leggiModoDiLavorare } = require("@/lib/workshop/elaboratoValore");
const { raggruppaDomandePerTappa } = require("@/lib/workshop/chatTappa");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

const CTX = {
  workshopTitolo: "Apri una palestra popolare",
  ruoloTitolo: "Responsabile attività e benessere",
  clienteNome: "Tonino",
};
const DOMANDE = [
  { tappa: "Tappa 1 — Il quartiere e il programma", testo: "Tonino, il riscaldamento d'inverno quanto ti viene al mese?" },
  { tappa: "Tappa 4 — Il pitch", testo: "Quante ore al giorno riesci a stare aperto?" },
];

console.log("\n═══ Il blocco sul modo di lavorare ═══\n");

// ── 1) il prompt chiede la cosa giusta ──────────────────────────────────────
console.log("─── il prompt");
const p = promptModoDiLavorare(CTX, DOMANDE);

const CHIEDE = [
  ["la regola unica: azioni, mai il motivo", "non affermi MAI il MOTIVO di un'azione"],
  ["cita, non raccontare", "con le parole ESATTE dello studente"],
  ["i numeri solo dove si possono ricontare", "chi legge può ricontare"],
  ["il mestiere, non l'etichetta sulla persona", "PARLA DEL MESTIERE, MAI DELLA PERSONA"],
  ["i mestieri con le parole di un ragazzo", "non con i nomi di un ordinamento didattico"],
  ["può tacere, ed è un esito", 'lascia "quello_che_si_vede" e "dove_porta" VUOTI'],
  ["il silenzio va spiegato", "non è un giudizio"],
  ["nessun punteggio", "NON DARE NESSUN PUNTEGGIO"],
];
for (const [nome, frase] of CHIEDE) ok(p.includes(frase), nome);

// Il criterio del silenzio è una soglia, non un'impressione: la stessa già in
// uso nel caso D del finale di Escape (una scelta sola vale 0,333, due volte
// è una direzione).
ok(p.includes("almeno DUE domande citabili"), "il criterio per tacere è una soglia dichiarata, non un'impressione");

// Le domande arrivano DENTRO il system prompt, con la loro tappa: senza il
// materiale davanti il modello non può citare alla lettera, e senza la tappa
// non può dire «tutte e due nell'ultima» — cioè le due proprietà per cui il
// blocco esiste.
for (const d of DOMANDE) ok(p.includes(d.testo), `la domanda «${d.testo.slice(0, 30)}…» arriva letterale al modello`);
ok(p.includes("[Tappa 4 — Il pitch]"), "ogni domanda porta la tappa in cui è stata fatta");
ok(p.includes("le 2 domande"), "il numero delle domande è quello vero, non una stima");

// Una tappa non attribuita non diventa una tappa plausibile: il prompt lo dice.
const senzaTappa = promptModoDiLavorare(CTX, [{ tappa: null, testo: "Gli spogliatoi quanti sono?" }]);
ok(!senzaTappa.includes("[null]") && !senzaTappa.includes("[undefined]"), "una tappa sconosciuta non stampa un segnaposto");
ok(senzaTappa.includes("NON dire in quale tappa"), "e al modello è detto di non inventarla");

// Il progetto non gli arriva: giudicarlo è di un altro, e più materiale è più
// spazio per costruire uno schema che non c'è.
ok(p.includes("NON ricevi il progetto consegnato"), "il blocco non riceve il progetto e lo sa");

// La regola di casa sugli esempi: si descrive la FORMA, non se ne consegna un
// esemplare — una frase compiuta dentro un prompt viene ricopiata, e nel
// ricopiarla si rompe. La frase di Mario sul silenzio è il modello della
// forma; qui dentro NON deve esserci.
ok(
  !p.includes("erano sparse su cose diverse") && !p.includes("Dopo il secondo workshop"),
  "nessun esemplare di frase da ricopiare: del silenzio è descritta la forma",
);

// ── 2) il feedback finale non fa più il mestiere sulla persona ──────────────
console.log("\n─── il feedback finale, dopo");
const { promptFeedbackFinale } = require("@/lib/workshop/prompt-revisore");
const finale = promptFeedbackFinale(
  { ...CTX, tappaTitolo: "Tappa 4", tappaObiettivo: "…", clienteVincoli: "…", revisioneFocus: ["…"], fiduciaMax: 25, sezioni: [{ id: "a", titolo: "A" }], prossimaTappa: null },
  71,
  true,
);
ok(finale.includes("Tu giudichi il PROGETTO"), "al feedback finale è detto che il suo oggetto è il progetto");
ok(finale.includes('non «sei portato per»'), "e che non mette etichette sulla persona");

// ── 3) il lettore della risposta ────────────────────────────────────────────
console.log("\n─── il lettore della risposta");
const pieno = { quello_che_si_vede: ["Nella tappa 1 hai chiesto «…»"], dove_porta: ["Chi fa l'educatore in un doposcuola…"], cosa_non_si_vede_ancora: "Queste domande non dicono ancora…" };
ok(leggiModoDiLavorare(pieno) !== null, "un blocco completo si legge");

const silenzio = { quello_che_si_vede: [], dove_porta: [], cosa_non_si_vede_ancora: "Non emerge ancora un modo tuo…" };
const letto = leggiModoDiLavorare(silenzio);
ok(letto !== null && letto.quello_che_si_vede.length === 0, "IL SILENZIO È UN ESITO VALIDO: due liste vuote passano");

// LA PROPRIETÀ CHE CONTA: una direzione affermata senza niente sotto.
ok(
  leggiModoDiLavorare({ quello_che_si_vede: [], dove_porta: ["Chi fa l'infermiere…"], cosa_non_si_vede_ancora: "…" }) === null,
  "«dove porta» senza «quello che si vede» è rifiutato: è una direzione senza niente sotto",
);
ok(
  leggiModoDiLavorare({ quello_che_si_vede: ["  ", ""], dove_porta: ["Chi fa…"], cosa_non_si_vede_ancora: "…" }) === null,
  "e nemmeno riempiendo «quello che si vede» di stringhe vuote",
);
ok(
  leggiModoDiLavorare({ quello_che_si_vede: ["…"], dove_porta: [], cosa_non_si_vede_ancora: "" }) === null,
  "un silenzio senza spiegazione è rifiutato: sarebbe una schermata con niente sotto un titolo",
);
ok(leggiModoDiLavorare({ quello_che_si_vede: ["…"], dove_porta: [] }) === null, "manca «cosa non si vede ancora»: rifiutato");
ok(leggiModoDiLavorare({ quello_che_si_vede: "una stringa", dove_porta: [], cosa_non_si_vede_ancora: "…" }) === null, "una stringa al posto di una lista: rifiutato");
ok(leggiModoDiLavorare(null) === null && leggiModoDiLavorare("{}") === null, "niente e una stringa: rifiutati senza eccezioni");

// ── 4) l'attribuzione delle domande alla tappa ──────────────────────────────
console.log("\n─── la tappa di ogni domanda");
const TAPPE = [
  { titolo: "Tappa 1", apertaAt: "2026-09-01T10:00:00Z" },
  { titolo: "Tappa 2", apertaAt: "2026-09-05T10:00:00Z" },
  { titolo: "Tappa 3", apertaAt: null }, // mai aperta
];
const CHAT = [
  { testo: "prima di tutto", createdAt: "2026-08-30T09:00:00Z" },
  { testo: "dentro la 1", createdAt: "2026-09-02T09:00:00Z" },
  { testo: "esattamente all'apertura della 2", createdAt: "2026-09-05T10:00:00Z" },
  { testo: "dentro la 2", createdAt: "2026-09-06T09:00:00Z" },
];
const grup = raggruppaDomandePerTappa(CHAT, TAPPE);
ok(grup[0].tappa === null, "una domanda anteriore alla prima tappa non riceve una tappa inventata");
ok(grup[1].tappa === "Tappa 1", "una domanda dentro la tappa 1 è attribuita alla tappa 1");
ok(grup[2].tappa === "Tappa 2", "una domanda all'istante dell'apertura appartiene alla tappa che si apre");
ok(grup[3].tappa === "Tappa 2", "e non scivola su una tappa mai aperta");
ok(grup.map((g) => g.testo).join("|") === CHAT.map((c) => c.testo).join("|"), "l'ordine cronologico si conserva");
ok(raggruppaDomandePerTappa(CHAT, []).every((g) => g.tappa === null), "senza righe di stato nessuna domanda riceve una tappa");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Il blocco chiede la cosa giusta, sa tacere, e non conta quello che non può contare.\n");
