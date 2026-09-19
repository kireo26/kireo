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
// COSTO: tre chiamate AI, e solo sui passi aperti (la risposta alla mail, la
// riflessione, il «non approfondire»). Il resto dello scoring è deterministico.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { eGuasto } = require("./sessione");
const { rispostaPerStep, MISSIONE_FISSATA } = require("./risposte-percorso");

// Caricati da chi chiama (il comando compila il TypeScript una volta sola).
let getMissione, stepDellaMissione, missionePerArea;
function collega(moduli) {
  ({ getMissione, stepDellaMissione } = moduli.escape);
  ({ missionePerArea } = moduli.config);
}

// LA MISSIONE È FISSATA NEL BANCO, e questa funzione la confronta con quella
// che il prodotto avrebbe suggerito. Se il banco seguisse il suggerimento, il
// giorno in cui il registro delle missioni cambia il robot giocherebbe
// un'altra missione e nessuno se ne accorgerebbe — e i testi aperti, che sono
// risposte a domande precise, diventerebbero parole a caso.
//
// Quando divergono NON si interrompe: è un'informazione sul prodotto, non un
// guasto del robot. Si dice, e si gioca comunque quella fissata — perché è
// quella per cui i testi sono scritti.
function confrontaMissione(areaVincente) {
  const suggerita = areaVincente ? missionePerArea(areaVincente) : null;
  return {
    areaVincente: areaVincente ?? null,
    fissata: MISSIONE_FISSATA,
    suggerita: suggerita?.slug ?? null,
    coincidono: suggerita?.slug === MISSIONE_FISSATA,
  };
}

async function giocaMissione({ sessione, missionSlug = MISSIONE_FISSATA, registra }) {
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

    const payload = rispostaPerStep(prossimo);
    if (!payload) {
      // NON SI INVENTA UNA RISPOSTA. Se la missione guadagna un passo di un
      // tipo che il robot non sa trattare, si ferma dicendolo: una risposta
      // plausibile inventata qui produrrebbe una misura che sembra buona.
      return {
        ...esito,
        fermato: { dove: prossimo.id, perche: `nessuna risposta scritta per un passo di tipo «${prossimo.tipo}», e la regola generica non copre quel tipo` },
      };
    }

    const { error } = await supabase
      .from("step_response")
      .upsert({ attempt_id: attempt.id, stanza: prossimo.stanza, step_id: prossimo.id, tipo: prossimo.tipo, payload }, { onConflict: "attempt_id,step_id" });
    if (error) {
      return { ...esito, fermato: { dove: prossimo.id, perche: `la risposta è stata rifiutata: ${error.message}` } };
    }
    risposte.set(prossimo.id, payload);
    esito.passi.push({ id: prossimo.id, tipo: prossimo.tipo, stanza: prossimo.stanza });
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

module.exports = { collega, giocaMissione, confrontaMissione };
