// `npm run banco motore` — fa girare il cron del workshop e DICE COSA VUOL DIRE.
//
// La parte che vale non è la chiamata: è la traduzione dell'esito. Il JSON
// {"processate":0,"saltate":0,"errori":1,...} non dice da solo se bisogna
// rilanciare, aspettare, o fermarsi per non bruciare un tentativo — e quella
// traduzione, il 30 agosto, l'ha fatta una persona a mano mentre un progetto
// vero stava a due tentativi dalla resa.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { config } = require("./config");

// MAX_TENTATIVI_REVISIONE non è duplicato qui: si legge dal codice del cron,
// che è l'unico posto dove esiste. Se un giorno quella costante cambia nome o
// forma, questo si ferma e lo dice — non risponde con un numero vecchio.
function maxTentativi() {
  const percorso = path.join(__dirname, "..", "..", "app", "api", "cron", "workshop-motore", "route.ts");
  const sorgente = fs.readFileSync(percorso, "utf8");
  const trovato = sorgente.match(/const MAX_TENTATIVI_REVISIONE\s*=\s*(\d+)/);
  if (!trovato) {
    console.error("⚠  Non trovo MAX_TENTATIVI_REVISIONE in app/api/cron/workshop-motore/route.ts.");
    console.error("   Il banco lo legge da lì per non tenerne una seconda copia. Se la costante è stata");
    console.error("   rinominata, aggiorna scripts/banco/motore.js.\n");
    return null;
  }
  return Number(trovato[1]);
}

async function motore() {
  const c = config(["sitoUrl", "cronSecret"]);
  // `alert=no`: la mail di osservabilità parte solo sul giro programmato. Chi
  // lancia il cron da qui l'esito ce l'ha a schermo ed è davanti al terminale;
  // una passata del robot ne manderebbe un centinaio, e cento mail rendono
  // inutile la centounesima.
  const url = `${c.sitoUrl}/api/cron/workshop-motore?alert=no`;

  console.log(`\n→ ${url}`);

  let risposta;
  try {
    // redirect: "follow" è il default di fetch, ma lo scriviamo per memoria:
    // chiamando kireo.it senza www, Vercel risponde 308 verso www e senza
    // seguirlo si legge «Redirecting...» invece dell'esito del cron.
    risposta = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${c.cronSecret}` },
      redirect: "follow",
    });
  } catch (errore) {
    console.error(`\n✗ Non sono riuscito a raggiungere il sito: ${errore.message}`);
    console.error(`  Controlla che sitoUrl in .banco.local.json sia giusto e che il deploy sia in piedi`);
    console.error(`  (npm run banco deploy).\n`);
    process.exit(1);
  }

  const testo = await risposta.text();
  let dati = null;
  try {
    dati = JSON.parse(testo);
  } catch {
    /* non JSON: gestito sotto */
  }

  console.log(`  HTTP ${risposta.status}\n`);

  // Il solo caso che `interpreta` non può giudicare, perché non è un esito del
  // motore ma una risposta che non è nemmeno arrivata da lui.
  if (!dati) {
    console.log("✗ Risposta che non è JSON. Primi 300 caratteri:");
    console.log("  " + testo.slice(0, 300).replace(/\n/g, "\n  "));
    if (/redirect/i.test(testo)) {
      console.log("\n  Sembra un redirect: metti sitoUrl CON il www.");
    }
    return process.exit(1);
  }

  const { processate = 0, saltate = 0, errori = 0, revisoriFalliti = 0, escapeFalliti = 0, guardiaInterventi = 0, guardiaAncoraAccordato = 0 } = dati;
  console.log(`  processate:${processate}  saltate:${saltate}  errori:${errori}  revisoriFalliti:${revisoriFalliti}`);
  console.log(`  guardia lingua: ${guardiaInterventi} interventi, ${guardiaAncoraAccordato} ancora accordati`);
  if (escapeFalliti) console.log(`  escape falliti nelle 24h: ${escapeFalliti}`);
  console.log("");

  const esito = interpreta(risposta.status, dati, maxTentativi());
  for (const riga of esito.righe) console.log(riga);
  if (esito.grave) process.exit(1);
}

// La TABELLA DI DECISIONE, pura: numeri dentro, frasi fuori. Sta in una
// funzione a sé perché è la sola parte del banco che vale la pena provare —
// e perché è quella che il 30 agosto viveva nella testa di una persona.
// Provata da `npm run test:banco`.
function interpreta(status, dati, max) {
  const righe = [];
  const di = (t) => righe.push(t);

  if (status === 401) {
    di("✗ NON AUTORIZZATO (401).");
    di("  Due cause, in ordine di frequenza:");
    di("  1. cronSecret in .banco.local.json non combacia con CRON_SECRET su Vercel;");
    di("  2. stai parlando con un deploy di PREVIEW, che ha variabili sue.");
    di("     L'indirizzo giusto è quello di produzione, con www.");
    return { righe, grave: true };
  }
  if (status === 503) {
    di("✗ CHIAVE ANTHROPIC ASSENTE (503).");
    di("  Il motore si ferma prima di toccare qualunque tappa: nessun tentativo è stato");
    di("  consumato. Su Vercel manca ANTHROPIC_API_KEY sull'ambiente Production, oppure");
    di("  c'è ma il deploy in aria è precedente al momento in cui è stata aggiunta");
    di("  (le variabili si legano al deploy: serve un redeploy).");
    return { righe, grave: true };
  }

  const processate = dati.processate ?? 0;
  const saltate = dati.saltate ?? 0;
  const errori = dati.errori ?? 0;
  const revisoriFalliti = dati.revisoriFalliti ?? 0;

  if (errori > 0 && revisoriFalliti > 0) {
    di("✗ LA GENERAZIONE È FALLITA.");
    di("  La tappa NON è avanzata: resta 'consegnata' e il prossimo giro ritenta.");
    if (max !== null) {
      di(`  Il tetto è ${max} giri. Guarda a che tentativo sei con:`);
      di("      npm run banco percorso");
      di("  ATTENZIONE: all'ultimo tentativo la tappa avanza LO STESSO, con revisione");
      di("  vuota — e se è l'ultima tappa il progetto si chiude senza feedback finale,");
      di("  che non si recupera se non rigiocando tutto.");
    }
    di("  Prima di rilanciare, guarda perché è fallita:");
    di("      npm run banco log");
    di("  Nel log il motivo dice cosa fare: 'troncata' → alzare il tetto dei token nel");
    di("  chiamante; 'chiamata' → guardare lo status dell'API lì accanto; 'estrazione'");
    di("  → è l'unico dei tre che riguarda il prompt.");
    return { righe, grave: false };
  }

  if (processate > 0) {
    di(`✓ FATTO: ${processate} ${processate === 1 ? "tappa avanzata" : "tappe avanzate"}.`);
    di("  Revisione e reazione del cliente sono state generate e salvate; la tappa");
    di("  successiva è aperta (o, se era l'ultima, il progetto è chiuso col feedback");
    di("  finale). Lo studente lo vede ricaricando la pagina del progetto.");
    if (saltate > 0) di(`  Altre ${saltate} tappe stanno ancora raffreddando: normale.`);
    return { righe, grave: false };
  }

  if (saltate > 0) {
    di(`○ NIENTE DA FARE ORA: ${saltate} ${saltate === 1 ? "tappa è" : "tappe sono"} ancora in raffreddamento.`);
    di("  Non è un errore: il cooldown della tappa non è passato. Quanto manca lo dice");
    di("      npm run banco percorso");
    di("  (colonna «minuti dalla consegna»). Rilanciare adesso non cambia niente.");
    return { righe, grave: false };
  }

  if (errori > 0) {
    di("✗ ERRORI SENZA REVISORI FALLITI.");
    di("  Non è la generazione AI: è più a valle (scrittura su Supabase, avanzamento");
    di("  della fase). Guarda i log: npm run banco log");
    return { righe, grave: false };
  }

  di("○ NESSUNA TAPPA CONSEGNATA IN ATTESA.");
  di("  Il motore non ha trovato niente da fare: nessuno ha consegnato una tappa da");
  di("  quando è passato l'ultima volta. Se ti aspettavi il contrario, controlla che");
  di("  la consegna sia andata a buon fine: npm run banco percorso");
  return { righe, grave: false };
}

module.exports = { motore, interpreta, maxTentativi };
