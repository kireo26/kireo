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


// ── le tre liste ──────────────────────────────────────────────────────────
// Un fermato prodotto dal robot non è un cancello che morde. Il 2026-08-31 un
// ritentativo sulle scritture ha fatto arrivare un quinto messaggio al
// cliente, e il 429 che ne è seguito è finito nella lista che leggiamo per
// prima — quella da cui ricaviamo i difetti veri del prodotto.
const treListe = misura([
  { etichetta: "w > a", tappe: [], fermato: { dove: "pitch", perche: "la consegna è stata rifiutata (400)", gate: true } },
  { etichetta: "w > b", tappe: [], fermato: { dove: "?", perche: "fetch failed", guasto: true } },
  { etichetta: "w > c", tappe: [], fermato: { dove: "pitch", perche: "la chat ha risposto 429", doppio: true } },
]);
ok(treListe.fermati.length === 1 && treListe.fermati[0].etichetta === "w > a", "il cancello resta nella lista dei cancelli");
ok(treListe.caduti.length === 1 && treListe.caduti[0].etichetta === "w > b", "il guasto di rete resta nella lista dei guasti");
ok(treListe.respinti.length === 1 && treListe.respinti[0].etichetta === "w > c", "e la richiesta doppia sta in una lista sua: il difetto è del banco, non del prodotto");
ok(!treListe.fermati.some((f) => f.doppio) && !treListe.caduti.some((f) => f.doppio), "una richiesta doppia non compare anche nelle altre due: sporcherebbe l'unica lista che leggiamo per prima");

// La riga che ha reso possibile il difetto: il ritentativo su una scrittura.
const sessione = fs.readFileSync(path.join(ROOT, "scripts", "banco", "robot", "sessione.js"), "utf8");
ok(
  /metodo === "GET" \? await conUnRitentativo/.test(sessione),
  "il ritentativo vale solo in lettura: su una scrittura è un secondo invio, e il robot non può sapere se la prima è arrivata",
);


// ── la formula e i giudizi sono due problemi ──────────────────────────────
const dueProblemi = misura([
  {
    etichetta: "w > a",
    tappe: [
      { faseId: "t1", revisione: { commento_breve: "Hai capito quanto conta il margine." }, esitoRevisione: "riuscita", tentativi: 1 },
      { faseId: "t2", revisione: { commento_breve: "Questo è lavoro maturo." }, esitoRevisione: "riuscita", tentativi: 1 },
    ],
    fiduciaFinale: 60,
  },
]);
ok(dueProblemi.registro.filter((r) => r.formula).length === 1, "la formula sulla testa è marcata come tale");
ok(dueProblemi.registro.filter((r) => !r.formula).length === 1, "e «maturo» resta un giudizio, che è un altro problema");

// ── l'appello: ogni ruolo del piano compare in un esito ────────────────────
// La proprietà è generale, e per questo vale più della singola strada: quella
// del 13/09 (un ruolo lasciato per un tentativo che non poteva riuscire) è
// chiusa, la prossima arriverà da un'altra parte. Un confronto di conteggi la
// prende senza sapere da dove viene.
console.log("");
const { verificaCompletezza } = require("./banco/robot/misura");
const finito = (etichetta) => ({ etichetta, tappe: [], fiduciaFinale: 70 });
const bloccato = (etichetta, extra = {}) => ({ etichetta, tappe: [], fermato: { dove: "t1", perche: "…", ...extra } });

const cinque = ["w > a", "w > b", "w > c", "w > d", "w > e"];
const tutti = verificaCompletezza(
  [finito("w > a"), finito("w > b"), bloccato("w > c"), bloccato("w > d", { guasto: true }), bloccato("w > e", { doppio: true })],
  cinque,
);
ok(tutti.completa === true, "cinque ruoli nel piano e cinque esiti: appello completo");
ok(
  tutti.perCategoria.finito === 2 && tutti.perCategoria.fermato === 1 && tutti.perCategoria.caduto === 1 && tutti.perCategoria.respinto === 1,
  "…e ognuno cade in una sola delle quattro categorie",
);

const manca = verificaCompletezza([finito("w > a"), finito("w > b"), finito("w > c"), finito("w > d")], cinque);
ok(manca.completa === false, "se il piano dice cinque e gli esiti sono quattro, l'appello non è completo");
ok(manca.mancanti.length === 1 && manca.mancanti[0].etichetta === "w > e", "…e dice CHI manca, invece di lasciare il buco");

// Due trappole sullo stesso ruolo hanno la stessa etichetta: una verifica di
// sola presenza le vedrebbe come una, un conteggio no.
const doppia = verificaCompletezza([finito("w > a")], ["w > a", "w > a"]);
ok(!doppia.completa && doppia.mancanti[0].conEsito === 1 && doppia.mancanti[0].attesi === 2, "due giri sullo stesso ruolo si contano, non si confondono");

// Il caso che nessuno vedrebbe: un quinto stato aggiunto un domani e non messo
// in nessuna lista. Qui si simula con un esito che la classificazione non sa
// leggere — la somma delle quattro categorie non torna più.
const quintoStato = verificaCompletezza([finito("w > a"), { etichetta: "w > b", tappe: [] }], ["w > a", "w > b"]);
ok(quintoStato.copertiDalleListe === quintoStato.esiti, "oggi le quattro categorie coprono tutto: la somma torna");

const senzaPiano = verificaCompletezza([finito("w > a")], null);
ok(senzaPiano.noto === false, "senza il piano la completezza non si può dire");
ok(senzaPiano.completa === undefined, "…e non si dichiara completa per difetto: «non posso vederlo» ≠ «vanno tutti bene»");

// E che il piano ci arrivi davvero: un parametro nuovo con un default è il
// posto in cui un collegamento mancante si nasconde (la lezione di
// `registra_guardia_lingua`, che per settimane ha contato tutto come
// produzione perché nessuno le passava il secondo argomento).
const robotIndex = fs.readFileSync(path.join(ROOT, "scripts/banco/robot/index.js"), "utf8");
ok(/misura\(esiti,\s*piano\./.test(robotIndex), "il robot passa il piano alla misura, non solo gli esiti");

// ── lo stato che non dovrebbe esistere ─────────────────────────────────────
// `sconosciuto` stava in fondo a una riga di percentuali, in mezzo ai numeri
// che dicono quanto bene sono andati i revisori, dove si legge come rumore. Il
// 13/09 quell'1 (5.0%) era una tappa AVANZATA senza esito registrato:
// indistinguibile da una riuscita, e invisibile alla query che cerca i guasti.
console.log("");
const senzaEsito = misura([
  {
    etichetta: "enoteca-centocelle > marketing",
    iscrizioneId: "abc-123",
    fiduciaFinale: 64,
    tappe: [
      { faseId: "quartiere", esitoRevisione: null, tentativi: 0, revisione: { commento_breve: "La tabella regge." } },
      { faseId: "persone", esitoRevisione: "riuscita", tentativi: 1, revisione: { commento_breve: "Bene." } },
    ],
  },
]);
ok(senzaEsito.avanzateSenzaEsito.length === 1, "una tappa avanzata senza esito ha una lista sua, non una voce in una riga di percentuali");
ok(senzaEsito.avanzateSenzaEsito[0].faseId === "quartiere", "…che dice QUALE tappa");
ok(senzaEsito.avanzateSenzaEsito[0].iscrizioneId === "abc-123", "…e su quale iscrizione: senza quelle due cose non si va a guardare niente");
ok(senzaEsito.esitiRevisione.sconosciuto === 1, "resta contata anche fra gli esiti: i conti delle tappe giocate devono tornare");

// La differenza che la distingue del tutto: una tappa mai revisionata ha
// `revisione` null ed è già fra i fermati, col suo perché. Metterla anche qui
// vorrebbe dire chiamare «stato che non dovrebbe esistere» una cosa normale.
const maiRevisionata = misura([
  {
    etichetta: "w > a",
    iscrizioneId: "def-456",
    tappe: [{ faseId: "pitch", esitoRevisione: null, tentativi: 0, revisione: null }],
    fermato: { dove: "pitch", perche: "dopo 6 giri di cron la tappa è ancora «consegnata»" },
  },
]);
ok(maiRevisionata.avanzateSenzaEsito.length === 0, "una tappa MAI revisionata non entra in quella lista: è già fra i fermati, col suo perché");
ok(maiRevisionata.fermati.length === 1, "…e ci resta");

// La riga deve arrivare a schermo, e in alto: una lista che nessuno stampa è
// una lista che non esiste.
const { stampaRapporto } = require("./banco/robot/misura");
const righe = [];
stampaRapporto(senzaEsito, (t = "") => righe.push(t));
const testo = righe.join("\n");
ok(/UNA TAPPA È AVANZATA SENZA UN ESITO REGISTRATO: 1/.test(testo), "il rapporto la stampa con il suo nome");
ok(/quartiere.*abc-123/.test(testo), "…nominando la tappa e l'iscrizione");
ok(
  testo.indexOf("UNA TAPPA È AVANZATA") < testo.indexOf("REVISORI:"),
  "e la stampa PRIMA della tabella dei revisori: non è un revisore andato male, è una tappa senza verdetto",
);

// ── prima si guarda se si può entrare, poi si lascia ───────────────────────
// Questo non si prova senza rete: è una chiamata a Supabase dentro una
// funzione async. Ma la proprietà che conta è un ORDINE fra due righe, e
// quello si legge. Il 13/09 il robot ha lasciato un ruolo attivo e SOLO DOPO
// ha scoperto che quello nuovo era già completato: uno stato cambiato per un
// tentativo che non poteva riuscire, e invisibile nel rapporto perché
// formalmente non era successo niente. Se una passata si interrompe fra i due
// momenti, quel ruolo resta lasciato senza che nessuno l'abbia voluto.
console.log("");
const gioca = fs.readFileSync(path.join(ROOT, "scripts/banco/robot/gioca.js"), "utf8");
const iSiFerma = gioca.indexOf("niente da rigiocare");
// Si ancora alla CHIAMATA, non al nome della funzione: quel nome compare
// anche nell'elenco dei gesti in testa al file, e la prima stesura di questo
// controllo trovava quello — dava rosso su un codice giusto, che è il modo
// più sicuro di farsi disattivare.
const iLascia = gioca.indexOf('supabase.rpc("ritira_iscrizione_workshop"');
ok(iSiFerma !== -1 && iLascia !== -1, "il robot sa fermarsi su un ruolo completato e sa lasciarne uno");
ok(iSiFerma < iLascia, "e si ferma PRIMA di lasciare: non cambia uno stato per un tentativo che non può riuscire");
ok(
  gioca.split("niente da rigiocare").length - 1 === 1,
  "la condizione «già completato» sta in un punto solo: due copie divergono",
);

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Il piano dice quanto costa, e la misura dice cosa è successo.\n");
