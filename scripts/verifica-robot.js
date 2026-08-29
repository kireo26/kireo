// Verifica delle parti del robot che si possono provare senza rete.
//
// Sono due, e sono quelle che decidono: il PIANO (quanto sta per spendere, e
// su cosa) e la MISURA (cosa dice dei testi raccolti). Il resto — l'iscrizione,
// la chat, la consegna — vive contro un sito vero e si prova giocando.
//
// Esecuzione: `npm run test:robot`.

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

const { costruisciPiano } = require("./banco/robot");
const { misura } = require("./banco/robot/misura");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

console.log("\n═══ Il robot: il piano e la misura ═══\n");

// ── il piano ──────────────────────────────────────────────────────────────
const tutto = costruisciPiano();
ok(tutto.lavori.length === 25, `il piano completo copre 25 ruoli (ne trova ${tutto.lavori.length})`);
ok(tutto.tappe === 100, `100 tappe (ne trova ${tutto.tappe})`);
ok(tutto.chiamate === 550, `550 chiamate stimate (ne conta ${tutto.chiamate})`);

const solaPalestra = costruisciPiano("palestra");
ok(solaPalestra.lavori.length === 5, "il filtro «palestra» prende i suoi cinque ruoli");
ok(solaPalestra.chiamate === 110, `…e ne stima 110 chiamate (ne conta ${solaPalestra.chiamate})`);

const unRuolo = costruisciPiano("enoteca-centocelle > food");
ok(unRuolo.lavori.length === 1 && unRuolo.lavori[0].ruoloSlug === "food", "il filtro può stringersi a un ruolo solo");
ok(unRuolo.chiamate === 22, `un ruolo costa 22 chiamate: 4 tappe × 2 + 13 di chat + 1 finale (ne conta ${unRuolo.chiamate})`);

ok(costruisciPiano("non-esiste").lavori.length === 0, "un filtro che non prende niente non prende niente");

// Il conto deve venire dal MOTORE, non da un numero copiato: se una tappa
// cambiasse `chatMinima`, il piano deve cambiare con lei.
const { WORKSHOP_ELABORATO } = require("@/lib/workshop/elaborato-config");
const attese = Object.values(WORKSHOP_ELABORATO).reduce(
  (s, ruoli) => s + Object.values(ruoli).reduce((r, def) => r + def.fasi.reduce((f, fase) => f + 2 + fase.chatMinima + (fase.ultima ? 1 : 0), 0), 0),
  0,
);
ok(tutto.chiamate === attese, "il conto delle chiamate è calcolato dal config, non scritto a mano");

// ── la misura ─────────────────────────────────────────────────────────────
console.log("");
const esitiFinti = [
  {
    etichetta: "w > uno",
    fiduciaFinale: 71,
    tappe: [
      { faseId: "t1", esitoRevisione: "riuscita", tentativi: 1, revisione: { commento_breve: "Hai messo il corso al posto giusto." }, reazione: "Me piace." },
      { faseId: "t2", esitoRevisione: "riuscita", tentativi: 2, revisione: { commento_breve: "Sei partito dal realismo." }, reazione: null },
    ],
    feedbackFinale: { messaggio_chiusura: "Lo studente lo nomina, il che è onesto." },
  },
  {
    etichetta: "w > due",
    fiduciaFinale: 68,
    tappe: [{ faseId: "t1", esitoRevisione: "non_riuscita", tentativi: 3, revisione: null, reazione: null }],
    fermato: { dove: "t2", perche: "la consegna è stata rifiutata (400): sezioni incomplete", gate: true },
  },
];
const m = misura(esitiFinti);

ok(m.testi === 4, `conta i testi veri, non le tappe: 2 revisioni + 1 reazione + 1 feedback = 4 (ne conta ${m.testi})`);
// La cattura torna normalizzata in minuscolo dalla scansione condivisa: si
// confronta senza distinzione di maiuscole, altrimenti il test è sul modo in
// cui lo strumento formatta e non su quello che trova.
ok(m.accordi.length === 1 && /sei partito/i.test(m.accordi[0].cattura), "trova la forma accordata, e dice in quale testo sta");
ok(m.accordi[0].dove.includes("t2"), "…con la provenienza, perché un numero senza il testo non si rilegge");
ok(m.registro.length === 1 && /studente/.test(m.registro[0].cattura), "trova la terza persona sul feedback finale");
ok(m.esitiRevisione.riuscita === 2 && m.esitiRevisione.non_riuscita === 1, "conta gli esiti dei revisori per come li marca il motore");
ok(m.tappeConTentativiExtra === 2, "conta le tappe che hanno avuto bisogno di più di un giro: sono giorni di attesa");
ok(m.fermati.length === 1 && m.fermati[0].gate === true, "un gate che morde resta marcato come tale, non come un errore qualunque");
ok(m.fiducia[0].valore === 68 && m.fiducia[1].valore === 71, "la fiducia è ordinata dal più basso: si guarda chi sta peggio");

// Una tappa già fatta (ripresa di una passata interrotta) non deve inquinare
// i conti degli esiti: non è stata giocata adesso.
const conRipresa = misura([{ etichetta: "w > tre", tappe: [{ faseId: "t1", giaFatta: true, tentativi: 0 }], fiduciaFinale: 50 }]);
ok(Object.keys(conRipresa.esitiRevisione).length === 0, "una tappa già revisionata in una passata precedente non entra nei conti");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Il piano dice quanto costa, e la misura dice cosa è successo.\n");
