// Il robot che gioca una missione di Escape, dalla porta.
//
// OGNI GESTO È QUELLO DEL PRODOTTO:
//   · avvio     → insert su `mission_attempt`, come `IniziaMissione`, dopo aver
//                 CHIESTO cosa c'è già (c'è un indice unico sui tentativi in
//                 corso: scoprire un vincolo dall'errore è scavalcare la porta);
//   · risposte  → upsert su `step_response` (onConflict attempt_id,step_id),
//                 come `EscapePlayer`, una alla volta e nell'ordine;
//   · chiusura  → POST /api/escape/finalizza, che rilegge le risposte
//                 autorevoli dal DB, chiama il revisore sui passi aperti e
//                 scrive le prove con `registra_evidence`.
//
// LA MISSIONE SI RICOSTRUISCE A OGNI PASSO, e non è un'inefficienza: il
// contenuto è DINAMICO. Il mandato scelto nella Stanza 1 decide quali
// consulenze esistono nella Stanza 2, e i materiali comprati decidono quali
// voci di budget compaiono nella Stanza 3 — `protocolla_kaur` esiste solo se
// hai letto il regolamento. Un robot che costruisse la missione una volta sola
// all'inizio risponderebbe a una versione che nessuno studente vede.
//
// COSTO: tre chiamate AI per missione, e solo sui passi aperti (i due testi
// scritti e il «non approfondire»). Il resto dello scoring è deterministico.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { eGuasto } = require("./sessione");
const { rispostaPerStep, MISSIONE_DERIVATA } = require("./risposte-percorso");

// Caricati da chi chiama (il comando compila il TypeScript una volta sola).
let getMissione, stepDellaMissione, missionePerArea, percheSenzaCredito;
function collega(moduli) {
  ({ getMissione, stepDellaMissione } = moduli.escape);
  ({ missionePerArea } = moduli.config);
  // La frase del perché arriva dal PRODOTTO (`lib/escape/tipi.ts`), non
  // riscritta qui: è la stessa che il motore mette nel suo log, e due
  // spiegazioni della stessa cosa divergono.
  ({ percheSenzaCredito } = moduli.tipi);
}

// LA MISSIONE DERIVATA È FISSATA NEL BANCO, e questa funzione la confronta con
// quella che il prodotto avrebbe suggerito. Se il banco seguisse il
// suggerimento, il giorno in cui il registro delle missioni cambia il robot
// giocherebbe un'altra missione e nessuno se ne accorgerebbe — e i testi aperti,
// che sono risposte a domande precise, diventerebbero parole a caso.
//
// Quando divergono NON si interrompe: è un'informazione sul prodotto, non un
// guasto del robot. Si dice, e si gioca comunque quella fissata — perché è
// quella per cui i testi sono scritti.
//
// IL CONFRONTO RIGUARDA SOLO LA DERIVATA. Le altre missioni che il robot gioca
// (oggi il cantiere) non sono suggerite da nessuno e non devono esserlo: le
// gioca di proposito per coprire un ramo di codice, e ognuna porta scritto
// quale. Confrontarle col suggerimento produrrebbe un «non coincidono» a ogni
// passata — cioè un avviso che suona sempre, che è un avviso spento.
function confrontaMissione(areaVincente) {
  const suggerita = areaVincente ? missionePerArea(areaVincente) : null;
  return {
    areaVincente: areaVincente ?? null,
    fissata: MISSIONE_DERIVATA,
    suggerita: suggerita?.slug ?? null,
    coincidono: suggerita?.slug === MISSIONE_DERIVATA,
  };
}

// Gli id che uno step OFFRIVA, per gli step il cui insieme di opzioni è
// costruito a runtime dalla partita: il dossier cambia col mandato (le due
// consulenze), le voci del budget e i lavori del piano cambiano coi materiali
// comprati (`seconda_squadra` esiste solo con M10 in mano). Senza questo dato
// una risposta che dipende da cosa era in offerta non si rilegge: nel rapporto
// resterebbe «ha scelto materiali» senza dire fra cosa.
//
// Gli step a opzioni FISSE (le priorità, il mandato, i passi, lo scarto) non
// finiscono qui: quelle liste stanno nel config e chi legge le trova là. Lo
// `assegna_ruoli` ci sta comunque, perché la risposta del robot su quel passo è
// scritta nominando un compito e senza l'elenco non si sa se c'era.
function offertePerStep(step) {
  switch (step.tipo) {
    case "seleziona_informazioni":
      return (step.dossier ?? []).map((d) => d.id);
    case "pianifica_lavori":
      return (step.lavori ?? []).map((l) => l.id);
    case "alloca_budget":
      return (step.voci ?? []).map((v) => v.id);
    case "assegna_ruoli":
      return (step.ruoli ?? []).map((r) => r.id);
    default:
      return null;
  }
}

// `missionSlug` non ha un default: vedi `rispostaPerStep`. Chi gioca nomina la
// missione, sempre.
async function giocaMissione({ sessione, missionSlug, registra }) {
  if (!missionSlug) throw new Error("giocaMissione: serve il missionSlug — non c'è un default, e non deve esserci");
  const { supabase, chiama, utente } = sessione;
  const di = (t) => registra(`  ${t}`);
  const esito = { missionSlug, passi: [], fermato: null };

  // ── 1. il tentativo ──────────────────────────────────────────────────────
  const { data: inCorso } = await supabase
    .from("mission_attempt")
    .select("id, stato")
    .eq("student_id", utente.id)
    .eq("mission_slug", missionSlug)
    .eq("stato", "in_corso")
    .maybeSingle();

  let attempt = inCorso ?? null;
  if (attempt) {
    di("c'era già un tentativo in corso: lo riprende");
  } else {
    const { data, error } = await supabase
      .from("mission_attempt")
      .insert({ student_id: utente.id, mission_slug: missionSlug })
      .select("id")
      .single();
    if (error) return { ...esito, fermato: { dove: "avvio", perche: error.message } };
    attempt = data;
    di("tentativo aperto");
  }
  esito.attemptId = attempt.id;

  // Le risposte già date (una ripresa non ricomincia da capo), rilette dal DB:
  // sono loro a decidere che forma ha la missione.
  const { data: giaDate } = await supabase.from("step_response").select("step_id, payload").eq("attempt_id", attempt.id);
  const risposte = new Map((giaDate ?? []).map((r) => [r.step_id, r.payload]));
  if (risposte.size) di(`${risposte.size} passi già risposti in un tentativo precedente`);

  // ── 2. i passi, uno alla volta, ricostruendo ogni volta ──────────────────
  const leggi = (id) => risposte.get(id);
  for (let giro = 0; giro < 50; giro++) {
    const missione = getMissione(missionSlug, leggi);
    if (!missione) return { ...esito, fermato: { dove: "costruzione", perche: `la missione «${missionSlug}» non esiste nel registro` } };
    const steps = stepDellaMissione(missione);
    const prossimo = steps.find((s) => !risposte.has(s.id));
    if (!prossimo) break;

    const payload = rispostaPerStep(missionSlug, prossimo);
    if (!payload) {
      // NON SI INVENTA UNA RISPOSTA. Se la missione guadagna un passo di un
      // tipo che il robot non sa trattare, si ferma dicendolo: una risposta
      // plausibile inventata qui produrrebbe una misura che sembra buona.
      return {
        ...esito,
        fermato: {
          dove: prossimo.id,
          perche: `nessuna risposta per un passo di tipo «${prossimo.tipo}»: né una scritta per «${missionSlug}», né la regola generica, che quel tipo non lo copre`,
        },
      };
    }

    const { error } = await supabase
      .from("step_response")
      .upsert({ attempt_id: attempt.id, stanza: prossimo.stanza, step_id: prossimo.id, tipo: prossimo.tipo, payload }, { onConflict: "attempt_id,step_id" });
    if (error) {
      return { ...esito, fermato: { dove: prossimo.id, perche: `la risposta è stata rifiutata: ${error.message}` } };
    }
    risposte.set(prossimo.id, payload);
    esito.passi.push({ id: prossimo.id, tipo: prossimo.tipo, stanza: prossimo.stanza, offerte: offertePerStep(prossimo) });
    di(`${prossimo.id} · ${prossimo.tipo}`);
  }

  // ── 3. la chiusura, che è anche l'unica parte a pagamento ────────────────
  const fine = await chiama("/api/escape/finalizza", { attemptId: attempt.id });
  if (fine.status >= 400) {
    return {
      ...esito,
      fermato: { dove: "finalizzazione", perche: `ha risposto ${fine.status}: ${fine.dati?.errore ?? fine.testo.slice(0, 120)}`, guasto: eGuasto(fine.status) },
    };
  }
  di("finalizzata");

  // IL PERCHÉ DELL'ESITO DEL REVISORE, dalla risposta della route.
  //
  // Tre stati distinti nel dato, e vanno tenuti distinti anche qui:
  //   · la CHIAVE ASSENTE  = il deploy che ha risposto non sa dirlo (codice più
  //     vecchio di questo banco) → «non ho guardato», mai «nessuna diagnosi»;
  //   · `null`             = il revisore non ha girato (nessun testo, chiave AI
  //     assente, chiamata fallita) — e lì l'esito è già `non_riuscito`;
  //   · l'oggetto          = i numeri veri.
  // La chiave si OMETTE quando è assente (JSON.stringify la lascia fuori): così
  // in un rapporto la sua presenza dice che quella passata sapeva guardare, come
  // per `ripresa` nei workshop.
  if (fine.dati && Object.prototype.hasOwnProperty.call(fine.dati, "revisore")) {
    esito.revisoreDiagnosi = fine.dati.revisore ?? null;
  }

  // L'esito del revisore, che è la cosa per cui questa passata costa qualcosa.
  // Tre stati distinti (letto / letto_senza_credito / non_riuscito): un
  // fallimento che si chiama per nome è un fallimento che si ripara.
  const { data: chiuso } = await supabase
    .from("mission_attempt")
    .select("stato, revisore_esito")
    .eq("id", attempt.id)
    .maybeSingle();
  esito.stato = chiuso?.stato ?? null;
  esito.revisoreEsito = chiuso?.revisore_esito ?? null;

  // Le prove scritte: servono al rapporto per dire cosa ha prodotto la partita
  // senza che nessuno debba aprire il DB.
  const { data: prove } = await supabase
    .from("evidence")
    .select("dimensione, area_slug, valore, peso, motivazione")
    .eq("attempt_id", attempt.id);
  esito.prove = prove ?? [];

  return esito;
}

// LE RIGHE DELL'ESITO DEL REVISORE, pura: l'unica cosa che questa funzione fa è
// decidere COSA si può dire, e lo si prova senza rete.
//
// La proprietà che tiene: `letto_senza_credito` non si stampa mai da solo.
// Quell'esito costa allo studente una dimensione intera dopo che ha scritto
// davvero, ed è comparso in cinque rapporti su sei senza che nessuno lo leggesse
// — perché era una parola. Una parola che non dice perché si salta.
//
// E i tre silenzi restano tre: «il deploy non lo dice», «il revisore non ha
// girato» e «zero aree proposte» sono tre cose diverse, e la prima non è una
// risposta — è l'assenza di una risposta.
function spiegaRevisore(esito) {
  const righe = [];
  const stato = esito.revisoreEsito ?? "nessun esito scritto";
  righe.push(`  stato: ${esito.stato ?? "?"} · revisore: ${stato}`);

  const haChiave = Object.prototype.hasOwnProperty.call(esito, "revisoreDiagnosi");
  if (!haChiave) {
    righe.push("    ⚠  perché: NON HO GUARDATO — il deploy che ha risposto non porta la diagnosi.");
    righe.push("       Non vuol dire che non c'è un perché: vuol dire che questa passata non lo sa.");
    return righe;
  }
  const d = esito.revisoreDiagnosi;
  if (!d) {
    righe.push("    perché: il revisore non ha girato su questa proposta (nessun testo, o la chiamata non è partita).");
    return righe;
  }

  righe.push(`    il revisore ha proposto ${d.proposte} aree, ${d.ammesse} sono passate dalla whitelist (${d.candidate.length} ammesse).`);
  if (d.ammesse === 0) {
    righe.push(`    ⚠  SENZA CREDITO D'AREA: ${percheSenzaCredito(d)}`);
    righe.push(`       ${d.giudizio ? "Ha però una frase di sintesi, ed è l'unica cosa che dice a chi ha scritto." : "E non ha nemmeno una frase di sintesi: allo studente non resta niente."}`);
  } else if (d.scartate.length > 0) {
    // Uno scarto PARZIALE oggi non si vede da nessuna parte: l'esito dice
    // «letto» e il conto delle prove non dice quante ne sono cadute.
    righe.push(`    (${d.scartate.length} scartate anche se l'esito è «letto»: ${d.scartate.join(", ")})`);
  }
  return righe;
}

module.exports = { collega, giocaMissione, confrontaMissione, offertePerStep, spiegaRevisore };
