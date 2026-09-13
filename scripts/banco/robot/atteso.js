// Il verdetto di una trappola: è stata colta o no.
//
// PERCHÉ ESISTE, E VA DETTO. `FORMATO.md` prometteva dal primo giorno che «il
// robot dice se è stato colto», e il campo `atteso` veniva **validato nella
// forma** (`verifica-consegne-robot.js` controlla che `atteso.tappa` esista)
// **ma non controllato contro il giro**. Una trappola sarebbe girata
// producendo solo del testo da leggere: esattamente la cosa per cui non
// serviva costruirla. È la quinta volta in quattro giorni che una proprietà
// dichiarata non corrisponde al codice, e questa era in un documento mio.
//
// CONFRONTO LETTERALE, MAI UN MODELLO CHE GIUDICA UN MODELLO. Le tre
// condizioni si leggono sul testo della revisione di quella tappa:
//   · `deve_comparire`                       → in tutta la revisione;
//   · `non_deve_comparire_nei_punti_forza`   → SOLO nei punti di forza (dire
//     «l'ordine giusto non basta» fra i «da migliorare» è giusto: è elogiarlo
//     che è il difetto);
//   · `fiducia_massima`                      → il punteggio DI QUELLA TAPPA
//     (`punteggio_fiducia`, su 25), non la fiducia totale del progetto.


const normalizza = (t) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const testoDi = (v) => (Array.isArray(v) ? v.join(" — ") : typeof v === "string" ? v : JSON.stringify(v ?? ""));

// Tutte le stringhe di un oggetto, a qualunque profondità. Esiste già in
// `lib/lingua/scansione.ts` e NON si riusa qui di proposito: quel file è
// TypeScript, e importarlo obbligherebbe ogni chiamante di atteso.js a
// installare prima lo shim del loader. Quattro righe di traversata non hanno
// una regola dentro da far divergere; una condizione di verdetto sì, e infatti
// quella sta in un posto solo.
function tutteLeStringhe(v, dentro = []) {
  if (typeof v === "string") dentro.push(v);
  else if (Array.isArray(v)) for (const x of v) tutteLeStringhe(x, dentro);
  else if (v && typeof v === "object") for (const x of Object.values(v)) tutteLeStringhe(x, dentro);
  return dentro;
}

// esito = il resoconto di giocaRuolo. Restituisce sempre un oggetto, anche
// quando non c'è niente da controllare: «non lo so» non è «è andata bene».
//
// DUE OGGETTI POSSIBILI, decisi da `atteso.dove`. La prima trappola guardava la
// revisione di UNA TAPPA (il defibrillatore); la seconda guarda il FEEDBACK
// FINALE, che non è una tappa e non ha né punteggio né rubrica. `dove` assente
// vuol dire «tappa», così le trappole scritte prima continuano a valere.
function verificaAtteso(atteso, esito) {
  if (!atteso) return null;
  const verdetto = atteso.dove === "feedback_finale" ? verificaFinale(atteso, esito) : verificaTappa(atteso, esito);
  // L'attesa rossa in un punto solo: chi stampa non deve ricordarsene.
  return { ...verdetto, rossoAtteso: atteso.rosso_atteso ?? null, stato: statoTrappola(verdetto.colta, atteso.rosso_atteso) };
}

// I quattro stati, e quello che conta è il quarto.
//
// Una trappola può essere ROSSA DI PROPOSITO: chiede una proprietà che il
// prodotto non ha ancora, e sta nella suite per rendere visibile quella
// mancanza PRIMA che si costruisca la cosa che dovrebbe averla. Un test che
// nasce verde su un comportamento mai scritto non prova niente.
//
// Quindi non è un allarme finché resta rossa — ma il giorno che diventa verde
// è la notizia, e va detta: o la proprietà è arrivata, o il controllo (che è
// lessicale, quindi parziale) ha smesso di guardare dove guardava. Le due cose
// si distinguono solo leggendo, e il rapporto lo dice invece di esultare.
function statoTrappola(colta, rossoAtteso) {
  if (colta === null || colta === undefined) return "nessun_verdetto";
  if (!rossoAtteso) return colta ? "colta" : "non_colta";
  return colta ? "diventata_verde" : "rossa_come_previsto";
}

// ── il feedback finale ────────────────────────────────────────────────────
// Si guarda in TUTTE le stringhe del finale, non nei campi nominati uno per
// uno: `punti_forza` è già rinominato `cosa_regge` nella revisione di tappa, e
// un controllo ancorato ai nomi dei campi smetterebbe di guardare senza dirlo —
// che è esattamente il difetto costato mezza passata il 31 agosto.
function verificaFinale(atteso, esito) {
  const finale = esito.feedbackFinale;
  if (!finale) {
    return {
      dove: "feedback finale",
      colta: null,
      motivo: "il feedback finale non è stato generato: il robot non è arrivato in fondo, o il revisore si è arreso",
      controlli: [],
    };
  }

  const tutto = normalizza(tutteLeStringhe(finale).join(" — "));
  const controlli = [];

  for (const termine of atteso.deve_comparire ?? []) {
    controlli.push({
      ok: tutto.includes(normalizza(termine)),
      descrizione: `nomina «${termine}»`,
      spiegazione: `il feedback finale non nomina mai «${termine}»`,
    });
  }

  for (const frase of atteso.non_deve_affermare_uno_schema ?? []) {
    controlli.push({
      ok: !tutto.includes(normalizza(frase)),
      descrizione: `non afferma uno schema con «${frase}»`,
      spiegazione: `«${frase}» compare nel feedback finale: afferma uno schema che nelle domande non c'è`,
    });
  }

  // DUE FAMIGLIE, NON UNA LISTA PIÙ LUNGA. Il 13/09 la trappola delle domande
  // sparse è passata su tutte e tredici le forme dell'elenco sopra — e il
  // modello aveva comunque inventato un'intenzione, su UNA domanda sola:
  // «non è una domanda random». Le forme aggregate («un modo tuo», «hai
  // sempre», «tutte e tredici») per costruzione non possono vederlo: cercano
  // una generalizzazione su tutte le domande, e lì la generalizzazione era su
  // una. Tenerle nello stesso campo avrebbe fatto stampare «non afferma uno
  // schema con "non è una domanda random"», che è la frase sbagliata: quello
  // non è uno schema, è un'intenzione. E la prossima volta nessuno saprebbe
  // dire quale delle due famiglie ha morso.
  for (const frase of atteso.non_deve_attribuire_intenzioni ?? []) {
    controlli.push({
      ok: !tutto.includes(normalizza(frase)),
      descrizione: `non attribuisce un'intenzione con «${frase}»`,
      spiegazione: `«${frase}» compare nel feedback finale: attribuisce un'intenzione a una scelta che intenzione non ne aveva`,
    });
  }

  return {
    dove: "feedback finale",
    colta: controlli.length > 0 ? controlli.every((c) => c.ok) : null,
    motivo: controlli.length === 0 ? "l'atteso non contiene nessuna condizione da controllare" : null,
    controlli,
  };
}

// ── la revisione di una tappa ─────────────────────────────────────────────
function verificaTappa(atteso, esito) {
  const tappa = (esito.tappe ?? []).find((t) => t.faseId === atteso.tappa);
  if (!tappa || !tappa.revisione) {
    return {
      tappa: atteso.tappa,
      dove: `tappa «${atteso.tappa}»`,
      colta: null,
      motivo: tappa
        ? `la tappa «${atteso.tappa}» non è stata revisionata (${tappa.esitoRevisione ?? "nessun esito"}): non c'è niente su cui dare un verdetto`
        : `la tappa «${atteso.tappa}» non è stata giocata: il robot si è fermato prima`,
      controlli: [],
    };
  }

  const rev = tappa.revisione;
  // `cosa_regge` è il nome nuovo di `punti_forza` nella revisione di tappa
  // (dal 2026-08-31, vedi elaboratoValore.ts): si guardano tutti e due, o una
  // trappola scritta prima smetterebbe di controllare quello che controllava.
  const lode = rev.cosa_regge ?? rev.punti_forza;
  const tutta = normalizza([testoDi(lode), testoDi(rev.da_migliorare), testoDi(rev.domanda), testoDi(rev.commento_breve)].join(" — "));
  const forza = normalizza(testoDi(lode));

  const controlli = [];

  for (const termine of atteso.deve_comparire ?? []) {
    controlli.push({
      ok: tutta.includes(normalizza(termine)),
      descrizione: `nomina «${termine}»`,
      spiegazione: `la revisione non nomina mai «${termine}»`,
    });
  }

  for (const termine of atteso.non_deve_comparire_nei_punti_forza ?? []) {
    controlli.push({
      ok: !forza.includes(normalizza(termine)),
      descrizione: `non elogia «${termine}»`,
      spiegazione: `«${termine}» compare fra i PUNTI DI FORZA`,
    });
  }

  if (typeof atteso.fiducia_massima === "number") {
    const punteggio = Number(rev.punteggio_fiducia);
    controlli.push({
      ok: Number.isFinite(punteggio) && punteggio <= atteso.fiducia_massima,
      descrizione: `punteggio della tappa ≤ ${atteso.fiducia_massima}`,
      spiegazione: `la tappa ha preso ${Number.isFinite(punteggio) ? punteggio : "?"}, sopra il tetto di ${atteso.fiducia_massima}`,
    });
  }

  return {
    tappa: atteso.tappa,
    dove: `tappa «${atteso.tappa}»`,
    colta: controlli.length > 0 ? controlli.every((c) => c.ok) : null,
    motivo: controlli.length === 0 ? "l'atteso non contiene nessuna condizione da controllare" : null,
    punteggio: Number(rev.punteggio_fiducia),
    controlli,
  };
}

module.exports = { verificaAtteso, statoTrappola };
