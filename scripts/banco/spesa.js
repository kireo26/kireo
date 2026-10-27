// `npm run banco spesa [giorni]` — quello che paghiamo al modello (27/10).
//
// Legge `consumo_ai_giorno` (20261104150000): una riga per giorno (ora
// italiana), processo, modello e profili di prova, sommata dopo ogni risposta.
// Sola lettura.
//
// LA COSA CHE QUESTO COMANDO DEVE SAPER DIRE, come `banco guasti`: la
// differenza fra «zero» e «non ho guardato». E una seconda, che va detta anche
// quando i numeri ci sono: cosa la tabella NON vede (nota in fondo).
//
// Somma per GIORNO e in totale, mai per persona: la tabella non ha persone,
// apposta. *Un tetto per persona limita una persona, e le persone si creano
// gratis* (Mario) — il numero che conta è quanto paghiamo, non quanto paga
// ciascuno.
//
// Token, non euro: il prezzo dipende dal modello e cambia, e un numero in euro
// scritto qui invecchierebbe in silenzio. Si moltiplica a mano, con il listino
// del giorno.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { configFacoltativa } = require("./config");

async function leggiSpesa({ daGiorno } = {}) {
  const c = configFacoltativa(["supabaseUrl", "supabaseServiceRoleKey"]);
  if (!c) return { visto: false, perche: "in .banco.local.json mancano supabaseUrl e/o supabaseServiceRoleKey" };
  const filtro = daGiorno ? `&giorno=gte.${daGiorno}` : "";
  const percorso = `consumo_ai_giorno?select=*${filtro}&order=giorno.desc,processo.asc&limit=5000`;
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
    if (risposta.status === 404 || /PGRST205|does not exist|schema cache/i.test(testo)) {
      return { visto: false, perche: "la tabella `public.consumo_ai_giorno` non esiste: la migrazione 20261104150000_consumo_ai.sql non è applicata" };
    }
    return { visto: false, perche: `Supabase ha risposto ${risposta.status}: ${testo}` };
  }
  try {
    return { visto: true, righe: await risposta.json() };
  } catch (errore) {
    return { visto: false, perche: `risposta non leggibile (${errore.message})` };
  }
}

/** Somma pura, provata da `npm run test:consumo`: per giorno e per processo, separando la prova. */
function riassumiSpesa(righe) {
  const vuoto = () => ({ chiamate: 0, input: 0, output: 0, cacheScrittura: 0, cacheLettura: 0 });
  const somma = (a, r) => {
    a.chiamate += Number(r.chiamate) || 0;
    a.input += Number(r.token_input) || 0;
    a.output += Number(r.token_output) || 0;
    a.cacheScrittura += Number(r.token_cache_scrittura) || 0;
    a.cacheLettura += Number(r.token_cache_lettura) || 0;
  };
  const perGiorno = new Map();
  const perProcesso = new Map();
  const totale = { produzione: vuoto(), prova: vuoto() };
  for (const r of righe) {
    const lato = r.di_prova ? "prova" : "produzione";
    if (!perGiorno.has(r.giorno)) perGiorno.set(r.giorno, { produzione: vuoto(), prova: vuoto() });
    somma(perGiorno.get(r.giorno)[lato], r);
    const chiave = `${r.processo} · ${r.modello}`;
    if (!perProcesso.has(chiave)) perProcesso.set(chiave, { produzione: vuoto(), prova: vuoto() });
    somma(perProcesso.get(chiave)[lato], r);
    somma(totale[lato], r);
  }
  return { perGiorno, perProcesso, totale };
}

const n = (v) => v.toLocaleString("it-IT");
const riga = (s) => `${n(s.chiamate)} chiamate · ${n(s.input)} in · ${n(s.output)} out · cache ${n(s.cacheScrittura)} scritti / ${n(s.cacheLettura)} letti`;

async function spesa(giorniArg) {
  const giorni = Number.isFinite(Number(giorniArg)) && Number(giorniArg) > 0 ? Number(giorniArg) : 7;
  const da = new Date(Date.now() - (giorni - 1) * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });

  console.log("");
  console.log(`SPESA — quello che paghiamo al modello (ultimi ${giorni} giorni, ora italiana, dal ${da})`);
  console.log("");
  const esito = await leggiSpesa({ daGiorno: da });
  if (!esito.visto) {
    console.log(`  ⚠️ NON HO GUARDATO: ${esito.perche}`);
    console.log("     Questo NON vuol dire che non si è speso niente.");
    console.log("");
    return;
  }
  if (esito.righe.length === 0) {
    console.log("  Zero chiamate registrate nella finestra: ho guardato, e la tabella è vuota.");
  } else {
    const { perGiorno, perProcesso, totale } = riassumiSpesa(esito.righe);
    console.log(`  Totale produzione: ${riga(totale.produzione)}`);
    console.log(`  Totale prova:      ${riga(totale.prova)}`);
    console.log("");
    console.log("  Per giorno (produzione):");
    for (const [g, v] of perGiorno) console.log(`    ${g}  ${riga(v.produzione)}${v.prova.chiamate ? `   (+ prova: ${n(v.prova.chiamate)} chiamate)` : ""}`);
    console.log("");
    console.log("  Per processo (produzione):");
    for (const [p, v] of [...perProcesso].sort((a, b) => b[1].produzione.input - a[1].produzione.input)) {
      console.log(`    ${p}`);
      console.log(`        ${riga(v.produzione)}${v.prova.chiamate ? `   (+ prova: ${n(v.prova.chiamate)} chiamate)` : ""}`);
    }
  }
  console.log("");
  console.log("  Cosa questa tabella NON vede: una chiamata fallita prima della risposta; lo");
  console.log("  stream dell'assistente interrotto a metà (si paga, il consumo arriva solo alla");
  console.log("  fine); gli script lanciati in locale (`npm run misura:genere`), che chiamano il");
  console.log("  modello senza passare dal prodotto. Token, non euro: il prezzo si moltiplica a mano.");
  console.log("  Le chiamate di `assistente` qui sono RISPOSTE ricevute; il tetto dell'assistente");
  console.log("  conta le RICHIESTE (`assistente_richieste`, scritte prima della chiamata). La");
  console.log("  differenza fra i due è il numero delle richieste rimaste senza risposta: non è");
  console.log("  un disallineamento.");
  console.log("");
}

module.exports = { spesa, leggiSpesa, riassumiSpesa };
