// `npm run banco robot [filtro] [--vai]` — il secondo pezzo del banco.
//
// Gioca i workshop come uno studente, dall'iscrizione al feedback finale, e
// alla fine misura i testi che i revisori hanno scritto.
//
// TRE COSE CHE VALGONO PIÙ DEL CODICE, e stanno qui perché chi lo apre le
// legga prima di modificarlo:
//
// 1. DALLA PORTA. Sessione vera, le stesse route, gli stessi gate. Se un gate
//    blocca il robot, il robot SI FERMA E LO RIPORTA: non riempie una sezione
//    per passare, non inventa un messaggio, non aggira un cooldown. La
//    scoperta migliore del 30 agosto è venuta da un gate che ha morso.
// 2. NON PARTE SU UN ACCOUNT VERO. Il flag `profiles.di_prova` si controlla
//    prima di scrivere qualunque cosa (vedi sessione.js): le righe scritte da
//    un account non marcato non si distinguono più, mai.
// 3. DICE QUANTO SPENDE PRIMA DI PARTIRE. Oltre cinquecento chiamate a giro
//    non sono una cosa che parte per sbaglio.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..", "..", "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
if (!require.extensions[".ts"]) {
  require.extensions[".ts"] = function (mod, filename) {
    const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
      fileName: filename,
    });
    return mod._compile(out.outputText, filename);
  };
}

const { WORKSHOP_ELABORATO } = require("@/lib/workshop/elaborato-config");
const { apriSessione } = require("./sessione");
const { giocaRuolo } = require("./gioca");
const { misura, stampaRapporto } = require("./misura");

const DIR_CONSEGNE = path.join(ROOT, "scripts", "banco", "consegne");

// Il piano della passata: quali ruoli, e quanto costa. Puro, così il conto si
// può provare senza toccare la rete (vedi npm run test:robot).
function costruisciPiano(filtro) {
  const lavori = [];
  const files = fs.existsSync(DIR_CONSEGNE) ? fs.readdirSync(DIR_CONSEGNE).filter((f) => f.endsWith(".json")) : [];
  for (const f of files) {
    const dati = JSON.parse(fs.readFileSync(path.join(DIR_CONSEGNE, f), "utf8"));
    const definizioni = WORKSHOP_ELABORATO[dati.workshop];
    if (!definizioni) continue;
    for (const [ruoloSlug, consegne] of Object.entries(dati.ruoli ?? {})) {
      const def = definizioni[ruoloSlug];
      if (!def) continue;
      const etichetta = `${dati.workshop} > ${ruoloSlug}`;
      if (filtro && !etichetta.toLowerCase().includes(String(filtro).toLowerCase())) continue;
      // 2 chiamate per tappa (revisione + reazione) + la chat minima, e un
      // feedback finale sull'ultima.
      const chiamate = def.fasi.reduce((somma, fase) => somma + 2 + fase.chatMinima + (fase.ultima ? 1 : 0), 0);
      lavori.push({ workshopSlug: dati.workshop, ruoloSlug, etichetta, consegne, fasi: def.fasi, chiamate, livello: consegne.livello });
    }
  }
  return {
    lavori,
    chiamate: lavori.reduce((s, l) => s + l.chiamate, 0),
    tappe: lavori.reduce((s, l) => s + l.fasi.length, 0),
  };
}

function chiediConferma(domanda) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(domanda, (a) => { rl.close(); r(a.trim().toLowerCase()); }));
}

async function robot(filtro, opzioni = {}) {
  const piano = costruisciPiano(filtro);

  if (piano.lavori.length === 0) {
    console.log(filtro ? `\nNessun ruolo corrisponde a «${filtro}».\n` : "\nNessun file di consegne in scripts/banco/consegne.\n");
    return;
  }

  console.log(`\n═══════════ LA PASSATA ═══════════\n`);
  console.log(`  ${piano.lavori.length} ruoli, ${piano.tappe} tappe`);
  console.log(`  ~${piano.chiamate} chiamate AI a pagamento`);
  console.log(`  (2 per tappa — revisione e reazione del cliente — più la chat minima,`);
  console.log(`   più un feedback finale per ruolo)\n`);
  for (const l of piano.lavori) console.log(`  · ${l.etichetta}${l.livello === "trappola" ? "   [trappola]" : ""}`);
  console.log("\n  Il robot gioca come uno studente vero: se un gate lo blocca si ferma");
  console.log("  e lo riporta, invece di aggirarlo.\n");

  if (!opzioni.vai) {
    const risposta = await chiediConferma("Procedo? (scrivi «si») ");
    if (risposta !== "si" && risposta !== "sì") {
      console.log("Annullato: nessuna chiamata fatta.\n");
      return;
    }
  }

  const sessione = await apriSessione();
  console.log(`\n✓ sessione aperta come ${sessione.profilo.nome ?? sessione.utente.email} (profilo di prova)\n`);

  const esiti = [];
  for (const lavoro of piano.lavori) {
    console.log(`── ${lavoro.etichetta}`);
    try {
      const esito = await giocaRuolo({
        sessione,
        workshopSlug: lavoro.workshopSlug,
        ruoloSlug: lavoro.ruoloSlug,
        consegne: lavoro.consegne,
        fasi: lavoro.fasi,
        registra: (t) => console.log(t),
      });
      if (esito.fermato) console.log(`  ✗ fermato a «${esito.fermato.dove}»: ${esito.fermato.perche}`);
      esiti.push(esito);
    } catch (errore) {
      console.log(`  ✗ eccezione: ${errore.message}`);
      esiti.push({ etichetta: lavoro.etichetta, tappe: [], fermato: { dove: "?", perche: errore.message } });
    }
  }

  const m = misura(esiti);
  stampaRapporto(m);

  // Il rapporto grezzo su file: i testi si rileggono, e il numero senza il
  // testo accanto non serve a niente.
  const percorso = path.join(ROOT, `banco-robot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.json`);
  fs.writeFileSync(percorso, JSON.stringify({ piano: { ruoli: piano.lavori.length, chiamate: piano.chiamate }, esiti, misura: m }, null, 2));
  console.log(`Rapporto completo, con tutti i testi: ${path.basename(percorso)}`);
  console.log("(ignorato da git — è materiale da leggere, non da versionare)\n");
}

module.exports = { robot, costruisciPiano };
