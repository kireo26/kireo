// La sessione del robot — DALLA PORTA, non dalla finestra.
//
// È il pezzo su cui poggia tutto il resto, e la scelta che conta è una sola:
// il robot NON si fabbrica i cookie a mano e NON usa la service-role. Fa il
// login con email e password, esattamente come uno studente, e i cookie di
// sessione li produce `@supabase/ssr` — la stessa libreria, nella stessa
// versione, che le route del sito usano per rileggerli. Così il formato è
// giusto per costruzione invece che per fortuna, e resta giusto il giorno in
// cui la libreria cambia il modo di scriverli.
//
// La ragione per cui questo vincolo non è pedanteria: la scoperta migliore del
// 30 agosto — la checklist che obbligava a spuntare una voce — è venuta da un
// gate che ha morso. Un robot entrato dalla porta di servizio non l'avrebbe
// trovata, e avrebbe anzi certificato che tutto funzionava.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { createServerClient } = require("@supabase/ssr");
const { config, esci } = require("../config");

// Barattolo di cookie in memoria: `@supabase/ssr` ci scrive dentro il token di
// sessione al login, e da lì si costruisce l'intestazione Cookie per le
// chiamate alle route del sito.
function barattolo() {
  const dentro = new Map();
  return {
    getAll: () => [...dentro.entries()].map(([name, value]) => ({ name, value })),
    setAll: (elenco) => {
      for (const { name, value } of elenco) {
        if (value === "" ) dentro.delete(name);
        else dentro.set(name, value);
      }
    },
    intestazione: () =>
      [...dentro.entries()].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; "),
    vuoto: () => dentro.size === 0,
  };
}

// Apre la sessione e restituisce tutto quello che serve al robot: il client
// autenticato (per le scritture che nel prodotto fa il browser — iscrizione e
// salvataggio automatico) e `chiama`, che parla con le route del sito
// portandosi dietro i cookie.
// UN solo ritentativo, e a due condizioni: solo sulle ECCEZIONI, e solo in
// LETTURA.
//
// Sulle eccezioni perché un `fetch failed` non è una risposta del prodotto, è
// l'assenza di una risposta: riprovare non aggira nessun cancello. Un 4xx o un
// 5xx invece è una risposta, e si riporta com'è.
//
// SOLO IN LETTURA, e questa metà è arrivata dopo, il 2026-08-31, pagando. Il
// ritentativo era su ogni POST, e un ritentativo su una scrittura È UN SECONDO
// INVIO: il robot non può sapere se la prima è arrivata. Sul quarto messaggio
// al cliente — quello che raggiunge la chat minima e fa scattare la chiusura
// deterministica — la risposta si è persa per strada, il ritentativo l'ha
// rimandato, e il server ha giustamente detto «per questa tappa hai già
// parlato abbastanza». In tabella sono rimasti TREDICI messaggi dove il minimo
// ne voleva dodici: l'impronta di un invio in più.
//
// L'ironia, che è la parte da non perdere: il ritentativo era nato quella
// mattina per togliere i `fetch failed` dalla lista dei guasti, e invece li ha
// SPOSTATI nella lista dei cancelli — quella preziosa, quella da cui ricaviamo
// i difetti veri del prodotto. Ha peggiorato la cosa che doveva migliorare, e
// l'ha fatto rendendo il sintomo irriconoscibile: un `fetch failed` si legge
// per quello che è, un 429 sembra un verdetto.
//
// La regola generale: un ritentativo è sicuro solo dove ripetere non è un
// atto. Se a valle qualcosa CONTA le azioni — un tetto, un minimo, una
// chiusura — il ritentativo non ripara il guasto: lo traveste da
// comportamento del prodotto.
async function conUnRitentativo(azione) {
  try {
    return await azione();
  } catch (primo) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      return await azione();
    } catch {
      throw primo; // si riporta la prima, che è quella vera
    }
  }
}

async function apriSessione() {
  const c = config(["sitoUrl", "supabaseUrl", "supabaseAnonKey", "robotEmail", "robotPassword"]);
  const jar = barattolo();

  const supabase = createServerClient(c.supabaseUrl, c.supabaseAnonKey, {
    cookies: { getAll: jar.getAll, setAll: jar.setAll },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: c.robotEmail,
    password: c.robotPassword,
  });
  if (error || !data?.user) {
    esci(
      `Il robot non riesce ad accedere come ${c.robotEmail}:\n  ${error?.message ?? "nessun utente restituito"}\n\n` +
        `Controlla robotEmail e robotPassword in .banco.local.json, e che quell'account esista\n` +
        `davvero (il robot non crea utenti: si registra a mano, una volta, dal sito).`,
    );
  }
  if (jar.vuoto()) {
    esci("Login riuscito ma nessun cookie di sessione prodotto: le route del sito rifiuterebbero le chiamate.");
  }

  // LA PRECONDIZIONE, RESA OPERATIVA. Il flag non serve a niente se qualcuno
  // lancia il robot con un account vero: quelle righe finirebbero nelle misure
  // e non si distinguerebbero mai più. Quindi si controlla qui, prima di
  // scrivere qualunque cosa, e se non è marcato NON SI PARTE.
  const { data: profilo, error: erroreProfilo } = await supabase
    .from("profiles")
    .select("nome, ruolo, di_prova")
    .eq("id", data.user.id)
    .maybeSingle();

  if (erroreProfilo || !profilo) {
    esci(`L'account ${c.robotEmail} non ha un profilo in \`profiles\`: registralo dal sito prima di usarlo.`);
  }
  if (profilo.ruolo !== "studente") {
    esci(`L'account ${c.robotEmail} ha ruolo «${profilo.ruolo}»: il robot gioca come studente, e con un altro ruolo i gate non sarebbero quelli veri.`);
  }
  if (profilo.di_prova !== true) {
    esci(
      `L'account ${c.robotEmail} NON è marcato come profilo di prova.\n\n` +
        `Il robot si rifiuta di partire: le righe che scriverebbe finirebbero in mezzo a\n` +
        `quelle degli studenti veri, e da lì non si distinguono più — è l'unica cosa di\n` +
        `tutta questa architettura che dopo non si aggiusta.\n\n` +
        `Marcalo da admin (o con la service-role) nel SQL Editor:\n` +
        `    update public.profiles set di_prova = true where id = '${data.user.id}';\n\n` +
        `Il trigger blocca chiunque non sia admin, quindi non basta farlo dalla sessione dell'account stesso.`,
    );
  }

  // Le chiamate alle route del sito: le stesse che fa il browser, con i cookie
  // veri. Nessuna intestazione speciale, nessuna scorciatoia.
  async function chiama(percorso, corpo, metodo = "POST") {
    const invia = () =>
      fetch(`${c.sitoUrl}${percorso}`, {
        method: metodo,
        headers: {
          Cookie: jar.intestazione(),
          ...(corpo ? { "Content-Type": "application/json" } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
        redirect: "follow",
      });
    // Solo GET: rileggere una pagina due volte non cambia niente al mondo.
    const risposta = metodo === "GET" ? await conUnRitentativo(invia) : await invia();
    const testo = await risposta.text();
    let dati = null;
    try {
      dati = JSON.parse(testo);
    } catch {
      /* alcune risposte sono HTML: è il caso delle pagine */
    }
    return { status: risposta.status, dati, testo };
  }

  return { supabase, chiama, utente: data.user, profilo, sitoUrl: c.sitoUrl };
}

module.exports = { apriSessione };
