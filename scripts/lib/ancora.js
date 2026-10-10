// ⚠️ UN'ÀNCORA SU UN NOME DICHIARA QUANTE VOLTE QUEL NOME COMPARE.
//
// Un controllo che si àncora a una stringa per ritagliare un pezzo di sorgente
// misura l'occorrenza che trova per prima — e se quel nome compare due volte,
// misura quella sbagliata. Non produce un rosso: produce un VERDE su un pezzo
// di codice che non è quello che si voleva guardare.
//
// LE VOLTE CHE CI È COSTATO (tutte trovate da una controprova, nessuna
// rileggendo l'asserzione):
//
//   • 27/09 — `passoCorrente: ChiavePasso | null` sta sia nella prop del
//     componente sia nella firma di un helper interno: l'asserzione trovava la
//     seconda mentre la prima era già cambiata.
//   • 27/09 — la condizione che accende il segno nella barra compare DUE volte
//     (desktop e mobile): cercarla una volta diceva «esiste», non «viene
//     usata». Spegnendo il render del desktop il controllo restava verde.
//   • 27/09 — `indexOf("md:hidden")` prendeva l'header del telefono invece
//     della barra mobile: rosso su codice giusto, l'altro verso dello stesso
//     difetto.
//   • 04/10 — `v_aree_studente` compare anche nella DICHIARAZIONE della
//     variabile in testa alla funzione, quindi la guardia «l'indagine si fa
//     prima dell'insert» misurava quella posizione e restava verde anche
//     spostando il blocco dopo.
//   • 05/10 — `ancora('const GRUPPO_RESTO')`: lo stesso nome compare nella
//     definizione e nell'uso, e un conto implicito di 1 era sbagliato.
//
// LA FORMA: si dichiara il conto atteso, e se cambia il controllo FALLISCE
// nominando il nome e il numero. Così l'aggiunta di una seconda occorrenza —
// che è il momento in cui l'àncora diventa ambigua — si vede subito, invece di
// spostare in silenzio quello che il controllo guarda.
//
// ⚠️ I LIMITI, scritti perché si possa usarla dove vale: non è un parser, e
// conta occorrenze LETTERALI (una stringa che compare dentro un commento la
// conta — per questo si passa un sorgente già spogliato con
// `senzaCommenti`/`senzaCommentiSql`). E non sa niente di cosa sia «la
// definizione» rispetto a «l'uso»: sa solo dire quante volte un testo c'è.
//
// COSA NON COPRE, e resta un lavoro: nel repo ci sono ancora àncore scritte con
// `indexOf` grezzo. `censimentoAncore()` le conta, così il numero è visibile e
// scende invece di restare invisibile — la regola di casa è che un controllo che
// seleziona un insieme deve dire quanti elementi ha selezionato.

/* eslint-disable @typescript-eslint/no-require-imports -- helper Node CommonJS */

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./senza-commenti");

// L'indice di `nome` in `src`, dichiarando quante volte ci si aspetta che
// compaia. `quale` sceglie l'occorrenza (0 = la prima) quando sono più di una e
// si vuole proprio quella.
function ancora(src, nome, { volte = 1, quale = 0, dove = "" } = {}) {
  const trovate = [];
  let i = src.indexOf(nome);
  while (i !== -1) {
    trovate.push(i);
    i = src.indexOf(nome, i + 1);
  }
  const contesto = dove ? ` (${dove})` : "";
  if (trovate.length !== volte) {
    throw new Error(
      `àncora ambigua${contesto}: «${nome}» compare ${trovate.length} volte, ne erano dichiarate ${volte}.\n` +
        `      → se l'occorrenza in più è legittima, aggiorna \`volte\` e verifica che \`quale\` punti a quella giusta;\n` +
        `        se non lo è, il controllo stava misurando il pezzo sbagliato.`,
    );
  }
  if (quale >= trovate.length) {
    throw new Error(`àncora${contesto}: «${nome}» ha ${trovate.length} occorrenze, chiesta la ${quale + 1}ª`);
  }
  return trovate[quale];
}

// La fetta fra due àncore, ognuna col suo conto dichiarato. `a` omesso = fino
// alla fine.
function fetta(src, da, a = null) {
  const inizio = ancora(src, da.nome, da);
  if (a === null) return src.slice(inizio);
  const fine = ancora(src, a.nome, a);
  if (fine < inizio) {
    throw new Error(`fetta vuota: «${a.nome}» viene prima di «${da.nome}» — le due àncore sono invertite`);
  }
  return src.slice(inizio, fine);
}

// Quante àncore grezze restano nei controlli: il numero da far scendere.
function censimentoAncore(dirScripts) {
  const dir = dirScripts ?? path.join(__dirname, "..");
  let grezze = 0;
  const perFile = new Map();
  for (const n of fs.readdirSync(dir).filter((f) => /^verifica-.*\.js$/.test(f))) {
    // ⚠️ SPOGLIATO DAI COMMENTI. Il 10/10/2026 il conto è salito di uno per
    // un `lastIndexOf("try {", …)` citato DENTRO un commento che spiegava
    // perché quella forma non va usata — cioè il censimento gridava su un
    // file che aveva fatto la cosa giusta e l'aveva scritta. È il modo 1, e
    // la cura è al lettore: una guardia negativa legge il sorgente spogliato.
    const src = senzaCommenti(fs.readFileSync(path.join(dir, n), "utf8"));
    // Solo le àncore su un LETTERALE: `indexOf(variabile)` non si può contare
    // staticamente, e `indexOf` su un array (una lista di stringhe) non è
    // un'àncora su un sorgente.
    const q = (src.match(/\b(?:lastI|i)ndexOf\(\s*["'`]/g) ?? []).length;
    if (q > 0) perFile.set(n, q);
    grezze += q;
  }
  return { grezze, perFile };
}

module.exports = { ancora, fetta, censimentoAncore };
