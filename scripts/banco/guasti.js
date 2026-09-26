// `npm run banco guasti` — quello che il motore sa di non aver fatto.
//
// NON È `npm run banco log`, ed è la ragione per cui è un comando a sé invece
// di una riga in più là dentro. `log` legge quello che Vercel conserva del
// DEPLOY: dura poche ore, appartiene al singolo deploy, e il gesto con cui si
// ripara un guasto (il redeploy) è anche quello che rende invisibili le righe
// che lo documentavano. Qui si legge una tabella NOSTRA, che resta.
//
// LA COSA CHE QUESTO COMANDO DEVE SAPER DIRE, e che il 18/09 non sapeva dire
// nessuno: la differenza fra «zero guasti» e «non ho guardato». Un silenzio
// che non dichiara quale dei due sia è la risposta comoda, e nessuno va a
// ricontrollare una buona notizia. Ogni percorso di questo file finisce in una
// delle due frasi, sempre.
//
// E una terza cosa, che va detta anche quando la risposta è zero: la tabella
// si riempie solo se il codice PARTE. Un crash a freddo non scrive niente, e
// una tabella vuota si legge come «tutto bene» esattamente quando le cose
// vanno peggio. Per quella classe il guardiano è `npm run test:log5xx`, e
// questo comando non lo sostituisce.
//
// Sola lettura.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { configFacoltativa } = require("./config");

// Le specie, nell'ordine in cui vale la pena leggerle: prima quello che ferma
// tutto, poi le transizioni mancate, poi i testi che non sono arrivati.
// Una specie che non è in questo elenco viene stampata lo stesso, in fondo:
// l'insieme chiuso sta nel tipo TypeScript, e un elenco qui che non lo
// rispecchiasse farebbe sparire dalla vista proprio il guasto nuovo.
const ORDINE = [
  "configurazione",
  "lettura_coda",
  "eccezione_riga",
  "scrittura_marcatura",
  "scrittura_avanzamento",
  "scrittura_tentativi",
  "scrittura_notifiche",
  "consegna_progetto",
  "esito_missione",
  "feedback_finale",
  "revisione",
  "modo_di_lavorare",
  "reazione_cliente",
  "prove_missione",
  "prove_test",
  "guida_riservata",
  "feedback_elaborato",
  "alert_email",
];

// Cosa vuol dire, per chi legge. Non una glossa del nome: cosa non è successo
// PER QUALCUNO, che è l'unica cosa che dice se c'è da correre.
const COSA_VUOL_DIRE = {
  configurazione: "il motore non è partito: una chiave o una variabile manca",
  lettura_coda: "il cron non è riuscito a leggere cosa c'era da fare",
  eccezione_riga: "una riga si è rotta fuori dai casi previsti",
  scrittura_marcatura: "l'esito non è atterrato: la tappa NON è avanzata (ritenta al giro dopo)",
  scrittura_avanzamento: "la tappa non si è aperta: lo studente resta fermo",
  scrittura_tentativi: "il contatore non si è alzato: la tappa può ritentare all'infinito",
  scrittura_notifiche: "lo studente non è stato avvisato che la tappa era pronta",
  consegna_progetto: "la consegna non si è scritta: per lo studente non è successa",
  esito_missione: "le prove della missione non si sono salvate: il profilo non le ha viste",
  feedback_finale: "la pagina di chiusura del progetto è rimasta vuota",
  revisione: "la tappa non ha avuto la sua revisione",
  modo_di_lavorare: "il blocco «come hai lavorato» non è arrivato",
  reazione_cliente: "il cliente non ha reagito alla consegna",
  prove_missione: "il revisore della proposta non ha prodotto prove",
  prove_test: "il test non ha prodotto nessuna prova: il profilo resta vuoto, e se ne accorge T3",
  guida_riservata:
    "una guida 2 o 3 non è stata consegnata a chi aveva il diritto di leggerla: di solito il PDF non è nel bundle della funzione (vedi outputFileTracingIncludes in next.config.ts)",
  feedback_elaborato: "il feedback della consegna (v1) non è arrivato",
  alert_email: "l'email di osservabilità non è partita: i guasti di quel giorno non li ha visti nessuno",
};

/**
 * Legge la tabella. NON stampa e NON esce mai dal processo: restituisce
 * `{ visto: true, righe }` oppure `{ visto: false, perche }`.
 *
 * È la forma che serve al rapporto del robot, che non può permettersi né di
 * terminare il processo né di dire «zero» quando non ha guardato.
 */
async function leggiGuasti({ daIso, limite = 500 } = {}) {
  const c = configFacoltativa(["supabaseUrl", "supabaseServiceRoleKey"]);
  if (!c) {
    return {
      visto: false,
      perche: "in .banco.local.json mancano supabaseUrl e/o supabaseServiceRoleKey",
    };
  }

  const filtro = daIso ? `&avvenuto_il=gte.${encodeURIComponent(daIso)}` : "";
  const percorso =
    `guasti?select=avvenuto_il,processo,specie,motivo,dettaglio,iscrizione_id,fase_id,di_prova` +
    `${filtro}&order=avvenuto_il.desc&limit=${limite}`;

  let risposta;
  try {
    risposta = await fetch(`${c.supabaseUrl}/rest/v1/${percorso}`, {
      headers: { apikey: c.supabaseServiceRoleKey, Authorization: `Bearer ${c.supabaseServiceRoleKey}` },
    });
  } catch (errore) {
    return { visto: false, perche: `Supabase non risponde (${errore.message})` };
  }

  if (!risposta.ok) {
    const testo = (await risposta.text()).slice(0, 300);
    // Il caso che capiterà davvero, e che va detto per nome invece che come
    // «404»: la migrazione non è ancora stata applicata. Prima che lo sia,
    // questo comando non può dire niente — ed è importante che lo dica.
    if (risposta.status === 404 || /PGRST205|does not exist|schema cache/i.test(testo)) {
      return {
        visto: false,
        perche:
          "la tabella `public.guasti` non esiste su questo progetto — la migrazione\n" +
          "     20260919100000_guasti.sql non è ancora stata applicata dal SQL Editor",
      };
    }
    return { visto: false, perche: `Supabase ha risposto ${risposta.status}: ${testo}` };
  }

  try {
    return { visto: true, righe: await risposta.json() };
  } catch (errore) {
    return { visto: false, perche: `risposta non leggibile (${errore.message})` };
  }
}

/** Raggruppa per specie, separando produzione e prova. */
function perSpecie(righe) {
  const mappa = new Map();
  for (const g of righe) {
    if (!mappa.has(g.specie)) mappa.set(g.specie, { specie: g.specie, produzione: 0, prova: 0, ultimo: null });
    const v = mappa.get(g.specie);
    if (g.di_prova) v.prova++;
    else v.produzione++;
    if (!v.ultimo) v.ultimo = g; // le righe arrivano già dalla più recente
  }
  const elenco = [...mappa.values()];
  elenco.sort((a, b) => {
    const ia = ORDINE.indexOf(a.specie);
    const ib = ORDINE.indexOf(b.specie);
    // Una specie sconosciuta va in fondo, ma NON sparisce: se un giorno il
    // codice ne scrive una nuova, la si deve vedere senza toccare questo file.
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return elenco;
}

const orario = (iso) => new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// La nota che va stampata SEMPRE, anche (soprattutto) quando la risposta è
// zero: dice cosa questo comando non può vedere.
function notaSuiLimiti() {
  console.log("  Questa tabella si riempie solo se il codice PARTE. Un crash a freddo, un modulo");
  console.log("  che non si carica, una variabile che ferma tutto prima del primo await: niente");
  console.log("  di tutto questo lascia una riga. Per quella classe il guardiano è un altro,");
  console.log("  `npm run test:log5xx`, e questo comando non lo sostituisce.");
}

async function guasti(oreArg) {
  const ore = Number.isFinite(Number(oreArg)) && Number(oreArg) > 0 ? Number(oreArg) : 24;
  const daIso = new Date(Date.now() - ore * 3_600_000).toISOString();

  console.log("");
  console.log(`GUASTI — quello che il motore sa di non aver fatto (ultime ${ore} ore)`);
  console.log("");
  console.log("  Non è `npm run banco log`, che legge gli eventi di build su Vercel: questa è");
  console.log("  una tabella nostra, e resta. I due comandi rispondono a domande diverse.");
  console.log("");

  const esito = await leggiGuasti({ daIso });

  if (!esito.visto) {
    console.log(`  ⚠  NON HO GUARDATO: ${esito.perche}`);
    console.log("");
    console.log("     Questo silenzio NON vuol dire «nessun guasto»: vuol dire che non sono");
    console.log("     riuscito a leggere. Sono due risposte diverse e vanno lette diverse.");
    console.log("");
    return;
  }

  const righe = esito.righe;
  if (righe.length === 0) {
    console.log(`  ✓ ZERO GUASTI registrati nelle ultime ${ore} ore. Ho guardato, e non c'era niente.`);
    console.log("");
    notaSuiLimiti();
    console.log("");
    return;
  }

  const gruppi = perSpecie(righe);
  const produzione = righe.filter((g) => !g.di_prova).length;
  const prova = righe.length - produzione;

  console.log(`  ${righe.length} guasti — ${produzione} in produzione, ${prova} dal robot del banco.`);
  console.log("");

  for (const g of gruppi) {
    const conta = [
      g.produzione ? `${g.produzione} ${g.produzione === 1 ? "vero" : "veri"}` : null,
      g.prova ? `${g.prova} di prova` : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`  ── ${g.specie}  (${conta})`);
    console.log(`     ${COSA_VUOL_DIRE[g.specie] ?? "specie nuova: nessuna glossa ancora scritta per questa"}`);
    const u = g.ultimo;
    const dove = [u.processo, u.fase_id ? `tappa ${u.fase_id}` : null].filter(Boolean).join(" · ");
    console.log(`     ultimo: ${orario(u.avvenuto_il)} — ${dove}${u.motivo ? ` — motivo=${u.motivo}` : ""}`);
    if (u.dettaglio) console.log(`             ${String(u.dettaglio).replace(/\s+/g, " ").slice(0, 160)}`);
    if (u.iscrizione_id) console.log(`             iscrizione ${u.iscrizione_id}`);
    console.log("");
  }

  console.log("  Per vedere dove sta ognuno di quei percorsi:  npm run banco percorso");
  console.log("");
  notaSuiLimiti();
  console.log("");
}

module.exports = { guasti, leggiGuasti, perSpecie, ORDINE, COSA_VUOL_DIRE };
