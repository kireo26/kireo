// Le forme italiane che CONCORDANO col genere di chi legge.
//
// KIREO non ha il genere dello studente: non è in `profiles`, non è mai stato
// chiesto, e non lo chiederemo. La forma invariante non è un ripiego in attesa
// del dato: è la lingua di KIREO. Metà degli studenti sono ragazze, e una frase
// al maschile le esclude senza che nessuno se ne accorga.
//
// Due pattern soli, quelli affidabili:
//   1) il participio con ESSERE o riflessivo — «sei andato», «ti sei preso» —
//      al singolare, maschile e femminile. Il plurale (-ati/-ate) resta fuori di
//      proposito: il lettore è sempre uno, e includerlo catturerebbe parole
//      comuni («sei mesi» → «mesi» finisce in -esi).
//   2) «da solo/a».
// Il participio con AVERE non concorda MAI: «hai preso» va bene per chiunque —
// ed è per questo che la riscrittura passa quasi sempre da lì.
//
// Gli aggettivi generici («sicuro», «preciso») restano fuori: nove falsi
// positivi su dieci, e un test che dà fastidio senza motivo è un test che
// qualcuno disattiva.
//
// Un solo file perché la definizione sta in un posto solo: il tripwire del
// finale la usa per il codice cablato, la misura dei revisori per il testo che
// l'AI genera. Due copie diverge­rebbero, come sempre.

const PATTERN_ACCORDO = [
  /\b(?:ti\s+)?(?:sei|eri|fossi|sarai|saresti)\s+(?:gi[àa]\s+|subito\s+|poi\s+|anche\s+|mai\s+)?[a-zàèéìòù]+(?:ato|ito|uto|sso|sto|tto|rso|eso)\b/g,
  /\b(?:ti\s+)?(?:sei|eri|fossi|sarai|saresti)\s+(?:gi[àa]\s+|subito\s+|poi\s+|anche\s+|mai\s+)?[a-zàèéìòù]+(?:ata|ita|uta|ssa|sta|tta|rsa|esa)\b/g,
  /\bda sol[oa]\b/g,
];

// Tutte le occorrenze (non solo la prima): la misura conta i casi, non i testi.
function trovaAccordi(testo) {
  const t = String(testo || "").toLowerCase();
  const out = [];
  for (const re of PATTERN_ACCORDO) {
    re.lastIndex = 0;
    for (const m of t.matchAll(re)) out.push(m[0]);
  }
  return out;
}

module.exports = { PATTERN_ACCORDO, trovaAccordi };
