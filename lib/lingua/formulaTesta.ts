// «Hai capito che X» → «X»: la formula sulla testa, tolta dal codice.
//
// PERCHÉ NON È UN'ALTRA REGOLA NEL PROMPT. Ci abbiamo provato tre volte: la
// regola astratta («il giudizio su cosa ha capito lascialo a chi legge»),
// l'esempio riscritto accanto («hai capito che il margine non è uno spreco» →
// «la tabella tratta il margine come un cuscinetto»), e il nome del campo con
// la sostituzione dentro la descrizione. I tre numeri, sullo stesso fixture:
// 60%, 60%, 61%. Nella terza passata «hai capito» e «hai riconosciuto» sono
// perfino AUMENTATE — da 54 a 66 occorrenze — nel prompt trattato.
//
// È la stessa forma di un problema già risolto qui, e la lezione è scritta in
// CLAUDE.md: **ciò che possiamo imporre nel codice non si chiede a un
// modello.** La chiusura della chat col cliente era una regola del prompt, non
// funzionava, ed è diventata deterministica: da allora non ha fallito una
// volta.
//
// COSA FA, ED È POCO DI PROPOSITO. Riscrive UNA costruzione, quella in cui la
// trasformazione è esatta e non serve capire la frase:
//
//     «hai capito che il margine non è uno spreco»
//   → «il margine non è uno spreco»
//
// La subordinata che segue «che» È GIÀ un'affermazione sulla pagina: togliere
// il verbo mentale davanti non aggiunge e non toglie niente, sposta soltanto
// il soggetto dalla testa di chi legge alla cosa scritta. Non è una parafrasi,
// è una cancellazione — e il risultato è deducibile carattere per carattere
// dal testo di partenza.
//
// COSA NON FA, per la stessa ragione: tutto il resto. «hai capito quanto conta
// il margine» diventerebbe un frammento; «questo è maturo» e «il contratto è
// saggio» sono giudizi veri, e toglierli meccanicamente vorrebbe dire
// riscrivere un contenuto invece che una formula. Restano visibili nella
// misura — la guardia continua a contarli — e restano un problema aperto, di
// un'altra specie: sono una dozzina su novantaquattro, non sessantasei.
//
// PRIMA VOLTA CHE RISCRIVIAMO UN TESTO DESTINATO A UNO STUDENTE, e chi apre
// questo file deve saperlo: fin qui il codice poteva RIFIUTARE una risposta
// (la guardia, il validatore), mai modificarla. Se un giorno si vorrà tornare
// indietro, il posto è uno solo.

// I verbi mentali con cui il revisore attribuisce una comprensione. Sono gli
// stessi elencati in `registroStudente.ts`, dove servono a CONTARLI: qui
// servono a toglierli. Due elenchi invece di uno perché i due usi vogliono
// forme diverse — là un pattern di ricerca, qui un pezzo dentro una
// costruzione — e unirli renderebbe illeggibili entrambi.
const VERBI = ["capito", "compreso", "intuito", "realizzato", "imparato", "riconosciuto", "colto"];

// «hai capito che X» — con un eventuale avverbio in mezzo («hai subito capito
// che»), e SOLO davanti a «che»: è la forma in cui quello che segue regge da
// solo. Il primo carattere della subordinata viene catturato, così la
// maiuscola si decide senza bisogno di un secondo passaggio (una prima stesura
// usava un segnaposto, e piazzava un byte NUL dentro un file sorgente).
const FORMULA = new RegExp(`\\b(?:hai|avete)\\s+(?:\\w+\\s+)?(?:${VERBI.join("|")})\\s+che\\s+(.)`, "gi");

// Le stesse parole SENZA «che»: non si riscrivono, ma si contano. È il
// residuo, ed è il numero che dice se questa cura copre il problema o solo la
// sua metà comoda.
const FORMULA_SENZA_CHE = new RegExp(`\\b(?:hai|avete)\\s+(?:\\w+\\s+)?(?:${VERBI.join("|")})\\b(?!\\s+che\\b)`, "gi");

export type EsitoRiscrittura = { testo: string; riscritte: number; residue: number };

// Pura: stessa stringa, stesso risultato, sempre.
export function togliFormulaTesta(testo: string): EsitoRiscrittura {
  const originale = String(testo ?? "");
  let riscritte = 0;

  const finale = originale.replace(FORMULA, (_occorrenza, primaLettera: string, offset: number) => {
    riscritte++;
    // Se la formula apriva la frase, quello che resta prende la maiuscola: il
    // pezzo dopo «che» comincia sempre in minuscolo.
    const prima = originale.slice(0, offset).trimEnd();
    const apreFrase = prima === "" || /[.!?:;–—-]$/.test(prima);
    return apreFrase ? primaLettera.toUpperCase() : primaLettera;
  });

  const residue = (finale.match(FORMULA_SENZA_CHE) ?? []).length;
  return { testo: finale, riscritte, residue };
}
