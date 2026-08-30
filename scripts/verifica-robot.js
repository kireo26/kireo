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
const { verificaAtteso } = require("./banco/robot/atteso");

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


// ── le trappole ───────────────────────────────────────────────────────────
// Stanno in una sottocartella, e per un giorno il robot non le ha viste: un
// `readdirSync` piatto le saltava, e il filtro rispondeva «nessun ruolo
// corrisponde» invece di un errore. È il modo peggiore di fallire.
const trappole = costruisciPiano("defibrillatore");
ok(trappole.lavori.length === 1, `il filtro trova la trappola per nome, dentro la sua cartella (ne trova ${trappole.lavori.length})`);
ok(trappole.lavori[0]?.atteso?.tappa === "sicurezza", "…e si porta dietro l'atteso, altrimenti girerebbe senza verdetto");
ok(!tutto.lavori.some((l) => l.livello === "trappola"), "la passata completa NON le comprende: girano sullo stesso ruolo di una base, una alla volta");
ok(costruisciPiano("palestra").lavori.every((l) => l.livello !== "trappola"), "e un filtro per workshop non se le tira dietro a sorpresa: le trappole si chiamano per nome");

// Il verdetto. `FORMATO.md` prometteva «il robot dice se è stato colto» mentre
// il campo veniva solo validato nella forma: una trappola sarebbe girata
// producendo del testo da leggere e nient'altro.
const ATTESO = {
  tappa: "sicurezza",
  deve_comparire: ["defibrillatore", "BLSD"],
  non_deve_comparire_nei_punti_forza: ["ordine giusto"],
  fiducia_massima: 15,
};
const revisioneDi = (punti_forza, resto, punteggio) => ({
  tappe: [{ faseId: "sicurezza", revisione: { punti_forza, da_migliorare: [], domanda: "", commento_breve: resto, punteggio_fiducia: punteggio } }],
});

const colta = verificaAtteso(ATTESO, revisioneDi(["hai nominato le figure giuste"], "Manca il defibrillatore e nessuno ha il BLSD.", 12));
ok(colta.colta === true, "trappola COLTA: nomina quello che manca, non elogia l'ordine, e il punteggio sta sotto il tetto");

const elogia = verificaAtteso(ATTESO, revisioneDi(["hai l'ordine giusto"], "Manca il defibrillatore e il BLSD.", 12));
ok(elogia.colta === false, "NON colta se elogia l'ordine dei passaggi fra i punti di forza");

// La stessa parola fra i «da migliorare» è invece giusta: dire «l'ordine
// giusto non basta» è esattamente quello che vogliamo.
const critica = verificaAtteso(ATTESO, {
  tappe: [{ faseId: "sicurezza", revisione: { punti_forza: ["hai nominato le figure"], da_migliorare: ["l'ordine giusto non basta senza defibrillatore"], domanda: "", commento_breve: "manca il BLSD", punteggio_fiducia: 12 } }],
});
ok(critica.colta === true, "…ma criticare «l'ordine giusto» fra i da migliorare non è un elogio");

const generosa = verificaAtteso(ATTESO, revisioneDi(["hai nominato le figure"], "Manca il defibrillatore e il BLSD.", 21));
ok(generosa.colta === false, "NON colta se il punteggio della tappa supera il tetto");

const muta = verificaAtteso(ATTESO, revisioneDi(["ottimo protocollo"], "Va bene così.", 12));
ok(muta.colta === false && muta.controlli.filter((c) => !c.ok).length === 2, "NON colta se non nomina né defibrillatore né BLSD");

const fermato = verificaAtteso(ATTESO, { tappe: [] });
ok(fermato.colta === null, "se la tappa non è stata giocata il verdetto è «non lo so», mai «è andata bene»");

const arreso = verificaAtteso(ATTESO, { tappe: [{ faseId: "sicurezza", revisione: null, esitoRevisione: "non_riuscita" }] });
ok(arreso.colta === null && /non e stata revisionata|non è stata revisionata/.test(arreso.motivo), "un revisore che si è arreso non conta come trappola scampata");

// ── la cattura si legge, e il titolo non conclude ──────────────────────────
// Il primo giro vero ha dato 4 catture e 4 falsi positivi: la misura pubblicava
// 33% dove il vero era 0. Il contorno è quello che li faceva vedere in tre
// secondi invece che aprendo il JSON.
const conContorno = misura([
  {
    etichetta: "w > salute",
    tappe: [{ faseId: "t1", revisione: { commento_breve: "Il punto è che a quell'ora il defibrillatore parla da solo e nessuno lo sente." }, esitoRevisione: "riuscita", tentativi: 1 }],
    fiduciaFinale: 60,
  },
]);
ok(conContorno.accordi.length === 1, "trova «da solo» anche quando non è rivolto a chi legge: i pattern sono larghi apposta");
ok(/defibrillatore/.test(conContorno.accordi[0].contesto), "la cattura arriva con la frase intorno, non da sola");
ok(conContorno.accordi[0].certa === false, "«da solo» NON è della classe affidabile: va letta prima di contarla");

const certa = misura([
  { etichetta: "w > salute", tappe: [{ faseId: "t1", revisione: { commento_breve: "Quando sei arrivato al protocollo hai tenuto duro." }, esitoRevisione: "riuscita", tentativi: 1 }], fiduciaFinale: 60 },
]);
ok(certa.accordi[0]?.certa === true, "il participio con «essere» in seconda persona è la classe che falsi positivi non ne fa");


// ── dove si concentrano, e quanto costano ─────────────────────────────────
// La prima passata completa ha mostrato che il feedback finale è cinque volte
// più esposto delle revisioni e che la reazione del cliente non sbaglia mai:
// quel numero dice quale prompt toccare, e a mano non lo rifà nessuno.
const perGenere = misura([
  {
    etichetta: "w > salute",
    tappe: [
      { faseId: "t1", revisione: { commento_breve: "Quando sei arrivato al piano hai tenuto duro." }, reazione: "Il forno cuoce da solo.", esitoRevisione: "riuscita", tentativi: 1 },
      { faseId: "t2", revisione: { commento_breve: "La tabella regge." }, esitoRevisione: "riuscita", tentativi: 1 },
    ],
    feedbackFinale: { messaggio_chiusura: "Hai capito che il margine non è uno spreco, e sei partito da lì." },
    fiduciaFinale: 70,
  },
]);
ok(perGenere.perGenere["revisione"].testi === 2, "conta i testi per genere: due revisioni");
ok(perGenere.perGenere["feedback finale"].certe === 1, "e attribuisce la forma accordata al genere di testo giusto");
ok(perGenere.perGenere["reazione del cliente"].accordi === 1 && perGenere.perGenere["reazione del cliente"].certe === 0, "«da solo» nella reazione resta una cattura da leggere, non una certa");
ok(perGenere.perGenere["feedback finale"].registro === 1, "il verdetto «hai capito» finisce sul feedback finale, dove è stato scritto");
ok(perGenere.testiConAccordo === 3 && perGenere.testiConRegistro === 1, "conta i TESTI con almeno una cattura: sono le seconde chiamate che non sono servite");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Il piano dice quanto costa, e la misura dice cosa è successo.\n");
