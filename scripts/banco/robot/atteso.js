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

// esito = il resoconto di giocaRuolo. Restituisce sempre un oggetto, anche
// quando non c'è niente da controllare: «non lo so» non è «è andata bene».
function verificaAtteso(atteso, esito) {
  if (!atteso) return null;

  const tappa = (esito.tappe ?? []).find((t) => t.faseId === atteso.tappa);
  if (!tappa || !tappa.revisione) {
    return {
      tappa: atteso.tappa,
      colta: null,
      motivo: tappa
        ? `la tappa «${atteso.tappa}» non è stata revisionata (${tappa.esitoRevisione ?? "nessun esito"}): non c'è niente su cui dare un verdetto`
        : `la tappa «${atteso.tappa}» non è stata giocata: il robot si è fermato prima`,
      controlli: [],
    };
  }

  const rev = tappa.revisione;
  const tutta = normalizza(
    [testoDi(rev.punti_forza), testoDi(rev.da_migliorare), testoDi(rev.domanda), testoDi(rev.commento_breve)].join(" — "),
  );
  const forza = normalizza(testoDi(rev.punti_forza));

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
    colta: controlli.length > 0 ? controlli.every((c) => c.ok) : null,
    motivo: controlli.length === 0 ? "l'atteso non contiene nessuna condizione da controllare" : null,
    punteggio: Number(rev.punteggio_fiducia),
    controlli,
  };
}

module.exports = { verificaAtteso };
