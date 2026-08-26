// Misura quanto spesso i revisori AI si rivolgono allo studente con una forma
// che concorda col genere («ti sei accorto», «sei stato bravo», «da solo»).
//
// PERCHÉ ESISTE. Le frasi cablate le abbiamo riscritte a mano e le sorveglia il
// tripwire (`npm run test:finale`). Ma metà del testo che lo studente legge la
// scrive un modello, e lì il tripwire non arriva: può solo scriverlo nel prompt.
// Una regola nel prompt però ORIENTA, non GARANTISCE — quindi prima di metterla
// in produzione va misurata: quante forme di genere escono OGGI, e quante ne
// restano CON la regola. Senza questo numero, aggiungere la riga sarebbe una
// speranza, non una decisione.
//
// COSA MISURA. Tre revisori reali (nessun prompt riscritto qui: sono presi dalle
// stesse funzioni che girano in produzione), N esecuzioni ciascuno, sullo stesso
// testo-studente. Conta le occorrenze nei SOLI campi che lo studente legge, con
// gli stessi pattern del prodotto (lib/lingua/accordoGenere.ts — un posto solo).
// L'unica variabile fra i due giri è la regola: tutto il resto è identico.
//
// LA CHIAMATA È NUDA, non passa da `chiamaJson`: lì dentro vivono ora la regola
// (appesa a ogni system prompt) e la guardia (che richiede una risposta quando
// ne trova una accordata). Misurare attraverso quella funzione vorrebbe dire
// misurare lo strumento invece del modello — il giro «senza regola» non
// esisterebbe più, e quello «con regola» conterebbe risposte già ripulite.
//
// La prima misura (26/08/2026, Haiku 4.5, 24 chiamate per parte): 2 forme reali
// senza regola, 2 con la prima stesura della regola — che parlava solo
// dell'indirizzo frontale, dove il modello era già a posto. Tutte e quattro
// erano verbi con «essere» o riflessivi, in secondarie e domande: da lì la
// riformulazione. Con due catture per parte non si distingue «non funziona» da
// «non lo vediamo»: il numero vero lo darà la produzione, con i contatori della
// guardia nell'alert giornaliero.
//
// USO:
//   ANTHROPIC_API_KEY=sk-... node scripts/misura-genere-revisori.js
//   ANTHROPIC_API_KEY=sk-... node scripts/misura-genere-revisori.js --con-regola
//   (opzionale: --giri=5)
//
// Il testo-studente qui sotto è un FIXTURE dello strumento, scritto apposta per
// somigliare a una consegna media — né ottima né disastrosa: una consegna troppo
// buona o troppo scarsa tira il modello verso un registro solo, e misureremmo
// quello invece della lingua.

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

const { trovaAccordi, REGOLA_LINGUA_INVARIANTE } = require("@/lib/lingua/accordoGenere");
const { estraiJson } = require("@/lib/ai/chiamaJson");
const { costruisciPromptPropostaPerTest } = require("@/lib/escape/scoring");
const { promptRevisore, promptFeedbackFinale } = require("@/lib/workshop/prompt-revisore");
const { WORKSHOP_ELABORATO, WORKSHOP_TUTOR_CONTESTO } = require("@/lib/workshop/elaborato-config");
const { WORKSHOP_CLIENTE_NOME, MODELLO_CLIENTE_WORKSHOP } = require("@/lib/workshop/config");
const { AREE } = require("@/data/aree");

// ─────────────────────────────────────────────────── la regola, in prova
// NON una copia: è la stessa costante che il prodotto appende ai prompt
// (lib/lingua/accordoGenere.ts). Una copia qui diverge dalla produzione al
// primo ritocco, e misureremmo una regola che non esiste più.
const REGOLA_GENERE = REGOLA_LINGUA_INVARIANTE;

// ─────────────────────────────────────────────────── fixture (dello strumento)
const CONSEGNA_ESCAPE = `Il mercato lo trasformerei in uno spazio per lo studio e per i corsi del pomeriggio, perché nel quartiere non c'è una biblioteca e i ragazzi stanno per strada.
Terrei aperta la parte centrale per il mercato del sabato, così i commercianti non perdono il posto, e userei le due ali per le aule.
Il tetto va sistemato prima di tutto, altrimenti a novembre piove dentro e i lavori nuovi si rovinano.
Non ho un numero preciso sui costi di gestione: so che ci sono, ma non ho trovato la cifra, quindi metterei da parte una quota senza saper dire quanto.`;

const CONSEGNA_TAPPA = {
  ricognizione: "Nel quartiere non si muovono soprattutto le donne dai 40 in su e gli anziani soli. Le prime perché di giorno lavorano e la sera non escono, i secondi perché la palestra è al primo piano senza ascensore.",
  programma_settimanale: "Lunedì e mercoledì sera ginnastica dolce, martedì corso donne, sabato mattina attività per bambini. Il giovedì lo lascerei libero per le richieste che arrivano.",
  da_dove_parti: "Partirei dalla ginnastica dolce, perché serve poca attrezzatura e le persone che ho in mente ci arrivano a piedi.",
};

// ─────────────────────────────────────────────────── costruzione dei revisori
function contesto() {
  const slug = "palestra-popolare";
  const ruolo = "salute";
  const elaborato = WORKSHOP_ELABORATO[slug]?.[ruolo];
  if (!elaborato) throw new Error("elaborato palestra-popolare/salute non trovato");
  const fase = elaborato.fasi[0];
  return {
    workshopTitolo: "Apri una palestra popolare",
    ruoloTitolo: "Responsabile attività e benessere",
    tappaTitolo: fase.titolo,
    tappaObiettivo: fase.obiettivo,
    clienteNome: WORKSHOP_CLIENTE_NOME[slug] ?? "il cliente",
    clienteVincoli: WORKSHOP_TUTOR_CONTESTO[slug]?.vincoli ?? "",
    revisioneFocus: fase.revisioneFocus,
    fiduciaMax: fase.fiduciaMax,
    sezioni: fase.sezioni.map((s) => ({ id: s.id, titolo: s.titolo })),
  };
}

// I campi elencati sono ESATTAMENTE quelli che finiscono sotto gli occhi dello
// studente: i punteggi e gli slug non contano, non sono lingua.
function revisori() {
  const slugAree = AREE.map((a) => a.slug);
  const ctx = contesto();
  return [
    {
      nome: "escape/proposta",
      system: costruisciPromptPropostaPerTest("progetto-quartiere", slugAree, new Set(["M1", "M2", "M4", "M7"])),
      user: CONSEGNA_ESCAPE,
      campi: (d) => [...(d.aree ?? []).map((a) => a.motivazione), d.giudizio_complessivo],
    },
    {
      nome: "workshop/revisione-tappa",
      system: promptRevisore(ctx),
      user: JSON.stringify(CONSEGNA_TAPPA, null, 2),
      campi: (d) => [...(d.punti_forza ?? []), ...(d.da_migliorare ?? []), d.domanda, d.commento_breve],
    },
    {
      nome: "workshop/feedback-finale",
      system: promptFeedbackFinale(ctx, 68),
      user: JSON.stringify(CONSEGNA_TAPPA, null, 2),
      campi: (d) => [...(d.punti_forza ?? []), ...(d.da_migliorare ?? []), d.messaggio_chiusura, d.chiusura_cliente],
    },
  ];
}

// ─────────────────────────────────────────────────── esecuzione
async function main() {
  const conRegola = process.argv.includes("--con-regola");
  // --secco: costruisce i prompt e si ferma. Serve a verificare lo strumento
  // dove una chiave non c'è (e a leggere il prompt prima di spendere).
  const secco = process.argv.includes("--secco");
  const argGiri = process.argv.find((a) => a.startsWith("--giri="));
  const giri = argGiri ? Number(argGiri.split("=")[1]) : 5;

  if (secco) {
    for (const r of revisori()) {
      const system = conRegola ? r.system + REGOLA_GENERE : r.system;
      console.log(`\n─── ${r.nome} — system ${system ? system.length : 0} caratteri, user ${r.user.length}`);
      if (conRegola) console.log(REGOLA_GENERE.trim());
    }
    console.log("\n(secco: nessuna chiamata fatta)\n");
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\nManca ANTHROPIC_API_KEY: questo strumento fa chiamate vere, non simula niente.\n");
    console.error("  ANTHROPIC_API_KEY=sk-... node scripts/misura-genere-revisori.js");
    console.error("  ANTHROPIC_API_KEY=sk-... node scripts/misura-genere-revisori.js --con-regola\n");
    process.exit(2);
  }

  const Anthropic = require("@anthropic-ai/sdk").default ?? require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // NON si passa da `chiamaJson`: lì dentro vivono ORA sia la regola (appesa a
  // ogni system prompt) sia la guardia (che rilegge e richiede una risposta
  // quando trova una forma accordata). Misurare attraverso quella funzione
  // vorrebbe dire misurare lo strumento invece del modello: il giro «senza
  // regola» sarebbe impossibile, e il giro «con regola» conterebbe le risposte
  // già ripulite dalla guardia. Qui la chiamata è nuda; l'estrazione è la
  // stessa (estraiJson, condivisa), perché non c'è motivo di riscriverla.
  async function chiamataNuda(system, user) {
    try {
      const risposta = await client.messages.create({
        model: MODELLO_CLIENTE_WORKSHOP,
        max_tokens: 800,
        system,
        messages: [{ role: "user", content: user }],
      });
      const testo = risposta.content[0]?.type === "text" ? risposta.content[0].text : "";
      const dati = estraiJson(testo);
      return dati === undefined ? { ok: false, motivo: "estrazione" } : { ok: true, dati };
    } catch (errore) {
      console.error("  chiamata fallita:", errore?.message ?? errore);
      return { ok: false, motivo: "chiamata" };
    }
  }

  const lista = revisori();
  console.log(`\nMisura accordo di genere — ${lista.length} revisori × ${giri} giri = ${lista.length * giri} chiamate`);
  console.log(`Regola nel prompt: ${conRegola ? "SÌ (--con-regola)" : "NO (stato attuale)"}\n`);

  let totaleColpi = 0, totaleCampi = 0, campiConColpo = 0, falliti = 0;

  for (const r of lista) {
    if (!r.system) { console.error(`  ${r.nome}: prompt non costruito — saltato`); continue; }
    const system = conRegola ? r.system + REGOLA_GENERE : r.system;
    let colpiRev = 0, campiRev = 0;

    for (let g = 1; g <= giri; g++) {
      const esito = await chiamataNuda(system, r.user);
      if (!esito.ok) { console.error(`  ${r.nome} giro ${g}: FALLITO (${esito.motivo})`); falliti++; continue; }
      const campi = r.campi(esito.dati).filter((c) => typeof c === "string" && c.trim());
      campiRev += campi.length;
      // Il testo si stampa INTERO: «da sol[oa]» concorda anche con un nome
      // femminile della frase («la palestra da sola non basta») — italiano
      // corretto, non un modo di rivolgersi a chi legge. Una cattura tagliata a
      // metà non si può giudicare, e un numero che non si può giudicare non
      // decide niente.
      for (const c of campi) {
        const colpi = trovaAccordi(c);
        if (colpi.length) {
          campiConColpo++;
          colpiRev += colpi.length;
          console.log(`  [${r.nome} g${g}] ${colpi.join(", ")}\n      ${c}`);
        }
      }
    }
    console.log(`  ── ${r.nome}: ${colpiRev} forme di genere su ${campiRev} campi letti\n`);
    totaleColpi += colpiRev;
    totaleCampi += campiRev;
  }

  console.log("═══════════════════════════════════════════");
  console.log(`  forme di genere trovate : ${totaleColpi}`);
  console.log(`  campi che ne contengono : ${campiConColpo} su ${totaleCampi}`);
  if (falliti) console.log(`  chiamate fallite        : ${falliti} (escluse dal conto)`);
  console.log(`  regola nel prompt       : ${conRegola ? "sì" : "no"}`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
