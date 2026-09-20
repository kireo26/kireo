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
let SLUG_T1, SLUG_T2, SLUG_T3, assemblaT3, T3_FROZEN_ITEM_ID, calcolaEvidenzeT3, caricaAffinitaHome;
function collega(moduli) {
  ({ SLUG_T1, SLUG_T2, SLUG_T3 } = moduli.config);
  ({ assemblaT3, T3_FROZEN_ITEM_ID } = moduli.assembla);
  ({ calcolaEvidenzeT3 } = moduli.scoring);
  ({ caricaAffinitaHome } = moduli.percorso);
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

  // L'AREA CHE VINCE IL TORNEO, calcolata dalla funzione del prodotto.
  //
  // È quella che decide la missione suggerita: la pagina di esito di T3 fa
  // `classifica[0]?.area_slug` e la passa a `missionePerArea`. NON è la prima
  // riga di `area_signal` ordinata per punteggio — sono due calcoli diversi
  // (un torneo a incontri contro una media pesata), e nel robot coincidono
  // solo per come è fatto il suo profilo. Finché il banco passava la seconda
  // chiamandola `areaVincente`, il confronto sulla missione diceva «✓
  // coincidono» per la ragione sbagliata.
  const classifica = calcolaEvidenzeT3(congelate, attempt.id, new Map(risposte)).classifica;
  const vincitrice = classifica[0]?.area_slug ?? null;
  di(`vince il torneo: ${vincitrice ?? "nessuna"}`);
  return { slug: SLUG_T3, attemptId: attempt.id, candidate: congelate.candidate, vincitrice };
}

// IL PROFILO COME LO MOSTRA LA HOME, non come sta in tabella.
//
// Questa funzione ordinava le righe di `area_signal` per `interest_score` e le
// stampava come una classifica. Il prodotto non fa così: `caricaAffinitaHome`
// applica una BARRA — ≥2 attività distinte E un interesse dichiarato — e
// un'area che non la passa **non finisce in fondo alla classifica, finisce
// fuori**, fra le «aree sfiorate», con accanto la sua prova più forte e senza
// punteggio.
//
// Il 20/09 quella differenza ha prodotto due letture sbagliate in due giorni:
// sul robot `scienze-educazione` ha solo la missione (sfiorata, per il
// prodotto) e il banco la mostrava SOPRA `salute`, che è confermata con due
// attività. Da lì «il profilo ribalta l'area su cui ha lavorato di più» —
// vero dello strumento, falso del prodotto. Il commento che stava qui diceva
// «il profilo come il prodotto lo vede»: la specie di casa, una proprietà
// dichiarata guardando l'intenzione.
//
// Quindi non si riordina più niente: si CHIEDE alla stessa funzione che
// riempie la home. Una copia della barra qui sarebbe la seconda definizione
// della stessa regola, e divergerebbe al primo che ne tocca una.
async function leggiProfilo(sessione) {
  const { supabase, utente } = sessione;
  // Il conteggio grezzo NON serve a ordinare: serve a distinguere «il profilo
  // è vuoto» da «non sono riuscito a leggerlo». `caricaAffinitaHome` degrada a
  // un profilo vuoto sia quando non c'è niente sia quando la query fallisce —
  // giusto per una pagina, cieco per un banco. `haAttivita` è il discrimine:
  // è true solo se la lettura è andata a buon fine e ha trovato righe.
  const [affinita, { count: righeArea }, { data: stili }] = await Promise.all([
    caricaAffinitaHome(supabase, utente.id),
    supabase.from("area_signal").select("area_slug", { count: "exact", head: true }).eq("student_id", utente.id),
    supabase.from("style_signal").select("asse, punteggio").eq("student_id", utente.id).order("punteggio", { ascending: false }),
  ]);
  return {
    affinita,
    righeArea: righeArea ?? null,
    lettura: (righeArea ?? 0) > 0 && !affinita.haAttivita ? "fallita" : "ok",
    assi: (stili ?? []).map((s) => ({ asse: s.asse, punteggio: Number(s.punteggio) || 0 })),
  };
}

// La stampa, in un posto solo: la usano il profilo dopo i test e quello dopo
// la missione, e due copie direbbero due cose diverse il giorno in cui una
// viene toccata.
function stampaProfilo(profilo, scrivi) {
  if (profilo.lettura === "fallita") {
    scrivi(`   ⚠  NON HO POTUTO LEGGERLO: in area_signal ci sono ${profilo.righeArea} righe, ma la`);
    scrivi("      lettura come la fa la home non ha restituito niente. Non è un profilo vuoto.");
    return;
  }
  if (profilo.affinita.eleggibili.length === 0 && profilo.affinita.sfiorate.length === 0) {
    scrivi("   nessuna area: il profilo è vuoto (ho guardato).");
  }
  if (profilo.affinita.eleggibili.length > 0) {
    scrivi("   affinità — in classifica:");
    for (const a of profilo.affinita.eleggibili) {
      scrivi(`     ${a.slug.padEnd(34)} ${String(a.interest).padStart(3)}  ${a.status}`);
    }
  }
  if (profilo.affinita.sfiorate.length > 0) {
    scrivi("   aree sfiorate — FUORI dalla classifica, non in fondo:");
    for (const s of profilo.affinita.sfiorate) {
      scrivi(`     ${s.nome}${s.motivazione ? ` — ${s.motivazione}` : ""}`);
    }
  }
  // La barra si dichiara ogni volta, sotto le due liste: è l'unica cosa che
  // impedisce di rileggere le due liste come una classifica sola.
  scrivi("   · la barra è quella di lib/percorso/stato.ts: ≥2 attività distinte E un interesse");
  scrivi("     dichiarato. Le sfiorate non hanno un punteggio perché il prodotto non gliene");
  scrivi("     mostra uno: ordinarle insieme alle altre sarebbe una classifica che non esiste.");
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

module.exports = { collega, giocaTest, leggiProfilo, stampaProfilo };
