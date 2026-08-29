// `npm run banco log` e `npm run banco deploy` — i due comandi che parlano con
// Vercel invece che con l'interfaccia web.
//
// LOG: le righe che contano, non tutte. Il 30 agosto la riga che ha chiuso il
// caso della troncatura è arrivata dopo tre tentativi di trovarla nell'interfaccia:
// qui si filtra su ciò che il nostro codice scrive quando qualcosa va storto.
//
// DEPLOY: aspetta che la produzione sia pronta, invece di ricaricare una pagina.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { config } = require("./config");

async function api(c, percorso) {
  const risposta = await fetch(`https://api.vercel.com${percorso}`, {
    headers: { Authorization: `Bearer ${c.vercelToken}` },
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    console.error(`\n✗ Vercel ha risposto ${risposta.status}:`);
    console.error("  " + testo.slice(0, 400));
    if (risposta.status === 403) {
      console.error("\n  Il token non ha accesso a questo progetto: controlla che sia stato creato");
      console.error("  con lo scope del team che possiede kireo, non quello personale.");
    }
    process.exit(1);
  }
  return risposta.json();
}

async function ultimoDeployProduzione(c) {
  const dati = await api(c, `/v6/deployments?projectId=${c.vercelProjectId}&target=production&limit=1`);
  return dati.deployments?.[0] ?? null;
}

// ── log ────────────────────────────────────────────────────────────────────
// Le righe che il nostro codice scrive quando qualcosa non va. Cercare per
// queste stringhe è cercare per causa, non per orario.
const INTERESSANTI = [/chiamaJson —/, /Errore generazione/, /revisione di forma non valida/i, /Feedback finale di forma non valida/i, /Alert osservabilità/];

async function log(minutiIndietro = 60) {
  const c = config(["vercelToken", "vercelProjectId"]);
  const deploy = await ultimoDeployProduzione(c);
  if (!deploy) {
    console.log("\nNessun deploy di produzione trovato per questo progetto.\n");
    return;
  }

  const da = Date.now() - minutiIndietro * 60_000;
  console.log(`\nLog di produzione, ultimi ${minutiIndietro} minuti (deploy ${deploy.uid}):\n`);

  const righe = await api(c, `/v3/deployments/${deploy.uid}/events?since=${da}&limit=1000&builds=0`);
  const elenco = Array.isArray(righe) ? righe : (righe.events ?? []);

  const tenute = elenco.filter((r) => {
    const testo = String(r.text ?? r.payload?.text ?? "");
    return INTERESSANTI.some((p) => p.test(testo));
  });

  if (tenute.length === 0) {
    console.log("  Nessuna riga di errore dei revisori in questa finestra.");
    console.log("  Se ti aspettavi qualcosa, allarga la finestra:  npm run banco log 240");
    console.log("  (i log di runtime su Vercel non sono conservati a lungo: dopo qualche ora");
    console.log("  spariscono, e quello che non è stato letto non si recupera).\n");
    return;
  }

  for (const r of tenute) {
    const quando = new Date(r.created ?? r.timestamp ?? Date.now()).toLocaleTimeString("it-IT");
    const testo = String(r.text ?? r.payload?.text ?? "").trim();
    console.log(`  [${quando}] ${testo}`);
  }

  // La traduzione, come per il motore: il motivo dice cosa fare.
  const tutto = tenute.map((r) => String(r.text ?? r.payload?.text ?? "")).join("\n");
  console.log("");
  if (/motivo=troncata|risposta TRONCATA/.test(tutto)) {
    console.log("→ TRONCATURA: il modello stava ancora scrivendo quando è finito il tetto dei token.");
    console.log("  Si alza il tetto nel chiamante (MAX_TOKEN_* in app/api/cron/workshop-motore).");
    console.log("  Il log dice quanti token su quanti: prendi il numero da lì, non a occhio.");
  }
  if (/motivo=chiamata|errore API/.test(tutto)) {
    console.log("→ CHIAMATA: l'API non ha risposto. Guarda lo status nella riga «chiamaJson — errore API»:");
    console.log("  401 chiave, 429 rate limit, 529 sovraccarico. Il tetto dei token non c'entra.");
  }
  if (/motivo=estrazione/.test(tutto)) {
    console.log("→ ESTRAZIONE: ha risposto ma senza JSON dentro. È l'unico dei tre che riguarda");
    console.log("  il prompt — e se la riga accanto dice «troncata=true» è invece una troncatura.");
  }
  if (/forma non valida/i.test(tutto)) {
    console.log("→ FORMA NON VALIDA: JSON valido ma con i campi sbagliati. Il prompt e il controllo");
    console.log("  nel cron si sono disallineati: guarda quali campi il cron pretende.");
  }
  console.log("");
}

// ── deploy ─────────────────────────────────────────────────────────────────
async function deploy(attendi = true) {
  const c = config(["vercelToken", "vercelProjectId"]);
  const inizio = Date.now();

  for (;;) {
    const d = await ultimoDeployProduzione(c);
    if (!d) {
      console.log("\nNessun deploy di produzione trovato.\n");
      return;
    }
    const stato = d.readyState ?? d.state;
    const eta = Math.round((Date.now() - (d.createdAt ?? Date.now())) / 1000);
    const riga = `  ${stato.padEnd(12)} ${d.uid}  (creato ${eta}s fa)`;

    if (stato === "READY") {
      console.log(`\n✓ PRODUZIONE PRONTA\n${riga}`);
      console.log("\n  Le variabili d'ambiente in vigore sono quelle di QUESTO deploy: se ne hai");
      console.log("  cambiata una dopo, non è ancora attiva — serve un altro deploy.\n");
      return;
    }
    if (stato === "ERROR" || stato === "CANCELED") {
      console.log(`\n✗ DEPLOY ${stato}\n${riga}`);
      console.log(`\n  https://vercel.com/_/_/${d.uid} — apri e guarda il log di build.\n`);
      process.exit(1);
    }
    if (!attendi) {
      console.log(`\n○ IN CORSO\n${riga}\n`);
      return;
    }
    process.stdout.write(`\r  ${stato}… (${Math.round((Date.now() - inizio) / 1000)}s)   `);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

module.exports = { log, deploy };
