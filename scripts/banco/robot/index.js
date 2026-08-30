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
// Le trappole stanno in una cartella loro: un ruolo per file, così ognuna si
// lancia da sola. Vanno lette esplicitamente — un `readdirSync` piatto sulla
// cartella padre non le vedrebbe, e il file finirebbe ignorato in silenzio
// (il modo peggiore di fallire: «nessun ruolo corrisponde» invece di un
// errore).
const DIR_TRAPPOLE = path.join(DIR_CONSEGNE, "trappole");

function fileConsegne() {
  const elenco = [];
  for (const dir of [DIR_CONSEGNE, DIR_TRAPPOLE]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".json")) elenco.push(path.join(dir, f));
  }
  return elenco;
}

// Il piano della passata: quali ruoli, e quanto costa. Puro, così il conto si
// può provare senza toccare la rete (vedi npm run test:robot).
// UNA TRAPPOLA NON ENTRA NELLA PASSATA COMPLETA, e non è una questione di
// conti. Gira sullo stesso ruolo di una `base` con una consegna diversa:
// nella stessa passata sarebbero due iscrizioni sullo stesso workshop per lo
// stesso account, e la seconda troverebbe la prima già completata. Le trappole
// si lanciano per nome, una alla volta — `npm run banco robot defibrillatore`
// — che è anche il modo in cui si vuole rileggerle.
function costruisciPiano(filtro) {
  const lavori = [];
  for (const f of fileConsegne()) {
    const dati = JSON.parse(fs.readFileSync(f, "utf8"));
    const definizioni = WORKSHOP_ELABORATO[dati.workshop];
    if (!definizioni) continue;
    for (const [ruoloSlug, consegne] of Object.entries(dati.ruoli ?? {})) {
      const def = definizioni[ruoloSlug];
      if (!def) continue;
      // Una trappola ha un nome suo, e il filtro deve poterla prendere per
      // quello: «npm run banco robot defibrillatore».
      const etichetta = `${dati.workshop} > ${ruoloSlug}`;
      // Una trappola si prende SOLO per il suo nome o per il suo file, mai per
      // il workshop o il ruolo: chi scrive «palestra» vuole i cinque ruoli
      // base, e trovarsi dentro anche una trappola sarebbe una sorpresa a
      // pagamento. `defibrillatore` la prende, `palestra` no.
      const trappola = consegne.livello === "trappola";
      const cercabile = (trappola ? `${consegne.nome ?? ""} ${path.basename(f, ".json")}` : etichetta).toLowerCase();
      if (!filtro && trappola) continue;
      if (filtro && !cercabile.includes(String(filtro).toLowerCase())) continue;
      // 2 chiamate per tappa (revisione + reazione) + la chat minima, e un
      // feedback finale sull'ultima.
      const chiamate = def.fasi.reduce((somma, fase) => somma + 2 + fase.chatMinima + (fase.ultima ? 1 : 0), 0);
      lavori.push({
        workshopSlug: dati.workshop,
        ruoloSlug,
        etichetta,
        consegne,
        fasi: def.fasi,
        chiamate,
        livello: consegne.livello,
        trappola,
        nome: consegne.nome ?? null,
        atteso: consegne.atteso ?? null,
      });
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
  for (const l of piano.lavori) console.log(`  · ${l.etichetta}${l.livello === "trappola" ? `   [trappola: ${l.nome ?? "senza nome"}]` : ""}`);
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
        // Una trappola è per definizione un secondo giro sullo stesso ruolo:
        // il rifiuto «già completato», che protegge la misura dal contare due
        // volte gli stessi testi, qui non si applica.
        rigioca: Boolean(lavoro.trappola),
        registra: (t) => console.log(t),
      });
      if (esito.fermato) console.log(`  ✗ fermato a «${esito.fermato.dove}»: ${esito.fermato.perche}`);
      esiti.push({ ...esito, nome: lavoro.nome, atteso: lavoro.atteso });
    } catch (errore) {
      console.log(`  ✗ eccezione: ${errore.message}`);
      esiti.push({ etichetta: lavoro.etichetta, nome: lavoro.nome, atteso: lavoro.atteso, tappe: [], fermato: { dove: "?", perche: errore.message } });
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
