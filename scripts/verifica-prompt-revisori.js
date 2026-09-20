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

// ── IL FEEDBACK FINALE HA UN MATERIALE SOLO ──────────────────────────────────
// Per due giorni ha ricevuto anche le domande al cliente, e il 14/09 ne è
// uscito INSIEME alla riga che gliele faceva desiderare — «valorizza la crescita
// lungo il percorso», che è il mestiere del blocco «come hai lavorato».
// Togliere il materiale lasciando l'istruzione sarebbe stato curare la fame
// togliendo il piatto: il modello avrebbe riscritto in astratto quello che non
// poteva più leggere, che è esattamente il difetto di agosto.
//
// Quindi le due metà si sorvegliano insieme: se una rientra senza l'altra,
// questo test lo dice.
ok(
  finale.includes("basandoti su ciò che ha consegnato (te lo passo come messaggio)"),
  "il feedback finale dichiara il suo unico materiale: quello che lo studente ha consegnato",
);
ok(
  !finale.includes("domande_al_cliente") && !finale.includes("progetto_consegnato"),
  "e non nomina nessuna seconda parte del messaggio, che non riceve",
);
ok(!finale.includes("domande"), "le domande al cliente non compaiono mai nel prompt del feedback finale");
ok(
  !finale.includes("Valorizza la crescita lungo il percorso"),
  "e non gli si chiede più la crescita lungo il percorso: è il mestiere del blocco, che ha il materiale per farlo",
);

// ── LA SCALA DEL PUNTEGGIO DI TAPPA ──────────────────────────────────────────
// Fino al 20/09 il campo `punteggio_fiducia` non aveva nessuna rubrica: «intero
// da 0 a 25, quanto ha convinto Tonino» e basta. Su 486 punteggi in archivio il
// revisore ha usato solo 8-22, con l'84% dentro quattro valori. Queste
// asserzioni difendono le due cose che possono tornare indietro da sole: che le
// fasce spariscano, e che i TETTI spariscano lasciando le fasce — che è il caso
// peggiore, perché il prompt sembrerebbe ancora a posto mentre il modello
// tornerebbe a scegliere quella di mezzo.
const FASCE = ["0-5", "6-11", "12-17", "18-22", "23-25"];
for (const f of FASCE) ok(tappa.includes(`- ${f} —`), `la fascia ${f} è descritta nel prompt della revisione`);

ok(tappa.includes("misura quanto il lavoro consegnato REGGE, non quanto è scritto bene"), "il punteggio dichiara cosa misura");
ok(tappa.includes("deve essere difendibile con una citazione"), "tetto 1: senza una frase da citare, la fascia è quella sotto");
ok(tappa.includes("non costa niente non può superare 17"), "tetto 2: la sezione difficile che non costa niente ferma a 17");
ok(tappa.includes("senza nessuna cifra e senza nessun caso concreto non può superare 11"), "tetto 3: senza cifre e senza casi si resta sotto 12");
ok(tappa.includes("17 non è un valore di cortesia"), "e il valore di mezzo è dichiarato non-di-cortesia");

// Il commento sul campo non deve più descrivere il punteggio per conto suo:
// erano due posti che dicono cosa misura, e uno dei due sarebbe quello vecchio.
ok(
  tappa.includes("secondo le fasce e i tetti scritti sopra"),
  "il commento del campo rimanda alla scala invece di dare una seconda definizione",
);

// I confini si CALCOLANO da fiduciaMax. Oggi vale 25 per tutte e 100 le tappe,
// ma il campo è parametrico: scritte a mano, le fasce direbbero «18-22» su un
// massimo di 20 senza che nessuno se ne accorga.
const venti = promptRevisore({ ...CTX, fiduciaMax: 20 });
ok(venti.includes("IL PUNTEGGIO DI QUESTA TAPPA (0-20)"), "con fiduciaMax 20 la scala si annuncia su 20");
ok(venti.includes("- 19-20 —"), "…e l'ultima fascia arriva esattamente al massimo");
ok(!venti.includes("23-25") && !venti.includes("18-22"), "…e nessuna fascia scritta per il 25 sopravvive a un massimo diverso");

// Il feedback finale ha un ALTRO numero (punteggio_area, 0-100): queste fasce
// lì sarebbero la stessa definizione applicata a una grandezza diversa.
ok(!finale.includes("IL PUNTEGGIO DI QUESTA TAPPA"), "la scala di tappa non è finita nel feedback finale, che misura un'altra cosa");

// Nessun esempio copiabile: una frase compiuta dentro il prompt viene
// ricopiata, non imitata — e nel ricopiarla si rompe.
ok(!tappa.includes("puoi colmarlo tornando su"), "nel prompt non è tornato un esempio di frase da riusare");
ok(!tappa.includes("corso donne di sera"), "nel prompt non è tornato un fatto di un workshop solo");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Le regole comuni stanno in un posto solo, e arrivano a tutti e due.\n");
