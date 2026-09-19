// `npm run banco log` e `npm run banco deploy` — i due comandi che parlano con
// Vercel invece che con l'interfaccia web.
//
// LOG: le righe che contano, non tutte. Il 30 agosto la riga che ha chiuso il
// caso della troncatura è arrivata dopo tre tentativi di trovarla
// nell'interfaccia.
//
// E una lezione pagata lo stesso giorno: i log di runtime appartengono al
// SINGOLO DEPLOY. Guardando solo quello corrente, dopo un redeploy le righe
// del guasto appena riparato diventano invisibili — e il banco diceva «nessuna
// riga di errore» quando la risposta onesta era «non posso vederle». Ora
// consulta tutti i deploy che coprono la finestra, e quando la finestra non è
// coperta lo DICE (vedi finestre.js).
//
// DEPLOY: aspetta che la produzione sia pronta, invece di ricaricare una pagina.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { config, configFacoltativa } = require("./config");
const { finestreDeploy, raccontaCopertura, durata } = require("./finestre");

// `morbido` esiste per un chiamante solo: la guardia di allineamento del robot,
// che gira PRIMA che la passata parta. Lì un token senza permessi non deve
// terminare il processo — deve diventare un «non posso verificare» che chi
// conferma legge. Per tutti gli altri comandi l'uscita secca resta giusta:
// senza quella risposta non c'è niente da stampare.
async function api(c, percorso, { morbido = false } = {}) {
  const risposta = await fetch(`https://api.vercel.com${percorso}`, {
    headers: { Authorization: `Bearer ${c.vercelToken}` },
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    if (morbido) throw new Error(`Vercel ha risposto ${risposta.status} su ${percorso.split("?")[0]}`);
    console.error(`\n✗ Vercel ha risposto ${risposta.status} su ${percorso.split("?")[0]}:`);
    console.error("  " + testo.slice(0, 400));
    if (risposta.status === 403) {
      console.error("\n  Il token non ha accesso a questo progetto: controlla che sia stato creato");
      console.error("  con lo scope del team che possiede kireo, non quello personale.");
    }
    process.exit(1);
  }
  return risposta.json();
}

// Se ne chiedono più del necessario: alcuni verranno scartati perché non hanno
// mai servito (ERROR, CANCELED, BUILDING, QUEUED), e chiederne pochi
// significherebbe restringere in silenzio la finestra coperta.
async function deployProduzione(c, quanti = 30, opzioni = {}) {
  const dati = await api(c, `/v6/deployments?projectId=${c.vercelProjectId}&target=production&limit=${quanti}`, opzioni);
  return dati.deployments ?? [];
}

// Lo stato della produzione per la guardia del robot: non fallisce mai, dice
// perché quando non sa. Chiede pochi deploy — servono il più recente che ha
// servito e quelli eventualmente in volo sopra di lui, non una cronologia.
async function statoProduzione() {
  const dati = configFacoltativa(["vercelToken", "vercelProjectId"]);
  if (!dati) return { deploys: null, perche: "in .banco.local.json mancano vercelToken e/o vercelProjectId" };
  try {
    return { deploys: await deployProduzione(dati, 10, { morbido: true }), perche: null };
  } catch (errore) {
    return { deploys: null, perche: errore.message };
  }
}

// L'indirizzo di un deploy è vercel.com/<team>/<progetto>/<uid>: due segmenti
// DIVERSI. La prima stesura ci metteva lo slug del team due volte, e funzionava
// solo perché qui team e progetto si chiamano tutti e due «kireo» — una
// coincidenza, non una regola. Il nome del progetto arriva dall'API (`name`);
// senza, resta l'uid, che nel pannello si trova cercandolo.
function linkDeploy(c, deploy) {
  const progetto = deploy?.name ?? c.vercelProjectSlug;
  return c.vercelTeamSlug && progetto ? `https://vercel.com/${c.vercelTeamSlug}/${progetto}/${deploy.uid}` : deploy.uid;
}

// ── log ────────────────────────────────────────────────────────────────────
// COSA LEGGE DAVVERO, ed è il motivo per cui il testo a schermo dice «build».
// Nella passata del 18/09 questo comando ha letto 298 righe di build e ZERO di
// runtime [verificato, non dedotto: è il numero uscito a schermo]. Il filtro
// qui sotto è stato riparato lo stesso giorno, ma un filtro tarato bene su
// righe che non arrivano non serve a niente — e la sorgente non è stata
// verificata, perché dal sandbox la rete verso vercel.com è chiusa. Scrivere
// un secondo pezzo di codice non provato dentro uno strumento diagnostico è
// esattamente il modo in cui si costruisce la prossima cecità.
//
// Quindi questo comando dichiara quello che sa fare — gli eventi del DEPLOY —
// e i guasti del motore si leggono da un'altra parte: `npm run banco guasti`,
// che legge una tabella nostra e non dipende né dal fornitore né dalla sua
// conservazione di poche ore. I due non devono poter essere scambiati l'uno
// per l'altro, quindi lo dicono tutti e due, in testa, ogni volta.
//
// Il filtro resta, e resta tarato sulla famiglia: le righe che il nostro
// codice scrive quando qualcosa non va. Cercare per queste stringhe è cercare
// per causa, non per orario.
//
// CONOSCEVA I GUASTI DELL'AI E NON QUELLI DELLE SCRITTURE: fino al 18/09 le
// quattro voci erano `chiamaJson`, `Errore generazione`, `forma non valida`,
// `Alert osservabilità` — tutte e quattro sulla generazione. Una scrittura che
// non atterra («Errore marcatura revisione_esito», «Errore avanzamento tappa»,
// «Errore aggiornamento tentativi_revisione») passava dal filtro senza essere
// vista, ed è precisamente la famiglia che nel cron ferma una tappa.
//
// Da qui in poi si cerca la FAMIGLIA, non le singole stringhe: ogni riga che il
// nostro codice scrive quando qualcosa non va comincia per «Errore» o per
// «Alert». Un elenco di stringhe è un elenco da aggiornare, e questo difetto
// nasce da due liste che nessuno aggiorna insieme.
//
// Largo di proposito, e nella direzione giusta: qui a leggere c'è una persona,
// quindi un filtro che include troppo costa qualche riga in più da scorrere,
// mentre uno che include troppo poco costa un guasto che non si vede. È la
// regola della direzione dell'errore applicata a uno strumento con un umano
// dentro il ciclo — il contrario di come si tarano i pattern del tripwire.
const INTERESSANTI = [/chiamaJson —/, /forma non valida/i, /\bErrore\b/i, /\bAlert\b/];

async function eventiDi(c, uid, daMs) {
  const righe = await api(c, `/v3/deployments/${uid}/events?since=${daMs}&limit=1000&builds=0`);
  return Array.isArray(righe) ? righe : (righe.events ?? []);
}

async function log(minuti = 60, opzioni = {}) {
  const c = config(["vercelToken", "vercelProjectId"]);
  const da = Date.now() - minuti * 60_000;

  console.log("");
  console.log("EVENTI DEL DEPLOY su Vercel — in pratica, la build.");
  console.log("  I guasti del motore NON si leggono qui: `npm run banco guasti`. Quella è una");
  console.log("  tabella nostra e resta; questa sorgente dura poche ore e dipende dal fornitore.");
  console.log("");

  let daConsultare;
  let copertura = null;
  if (opzioni.deployId) {
    // Un deploy preciso: si va a prendere lì il guasto di prima, finché Vercel
    // lo conserva.
    daConsultare = [{ uid: opzioni.deployId }];
    console.log(`Deploy richiesto esplicitamente: ${opzioni.deployId}`);
  } else {
    const deploys = await deployProduzione(c);
    if (deploys.length === 0) {
      console.log("Nessun deploy di produzione trovato per questo progetto.\n");
      return;
    }
    copertura = finestreDeploy(deploys, da);
    for (const riga of raccontaCopertura(copertura, minuti)) console.log(riga);
    daConsultare = copertura.consultare;
    if (daConsultare.length === 0) {
      console.log("");
      return;
    }
  }

  console.log(`\nRighe del deploy negli ultimi ${minuti} minuti:\n`);

  const tenute = [];
  let totaleRighe = 0;
  for (const d of daConsultare) {
    let elenco;
    try {
      elenco = await eventiDi(c, d.uid, da);
    } catch (errore) {
      console.log(`  ⚠  ${d.uid}: non leggibile (${errore.message}). Su Vercel i log di runtime`);
      console.log(`     hanno una conservazione limitata: dopo qualche ora spariscono.`);
      continue;
    }
    totaleRighe += elenco.length;
    for (const r of elenco) {
      const testo = String(r.text ?? r.payload?.text ?? "");
      if (opzioni.tutto || INTERESSANTI.some((p) => p.test(testo))) tenute.push({ r, testo, uid: d.uid });
    }
  }

  if (tenute.length === 0) {
    if (totaleRighe === 0) {
      // La distinzione che conta: nessuna riga DEL TUTTO non è «nessun errore»,
      // è «non c'è stato traffico, oppure i log sono già stati scartati».
      console.log("  Nessuna riga, di nessun tipo, in questa finestra.");
      console.log("  Non vuol dire «tutto a posto»: vuol dire che non c'è stato traffico, oppure");
      console.log("  che Vercel ha già scartato le righe (la conservazione è di poche ore).");
      console.log("  Quello che non è stato letto in tempo non si recupera — ed è la ragione per");
      console.log("  cui i guasti ce li scriviamo noi:  npm run banco guasti");
    } else {
      console.log(`  ${totaleRighe} righe lette, nessuna passata dal filtro degli errori.`);
      // NON «nessun revisore ha fallito»: questo comando sa solo cosa è stato
      // SCRITTO. Il 13/09 due ruoli si sono fermati su un 500 che non
      // registrava niente, e qui sarebbe comparsa la buona notizia. Il filtro
      // vede i guasti che parlano; quelli muti li prende `npm run test:log5xx`.
      console.log("  Vuol dire che il traffico c'è stato e nessuno ha scritto un errore di");
      console.log("  quelli che il filtro conosce — non che non sia successo niente.");
      console.log("  E soprattutto: questa è la BUILD. Se quello che cerchi è una tappa che non");
      console.log("  è avanzata o un testo che non è arrivato, non è qui che si vede:");
      console.log("      npm run banco guasti");
      console.log("  Per vedere tutte le righe e non solo quelle filtrate:");
      console.log(`      npm run banco -- log ${minuti} --tutto`);
    }
    console.log("");
    return;
  }

  const piuDiUno = new Set(tenute.map((t) => t.uid)).size > 1;
  for (const { r, testo, uid } of tenute) {
    const quando = new Date(r.created ?? r.timestamp ?? Date.now()).toLocaleTimeString("it-IT");
    const dove = piuDiUno ? ` [${uid.slice(0, 12)}]` : "";
    console.log(`  [${quando}]${dove} ${testo.trim()}`);
  }

  // La traduzione, come per il motore: il motivo dice cosa fare.
  const tutto = tenute.map((t) => t.testo).join("\n");
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
  if (/vicina al tetto/.test(tutto)) {
    console.log("→ VICINA AL TETTO: non è ancora un guasto. È la risposta successiva, un filo più");
    console.log("  lunga, quella che si troncherà. Alza il tetto adesso che non costa niente.");
  }
  console.log("");
}

// ── deploy ─────────────────────────────────────────────────────────────────
async function deploy(attendi = true) {
  const c = config(["vercelToken", "vercelProjectId"]);
  const inizio = Date.now();

  for (;;) {
    const [d] = await deployProduzione(c, 1);
    if (!d) {
      console.log("\nNessun deploy di produzione trovato.\n");
      return;
    }
    const stato = d.readyState ?? d.state;
    const riga = `  ${stato.padEnd(12)} ${d.uid}  (nato ${durata(Date.now() - d.createdAt)} fa)`;

    if (stato === "READY") {
      console.log(`\n✓ PRODUZIONE PRONTA\n${riga}`);
      console.log("\n  Le variabili d'ambiente in vigore sono quelle di QUESTO deploy: se ne hai");
      console.log("  cambiata una dopo, non è ancora attiva — serve un altro deploy.");
      console.log("  E i log del deploy PRECEDENTE non sono spariti: si guardano con");
      console.log("  `npm run banco log <minuti>`, che consulta tutti quelli che coprono la finestra.\n");
      return;
    }
    if (stato === "ERROR" || stato === "CANCELED") {
      console.log(`\n✗ DEPLOY ${stato}\n${riga}`);
      console.log(`\n  ${linkDeploy(c, d)}\n`);
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

// `INTERESSANTI` è esportato per una ragione sola: `npm run test:banco` lo
// confronta con le righe che il cron scrive davvero. È l'unica parte di questo
// file provabile senza rete, ed è quella che il 18/09 era cieca.
module.exports = { log, deploy, statoProduzione, INTERESSANTI };
