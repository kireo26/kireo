// Il REGISTRO con cui un revisore parla a uno studente, in un posto solo.
//
// È il gemello di `accordoGenere.ts`, e nasce dalla stessa constatazione: il
// testo cablato del finale è sorvegliato dal tripwire (`npm run test:finale`),
// il testo generato da un revisore AI no. Su tre cose diverse, e su tre soli
// difetti osservati in produzione:
//
//   1. il LESSICO da verdetto — «performance non perfetta», «priorità
//      discutibili». La linea di KIREO è che il finale riporta e non afferma;
//   2. la TERZA PERSONA — «lo studente lo nomina, il che è onesto», in mezzo a
//      un testo che dà del tu;
//   3. le CIFRE — un numero attribuito a una scelta che lo studente non ha
//      fatto. Questa NON sta qui: vive in `lib/escape/cifreCitabili.ts`, perché
//      per deciderla serve la verità (il payload e i materiali aperti), non la
//      stringa. Vedi il commento su `chiamaJson`.
//
// DUE STRUMENTI, NON DUE TENTATIVI DELLA STESSA COSA — vale qui parola per
// parola come per il genere: la regola nel prompt abbassa la FREQUENZA, la
// guardia nel codice riduce l'ESPOSIZIONE a ciò che esce comunque.
//
// E UN TERMINALE DIVERSO, che è la sola cosa da non cambiare in buona fede:
// lessico e terza persona, se sopravvivono al secondo tentativo, SI SPEDISCONO
// LO STESSO (come il genere). Una cifra fuori dall'insieme citabile no: quella
// è un'affermazione falsa su una scelta dello studente, e al suo posto va il
// ripiego cablato. Un participio sbagliato è un tono; una cifra inventata è una
// bugia precisa.

import { trovaConPattern, trovaConPatternInJson } from "@/lib/lingua/scansione";

// ── 1. il lessico da verdetto ──────────────────────────────────────────────
// Tre famiglie. La lista è EDITORIALE: si fa crescere con revisione. Le voci con
// `*` matchano il prefisso (lucid*, ottim*, vantart*). «sei accorto» NON è nel
// lessico di proposito: raccontare QUANDO un fatto è affiorato è legittimo e
// succederà ancora — la linea vieta di affermare cosa lo studente ha capito o
// quanto è stato bravo, non di dire quando un fatto gli è arrivato davanti.
//
// Viveva dentro scripts/verifica-finale-riporta.js, dove sorvegliava le sole
// stringhe cablate. Da qui la leggono in due: quel tripwire (invariato nel
// comportamento) e la guardia sulle risposte dei revisori. Una lista sola, come
// per i pattern dell'accordo.
export const LESSICO_VERDETTO: Record<string, RegExp[]> = {
  "stato-d'animo": [
    /\bhai capito\b/, /\bhai compreso\b/, /\bhai intuito\b/, /\bhai realizzato\b/,
    /\bhai scoperto\b/, /\bsapevi\b/, /\bavevi capito\b/,
    /\bhai imparato\b/, /\bhai riconosciuto\b/,
  ],
  "verdetto-di-qualità": [
    /\blucid\w*/, /\bcon criterio\b/, /\bsottile\b/, /\belegante\b/, /\bmaturo\b/,
    /\bsaggio\b/, /\bcoraggioso\b/, /\bbrillante\b/, /\bnotevole\b/, /\bottim\w*/,
    /\bben fatto\b/, /\befficace\b/,
  ],
  "dichiara-significato": [
    /è la risposta più/, /è uno stile, non/, /questo cambia tutto/,
    /vuol dire che sei/, /sopra le impressioni/, /senza vantart\w*/,
  ],
};

// La quarta famiglia, e perché sta FUORI da quella sopra invece che dentro.
//
// Nasce dalle due catture della 04 — «performance non perfetta», «priorità
// discutibili». Sono parole che il testo cablato non contiene per scelta e che
// un modello invece scrive, perché «performance» gliela diamo noi nel prompt e
// ce la restituisce in prosa.
//
// Applicarla anche al testo cablato è stato provato ed è SBAGLIATO, non
// scomodo: sul lato cablato «performance» compare undici volte come nome di
// dimensione (`dimensione: "performance"`) e dentro i prompt stessi — è una
// parola del motore, non una parola detta a qualcuno. Il tripwire, che legge
// ogni stringa del file, le catturava tutte e undici.
//
// Non sono quindi due liste destinate a divergere: è una lista sola più un
// insieme che si applica solo dove quelle parole possono davvero finire davanti
// a uno studente. Il confine è il mezzo, non il gusto.
export const LESSICO_SOLO_AI: Record<string, RegExp[]> = {
  "vocabolario-del-motore": [
    /\bperformance\b/, /\bpunteggi\w*/, /\bdiscutibil\w*/,
    /\bnon perfett\w*/, /\binsufficient\w*/, /\bcarent\w*/,
  ],
};

// ── 2. la terza persona ────────────────────────────────────────────────────
// Solo gli ancoraggi affidabili: il NOME con cui il revisore chiama chi legge
// quando smette di parlargli. Un verbo alla terza persona senza il nome
// («lo nomina, il che è onesto») non è riconoscibile da un pattern, e non si
// prova a indovinarlo.
//
// «ragazzo/ragazza» resta fuori di proposito: nella Missione 09 ci sono
// duecento ragazzi del centro estivo, e un revisore che li nomina sta parlando
// del contenuto, non di chi legge. Un falso positivo qui costa una chiamata,
// ma una cattura sistematica su una missione intera costerebbe la fiducia nel
// pattern.
export const PATTERN_TERZA_PERSONA: RegExp[] = [
  /\bstudent[ei]\b/, /\bstudentess[ae]\b/, /\bl['’]alunn[oa]\b/,
];

// ── 3. la regola nei prompt ────────────────────────────────────────────────
// Forma POSITIVA, come quella sulla lingua invariante: dice cosa fare e non
// mostra mai la forma da evitare — un modello a cui si mostra un esempio
// sbagliato tende a copiarlo (già successo col segnaposto «(sezione X)»).
// Per questo non elenca le parole-verdetto: le nomina per quello che sono
// (giudizi su chi legge) e dice cosa mettere al loro posto.
//
// La riga sui numeri sta qui e non nei singoli prompt per la stessa ragione per
// cui ci sta quella sulla lingua: undici copie a mano divergono, e la nona che
// qualcuno dimentica è esattamente quella dove il difetto si presenta — è già
// successo con «rivolta allo studente», presente in 2 prompt su 11 e assente
// proprio in quello della missione in cui la terza persona è uscita.
export const REGOLA_REGISTRO = `

REGISTRO (vale per ogni frase che rivolgi allo studente): scrivi A chi ha fatto il lavoro, non DI chi l'ha fatto — seconda persona, «tu», dall'inizio alla fine di ogni frase, anche quando descrivi. Attieniti a ciò che è verificabile nel testo che hai davanti: le scelte compiute, i fatti citati, le conseguenze che ne seguono. Il giudizio su quanto è stato bravo, su cosa ha capito e su quanto vale quello che ha fatto lascialo a chi legge: tu riporti quello che hai letto. Le parole del sistema che valuta (i nomi delle dimensioni, i punteggi) restano fuori dal testo: descrivi la scelta, non la misura.

NUMERI: cita solo cifre che compaiono nel testo che stai leggendo o nei documenti che lo studente ha davvero aperto. Se una cifra ti servirebbe e non ce l'hai, di' la cosa a parole: una frase senza numeri è vera, una con un numero ricostruito a memoria non lo è.`;

// ── 4. la scansione ────────────────────────────────────────────────────────
const PATTERN_VERDETTO: RegExp[] = [
  ...Object.values(LESSICO_VERDETTO).flat(),
  ...Object.values(LESSICO_SOLO_AI).flat(),
];

export function trovaRegistro(testo: string): string[] {
  return [...trovaConPattern(testo, PATTERN_VERDETTO), ...trovaConPattern(testo, PATTERN_TERZA_PERSONA)];
}

export function trovaRegistroInJson(valore: unknown): string[] {
  return [
    ...trovaConPatternInJson(valore, PATTERN_VERDETTO),
    ...trovaConPatternInJson(valore, PATTERN_TERZA_PERSONA),
  ];
}
