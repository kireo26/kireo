// Verifica della GUARDIA sulla lingua invariante (lib/ai/chiamaJson.ts).
//
// La guardia rilegge la risposta di un revisore AI e, se contiene una forma
// accordata al genere di chi legge, ne richiede un'altra. Una volta sola.
// Il comportamento che conta più di tutti è quello del caso peggiore: se anche
// la seconda risposta è accordata, o fallisce, il feedback dello studente
// PARTE LO STESSO. Un test che non lo verifica lascerebbe che qualcuno, in
// buona fede, trasformi la guardia in un filtro che trattiene.
//
// Nessuna chiamata reale: il client Anthropic è finto e restituisce risposte
// decise dal test. Il contatore è stubbato per osservare cosa registra.
//
// Esecuzione: `npm run test:guardia`.

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

// Stub del contatore PRIMA di caricare chiamaJson: così la guardia scrive qui
// invece che su Supabase (che in un test non c'è, e non deve servire).
const registrati = [];
const percorsoContatore = path.join(ROOT, "lib/lingua/contatoreGuardia.ts");
require.cache[percorsoContatore] = {
  id: percorsoContatore,
  filename: percorsoContatore,
  loaded: true,
  exports: { registraGuardiaLingua: async (ancora) => { registrati.push(ancora); } },
};

const { chiamaJson } = require("@/lib/ai/chiamaJson");
const { REGOLA_LINGUA_INVARIANTE, trovaAccordi, trovaAccordiInJson } = require("@/lib/lingua/accordoGenere");
const { REGOLA_REGISTRO, trovaRegistroInJson } = require("@/lib/lingua/registroStudente");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// Client finto: restituisce in ordine i testi passati; `null` = eccezione.
function clienteFinto(risposte) {
  const visti = [];
  return {
    visti,
    messages: {
      create: async (opzioni) => {
        visti.push(opzioni);
        const testo = risposte.shift();
        if (testo === null || testo === undefined) throw new Error("errore simulato");
        return { content: [{ type: "text", text: testo }] };
      },
    },
  };
}

const PULITA = JSON.stringify({ commento_breve: "Hai messo il corso della sera al posto giusto.", punti_forza: ["Hai cercato chi non si muove."] });
const ACCORDATA = JSON.stringify({ commento_breve: "Sei partito dal realismo.", punti_forza: ["Hai cercato chi non si muove."] });
const ACCORDATA_2 = JSON.stringify({ commento_breve: "Ti sei chiesto da dove cominciare.", punti_forza: [] });

// Le due catture reali della Missione 04, parola per parola come sono uscite.
const VERDETTO = JSON.stringify({ commento_breve: "Performance non perfetta perché la soluzione è parziale." });
const TERZA_PERSONA = JSON.stringify({ commento_breve: "Lo studente lo nomina, il che è onesto." });
// Pulita per la lingua e per il registro, ma con una cifra che il chiamante
// (e solo lui) sa non essere citabile.
const CIFRA = JSON.stringify({ commento_breve: "Hai tenuto un fondo imprevisti di 37.000 euro." });

const opzioniBase = { model: "modello-finto", maxTokens: 100, system: "SISTEMA DI PROVA", user: "consegna" };

async function main() {
  console.log("\n═══ La guardia sulla lingua invariante ═══\n");

  // ── i pattern, su una struttura JSON annidata ────────────────────────────
  ok(trovaAccordi("Hai cercato, hai parlato, hai messo.").length === 0, "una frase con soli participi in «avere» non viene catturata");
  ok(trovaAccordiInJson({ a: ["tutto bene", "sei partito da lì"] }).length === 1, "la scansione entra dentro gli array annidati");
  ok(trovaAccordiInJson({ sei_andato: "Hai scelto bene." }).length === 0, "le CHIAVI non sono lingua: non vengono scansionate");

  // ── 1. risposta pulita: nessun intervento, nessuna chiamata in più ───────
  registrati.length = 0;
  let client = clienteFinto([PULITA]);
  let esito = await chiamaJson(client, opzioniBase);
  ok(esito.ok && client.visti.length === 1, "risposta pulita: una sola chiamata");
  ok(registrati.length === 0, "risposta pulita: la guardia non registra niente");
  ok(String(client.visti[0].system).includes(REGOLA_LINGUA_INVARIANTE.trim().slice(0, 40)), "la regola è appesa al system prompt");

  // ── 2. prima accordata, seconda pulita: si spedisce la seconda ───────────
  registrati.length = 0;
  client = clienteFinto([ACCORDATA, PULITA]);
  esito = await chiamaJson(client, opzioniBase);
  ok(client.visti.length === 2, "prima accordata: la guardia richiede una risposta");
  ok(esito.ok && esito.dati.commento_breve === "Hai messo il corso della sera al posto giusto.", "viene spedita la seconda risposta, quella pulita");
  ok(registrati.length === 1 && registrati[0] === false, "registra un intervento, senza esposizione residua");

  // ── 3. anche la seconda accordata: SI SPEDISCE LO STESSO ─────────────────
  registrati.length = 0;
  client = clienteFinto([ACCORDATA, ACCORDATA_2]);
  esito = await chiamaJson(client, opzioniBase);
  ok(client.visti.length === 2, "un solo ritentativo, mai due");
  ok(esito.ok && esito.dati.commento_breve === "Ti sei chiesto da dove cominciare.", "seconda ancora accordata: il feedback parte lo stesso");
  ok(registrati.length === 1 && registrati[0] === true, "registra l'esposizione residua");

  // ── 4. seconda chiamata fallita: si spedisce la PRIMA ────────────────────
  // Il caso che il JSON.parse ci ha insegnato: mai una schermata vuota al
  // posto di un feedback che esisteva.
  registrati.length = 0;
  client = clienteFinto([ACCORDATA, null, null]);
  esito = await chiamaJson(client, opzioniBase);
  ok(esito.ok && esito.dati.commento_breve === "Sei partito dal realismo.", "seconda chiamata fallita: si spedisce la prima risposta, mai il vuoto");
  ok(registrati.length === 1 && registrati[0] === true, "una seconda chiamata fallita conta come esposizione residua");

  // ── 5. prima chiamata fallita del tutto: esito di fallimento, invariato ──
  registrati.length = 0;
  client = clienteFinto([null, null]);
  esito = await chiamaJson(client, opzioniBase);
  ok(!esito.ok, "se la prima risposta non arriva proprio, l'esito resta un fallimento tipizzato");
  ok(registrati.length === 0, "un fallimento di chiamata non è un intervento della guardia");

  // ── 6. il registro: parola-verdetto e terza persona ─────────────────────
  // Stesso meccanismo del genere, stesso terminale: si richiede una risposta e
  // si spedisce comunque. Ma NON tocca i contatori della lingua, che misurano
  // il tasso di forme accordate e diventerebbero illeggibili con dentro
  // un'altra popolazione.
  for (const [nome, sporca] of [["una parola-verdetto", VERDETTO], ["la terza persona", TERZA_PERSONA]]) {
    registrati.length = 0;
    client = clienteFinto([sporca, PULITA]);
    esito = await chiamaJson(client, opzioniBase);
    ok(client.visti.length === 2, `${nome}: la guardia richiede una risposta`);
    ok(esito.ok && esito.dati.commento_breve === "Hai messo il corso della sera al posto giusto.", `${nome}: viene spedita la seconda`);
    ok(registrati.length === 0, `${nome}: non entra nei contatori della lingua`);
  }

  registrati.length = 0;
  client = clienteFinto([VERDETTO, TERZA_PERSONA]);
  esito = await chiamaJson(client, opzioniBase);
  ok(esito.ok && esito.dati.commento_breve === "Lo studente lo nomina, il che è onesto.", "registro ancora sporco al secondo giro: il feedback parte lo stesso");

  ok(String(client.visti[0].system).includes(REGOLA_REGISTRO.trim().slice(0, 40)), "anche la regola sul registro è appesa al system prompt");

  // ── 7. il controllo del chiamante ────────────────────────────────────────
  // Quello che questa funzione non può decidere da sola: una cifra è sbagliata
  // solo rispetto a una verità che sta altrove. Qui si verifica che il
  // controllo venga chiamato, che inneschi il secondo tentativo, e che il
  // terminale resti «si spedisce» — è il CHIAMANTE a sostituire la frase.
  registrati.length = 0;
  const visti = [];
  const controlloExtra = (dati) => {
    visti.push(dati);
    return JSON.stringify(dati).includes("37.000") ? ["37.000"] : [];
  };
  client = clienteFinto([CIFRA, PULITA]);
  esito = await chiamaJson(client, { ...opzioniBase, controlloExtra });
  // Il controllo gira UNA volta, sulla risposta da giudicare: dopo il secondo
  // tentativo non serve rifarlo qui, perché è il chiamante a doverlo rifare
  // comunque su ciò che riceve — è lui che sostituisce la frase, e deve sapere
  // QUALE. Rifarlo anche qui sarebbe una scansione in più per nessuno.
  ok(visti.length === 1, "il controllo del chiamante gira sulla risposta da giudicare, una volta");
  ok(client.visti.length === 2, "una cifra non citabile innesca il secondo tentativo");
  ok(esito.ok && esito.dati.commento_breve === "Hai messo il corso della sera al posto giusto.", "cifra: viene spedita la seconda risposta");
  ok(registrati.length === 0, "una cifra non entra nei contatori della lingua");

  registrati.length = 0;
  client = clienteFinto([CIFRA, CIFRA]);
  esito = await chiamaJson(client, { ...opzioniBase, controlloExtra });
  ok(esito.ok && esito.dati.commento_breve.includes("37.000"), "cifra ancora presente al secondo giro: la guardia NON trattiene — sostituisce il chiamante");

  // ── 8. le tre scansioni non si pestano i piedi ───────────────────────────
  ok(trovaRegistroInJson({ a: "Hai messo il corso al posto giusto." }).length === 0, "una frase che riporta non viene catturata dal registro");
  ok(trovaAccordiInJson({ a: "Lo studente lo nomina." }).length === 0, "il registro non è affare della guardia sul genere");

  console.log("\n═══════════════════════════════════════════\n");
  if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
  console.log("✓ La guardia riduce l'esposizione e non trattiene mai un feedback.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
