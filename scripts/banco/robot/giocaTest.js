// Il robot che fa i tre test attitudinali, dalla porta.
//
// OGNI GESTO È QUELLO DEL PRODOTTO:
//   · T1/T2 — insert su `test_attempt`, come `IniziaTest`;
//   · T3    — POST /api/test/t3/inizia, come `IniziaTestT3`. NON un insert
//             diretto: il congelamento delle candidate dev'essere atomico con
//             la creazione del tentativo, ed è la route a garantirlo;
//   · le risposte — upsert su `test_response` (onConflict attempt_id,item_id),
//             esattamente come `TestPlayer`;
//   · la chiusura — POST /api/test/finalizza, che rilegge le risposte
//             AUTOREVOLI dal DB e chiama `registra_evidenze_test`.
//
// NESSUNA CHIAMATA AI: lo scoring dei test è deterministico. Tre test costano
// zero — il costo di questo pezzo è codice e contenuto, non soldi.
//
// SE UN GATE BLOCCA, IL ROBOT SI FERMA E LO RIPORTA. Vale qui come per i
// workshop: T3 sotto le tre aree candidate risponde `{fallback:true}` e non
// crea niente, ed è un risultato da leggere, non un ostacolo da aggirare.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { eGuasto } = require("./sessione");
const { T1_RISPOSTE, T2_RISPOSTE, scegliT3 } = require("./risposte-percorso");

// Caricati da chi chiama (il comando compila il TypeScript una volta sola).
let SLUG_T1, SLUG_T2, SLUG_T3, assemblaT3, T3_FROZEN_ITEM_ID;
function collega(moduli) {
  ({ SLUG_T1, SLUG_T2, SLUG_T3 } = moduli.config);
  ({ assemblaT3, T3_FROZEN_ITEM_ID } = moduli.assembla);
}

// SI CHIEDE PRIMA DI INSERIRE, come per i workshop. C'è un indice unico sui
// tentativi in corso — uno per (studente, test) — e scoprire un vincolo
// dall'errore è l'unico gesto del robot che scavalcherebbe la porta.
async function tentativoInCorso(supabase, utenteId, slug) {
  const { data } = await supabase
    .from("test_attempt")
    .select("id, stato")
    .eq("student_id", utenteId)
    .eq("test_slug", slug)
    .eq("stato", "in_corso")
    .maybeSingle();
  return data ?? null;
}

async function salvaRisposte(supabase, attemptId, risposte) {
  // Una alla volta, come il player: un upsert in blocco sarebbe una scrittura
  // che nel prodotto non esiste, e non proverebbe la stessa policy.
  for (const [itemId, payload] of risposte) {
    const { error } = await supabase
      .from("test_response")
      .upsert({ attempt_id: attemptId, item_id: itemId, payload }, { onConflict: "attempt_id,item_id" });
    if (error) return { errore: `risposta «${itemId}» rifiutata: ${error.message}` };
  }
  return {};
}

async function finalizza(chiama, attemptId) {
  const r = await chiama("/api/test/finalizza", { attemptId });
  if (r.status >= 400) {
    return { errore: `la finalizzazione ha risposto ${r.status}: ${r.dati?.errore ?? r.testo.slice(0, 120)}`, guasto: eGuasto(r.status) };
  }
  return {};
}

// ── T1 e T2: stessa forma, risposte scritte ───────────────────────────────
async function giocaTestSemplice({ sessione, slug, risposte, registra }) {
  const { supabase, chiama, utente } = sessione;
  const di = (t) => registra(`  ${t}`);

  let attempt = await tentativoInCorso(supabase, utente.id, slug);
  if (attempt) {
    di("c'era già un tentativo in corso: lo riprende");
  } else {
    const { data, error } = await supabase
      .from("test_attempt")
      .insert({ student_id: utente.id, test_slug: slug })
      .select("id")
      .single();
    if (error) return { slug, fermato: { dove: "avvio", perche: error.message } };
    attempt = data;
    di("tentativo aperto");
  }

  const salvate = await salvaRisposte(supabase, attempt.id, Object.entries(risposte));
  if (salvate.errore) return { slug, fermato: { dove: "risposte", perche: salvate.errore } };
  di(`${Object.keys(risposte).length} risposte salvate`);

  const chiuso = await finalizza(chiama, attempt.id);
  if (chiuso.errore) return { slug, fermato: { dove: "finalizzazione", perche: chiuso.errore, guasto: chiuso.guasto } };
  di("finalizzato");
  return { slug, attemptId: attempt.id };
}

// ── T3: gli item non esistono finché non si assemblano ────────────────────
async function giocaT3({ sessione, registra }) {
  const { supabase, chiama, utente } = sessione;
  const di = (t) => registra(`  ${t}`);

  // La route crea il tentativo E congela le candidate, in un gesto solo.
  const avvio = await chiama("/api/test/t3/inizia", null);
  if (avvio.status >= 400) {
    return { slug: SLUG_T3, fermato: { dove: "avvio", perche: `la route ha risposto ${avvio.status}: ${avvio.dati?.errore ?? ""}`, guasto: eGuasto(avvio.status) } };
  }
  // NON È UN GUASTO, È UN CANCELLO: sotto le tre aree candidate T3 non si fa,
  // e la pagina invita a fare prima T1. Se capita qui vuol dire che T1 non ha
  // prodotto abbastanza aree — cioè che è cambiato qualcosa nel profilo, che è
  // esattamente la cosa da leggere.
  if (avvio.dati?.fallback) {
    return { slug: SLUG_T3, fermato: { dove: "avvio", perche: "il prodotto dice che le aree candidate sono meno di tre (fallback): T3 non parte" } };
  }

  const attempt = await tentativoInCorso(supabase, utente.id, SLUG_T3);
  if (!attempt) return { slug: SLUG_T3, fermato: { dove: "avvio", perche: "la route ha risposto ok ma non risulta nessun tentativo in corso" } };

  // Le candidate congelate: si rileggono dal DB, non si ricalcolano. È il
  // punto del congelamento — se un altro test muovesse area_signal a metà, T3
  // non deve cambiare le domande sotto i piedi.
  const { data: frozen } = await supabase
    .from("test_response")
    .select("payload")
    .eq("attempt_id", attempt.id)
    .eq("item_id", T3_FROZEN_ITEM_ID)
    .maybeSingle();
  const congelate = frozen?.payload ?? null;
  if (!congelate?.candidate?.length) {
    return { slug: SLUG_T3, fermato: { dove: "avvio", perche: "tentativo creato ma nessuna riga di congelamento leggibile" } };
  }
  di(`candidate: ${congelate.candidate.join(", ")}${congelate.asseDominante ? ` · asse dominante ${congelate.asseDominante}` : ""}`);

  // Stessa funzione che usa il player e che riuserà lo scoring: gli item sono
  // gli stessi per costruzione, non per fortuna.
  const items = assemblaT3(congelate, attempt.id);
  if (!items.length) return { slug: SLUG_T3, fermato: { dove: "assemblaggio", perche: "nessun item assemblato dalle candidate congelate" } };

  const risposte = items.map((it) => [it.id, { opzioneId: scegliT3(it) }]);
  const salvate = await salvaRisposte(supabase, attempt.id, risposte);
  if (salvate.errore) return { slug: SLUG_T3, fermato: { dove: "risposte", perche: salvate.errore } };
  di(`${risposte.length} risposte salvate`);

  const chiuso = await finalizza(chiama, attempt.id);
  if (chiuso.errore) return { slug: SLUG_T3, fermato: { dove: "finalizzazione", perche: chiuso.errore, guasto: chiuso.guasto } };
  di("finalizzato");
  return { slug: SLUG_T3, attemptId: attempt.id, candidate: congelate.candidate };
}

// Il profilo come il prodotto lo vede dopo i tre test. Serve al rapporto e
// alle due proprietà che contano (stabilità fra due passate, non degenerazione).
async function leggiProfilo(sessione) {
  const { supabase, utente } = sessione;
  const [{ data: aree }, { data: stili }] = await Promise.all([
    supabase.from("area_signal").select("area_slug, interest_score, confidence, status").eq("student_id", utente.id).order("interest_score", { ascending: false }),
    supabase.from("style_signal").select("asse, punteggio").eq("student_id", utente.id).order("punteggio", { ascending: false }),
  ]);
  return {
    aree: (aree ?? []).map((a) => ({ area: a.area_slug, punteggio: Number(a.interest_score) || 0, status: a.status })),
    assi: (stili ?? []).map((s) => ({ asse: s.asse, punteggio: Number(s.punteggio) || 0 })),
  };
}

async function giocaTest({ sessione, registra }) {
  const esiti = [];

  registra("── T1 «Da dove parti»");
  esiti.push(await giocaTestSemplice({ sessione, slug: SLUG_T1, risposte: T1_RISPOSTE, registra }));
  if (esiti[0].fermato) return { esiti, profilo: null };

  registra("── T2 «Come ti muovi»");
  esiti.push(await giocaTestSemplice({ sessione, slug: SLUG_T2, risposte: T2_RISPOSTE, registra }));
  if (esiti[1].fermato) return { esiti, profilo: null };

  // T3 DOPO gli altri due, e non è un dettaglio di comodità: le sue candidate
  // sono le aree già emerse, quindi prima dei primi due non esisterebbe.
  registra("── T3 «Più a fondo»");
  esiti.push(await giocaT3({ sessione, registra }));

  const profilo = await leggiProfilo(sessione);
  return { esiti, profilo };
}

module.exports = { collega, giocaTest, leggiProfilo };
