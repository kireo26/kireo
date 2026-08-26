// La lingua invariante di KIREO, in un posto solo.
//
// KIREO non conosce il genere di chi legge: non è in `profiles`, non è mai
// stato chiesto, e non lo chiederemo. Ogni frase rivolta a uno studente deve
// poter essere letta da una ragazza e da un ragazzo senza cambiare una lettera.
// Non è un ripiego in attesa del dato: è la lingua del prodotto.
//
// Questo file tiene le TRE cose che ne discendono, perché divergerebbero se
// stessero in tre posti:
//   1. i PATTERN che riconoscono una forma accordata (usati dal tripwire sul
//      testo cablato e dalla guardia sul testo generato dall'AI);
//   2. la REGOLA scritta nei prompt dei revisori;
//   3. la funzione di scansione condivisa.
//
// DUE STRUMENTI, NON DUE TENTATIVI DELLA STESSA COSA. La regola nel prompt
// abbassa la FREQUENZA con cui il modello produce una forma accordata; la
// guardia riduce l'ESPOSIZIONE dello studente a quelle che escono comunque.
// Nessuna delle due chiude il caso da sola, e non sono alternative: la regola
// non garantisce (misurato — vedi `npm run misura:genere`), e la guardia non
// può riscrivere l'italiano, può solo richiedere una risposta. Chi un giorno
// vorrà togliere una delle due perché «basta l'altra» tolga prima questo
// commento, e si accorga che non basta.

import { trovaConPattern, trovaConPatternInJson } from "@/lib/lingua/scansione";

// ── 1. i pattern ───────────────────────────────────────────────────────────
// Solo i due affidabili:
//   a) il participio con ESSERE o riflessivo — è lì che il modello ricasca, e
//      quasi sempre in una secondaria («quando sei riuscito a…») o in un
//      riflessivo, non nell'indirizzo frontale;
//   b) «da solo/a».
// Il participio con AVERE non concorda MAI: «hai preso» va bene per chiunque —
// ed è per questo che la riscrittura passa quasi sempre da lì.
//
// Coperti maschile e femminile al SINGOLARE. Il plurale resta fuori di
// proposito: il lettore è sempre uno, e includerlo catturerebbe parole comuni
// («sei mesi» finisce in -esi — misurato).
//
// I pattern sono LARGHI di proposito, e vanno tenuti larghi. «da sol[oa]»
// prende anche l'accordo con un nome femminile della frase («la palestra da
// sola non basta»), che è italiano corretto: su cinque catture reali due erano
// di quel tipo. Il costo di quel falso positivo dipende da chi legge il
// pattern — per il tripwire è una voce di whitelist con la sua ragione, per la
// guardia è una chiamata in più e nient'altro (il testo che torna è buono
// uguale). In nessuno dei due casi vale la pena stringerli.
export const PATTERN_ACCORDO: RegExp[] = [
  /\b(?:ti\s+)?(?:sei|eri|fossi|sarai|saresti)\s+(?:gi[àa]\s+|subito\s+|poi\s+|anche\s+|mai\s+)?[a-zàèéìòù]+(?:ato|ito|uto|sso|sto|tto|rso|eso)\b/g,
  /\b(?:ti\s+)?(?:sei|eri|fossi|sarai|saresti)\s+(?:gi[àa]\s+|subito\s+|poi\s+|anche\s+|mai\s+)?[a-zàèéìòù]+(?:ata|ita|uta|ssa|sta|tta|rsa|esa)\b/g,
  /\bda sol[oa]\b/g,
];

// ── 2. la regola nei prompt ────────────────────────────────────────────────
// Forma POSITIVA: dice cosa fare e mostra solo la forma giusta. Non cita mai la
// forma da evitare — un modello a cui si mostra un esempio sbagliato tende a
// copiarlo (già successo con il segnaposto «(sezione X)» nel revisore del
// workshop, dove il divieto conteneva il segnaposto stesso).
//
// Nomina la CATEGORIA del verbo, non un esempio di verbo sbagliato: è
// esattamente lì che la prima stesura taceva. Quella diceva come rivolgersi
// allo studente frontalmente — dove il modello era già a posto — e non diceva
// niente su cosa fare quando il verbo che serve prende «essere» per natura.
// Le forme uscite nella misura stavano tutte lì, e tutte in secondarie o
// riflessivi: da qui l'aggiunta esplicita «anche nelle frasi secondarie e
// nelle domande».
export const REGOLA_LINGUA_INVARIANTE = `

LINGUA (vale per ogni frase che rivolgi allo studente): non sai se chi legge è una ragazza o un ragazzo, e non lo saprai mai. Racconta quello che ha fatto con verbi che al passato prossimo si coniugano con «avere» — «hai cercato», «hai parlato», «hai chiesto», «hai pensato», «hai messo», «hai lasciato fuori» — perché restano identici per chiunque. Se il verbo che ti viene si coniuga con «essere», oppure è riflessivo, sostituiscilo con uno che si coniuga con «avere»: vale anche dentro le frasi secondarie e le domande. Per il resto usa locuzioni che non cambiano desinenza («per conto tuo», «alle strette», «a tuo agio», «con calma»). Ogni frase deve poter essere letta da una ragazza e da un ragazzo senza cambiare una lettera.`;

// ── 3. la scansione ────────────────────────────────────────────────────────
// Tutte le occorrenze, non solo la prima: si contano i casi, non i testi. La
// meccanica (normalizzazione del flag `g`, ricorsione sul JSON) sta in
// lib/lingua/scansione.ts, condivisa con la guardia sul registro: due
// ricorsioni identiche in due file divergono, ed è la stessa ragione per cui
// questi pattern stanno in un posto solo.
export function trovaAccordi(testo: string): string[] {
  return trovaConPattern(testo, PATTERN_ACCORDO);
}

export function trovaAccordiInJson(valore: unknown): string[] {
  return trovaConPatternInJson(valore, PATTERN_ACCORDO);
}
