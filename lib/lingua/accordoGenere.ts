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
// I suffissi `orto|erto|olto` sono arrivati dopo, e per un caso reale: «te ne
// sei accorto» stava in `restituzione.ts` da sempre e il pattern non la vedeva,
// perché la prima stesura elencava i participi regolari e i più comuni fra gli
// irregolari, non tutti. Con quei tre entrano anche «aperto», «offerto»,
// «coperto», «svolto», «risolto», «accolto». Se ne mancherà un altro si aggiunge
// qui: il posto è uno solo, e chi lo trova lo trova perché il tripwire diventa
// rosso, non perché se lo ricorda.
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
  /\b(?:ti\s+)?(?:sei|eri|fossi|sarai|saresti)\s+(?:gi[àa]\s+|subito\s+|poi\s+|anche\s+|mai\s+)?[a-zàèéìòù]+(?:ato|ito|uto|sso|sto|tto|rso|eso|orto|erto|olto)\b/g,
  /\b(?:ti\s+)?(?:sei|eri|fossi|sarai|saresti)\s+(?:gi[àa]\s+|subito\s+|poi\s+|anche\s+|mai\s+)?[a-zàèéìòù]+(?:ata|ita|uta|ssa|sta|tta|rsa|esa|orta|erta|olta)\b/g,
  /\bda sol[oa]\b/g,
  // Il RIPIEGO TIPOGRAFICO: un segno al posto della vocale finale — chiocciola,
  // schwa, asterisco, x. Arrivato per un caso reale: la chiusura in carattere
  // del cliente workshop è uscita «Questo me piace, ragazz@», e la guardia l'ha
  // considerata pulita, perché tecnicamente invariante lo è. Ma la lingua del
  // prodotto non è «una forma che vale per entrambi», è una frase che si legge
  // — e nessuno legge una chiocciola. Il modello ci arriva quando gli si chiede
  // di non accordare e lui SOSTITUISCE invece di RIFORMULARE.
  // Richiede almeno due lettere prima del segno; l'esclusione guarda cosa viene
  // DOPO, e solo se somiglia a un dominio — così «scrivi a mario@kireo.it» non
  // viene catturato mentre «ragazz@.» a fine frase sì. (La prima stesura
  // escludeva un punto qualsiasi dopo il segno, e con quello non catturava
  // proprio il caso reale da cui è nata: verificato, non dedotto.)
  //
  // Lo schwa è in DUE codifiche perché in italiano sono due segni diversi:
  // `ə` (U+0259) per il singolare, `ɜ` (U+025C, lo schwa lungo) per il
  // plurale. Chi scrive l'uno scrive l'altro: è la stessa mano. C'è anche
  // `ǝ` (U+01DD, la «e» rovesciata), che non è lo schwa fonetico ma gli
  // somiglia abbastanza da finire nei testi al posto suo.
  //
  // La «x» finale (todxs, Latinx) NON è in questa lista, ed è una scelta
  // misurata: `[a-z]{2,}x` prende 233 stringhe vere del progetto — «flex» in
  // ogni classe CSS, «lux» nei vincoli di conservazione della Missione 07 —
  // e un tripwire con duecento eccezioni non è un tripwire. In italiano il
  // ripiego è la chiocciola o lo schwa; se un giorno uscisse una «x» si
  // aggiunge qui con l'ancoraggio giusto, non a tappeto.
  /\b[a-zàèéìòù]{2,}[@əǝɜ](?![a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi,
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
//
// La riga sulle SOLE LETTERE DELL'ALFABETO è arrivata dopo, e da un caso reale:
// «Questo me piace, ragazz@». Non è un accordo sbagliato, è un modello che ha
// capito la regola e l'ha applicata SOSTITUENDO invece che RIFORMULANDO. Anche
// qui la forma resta positiva: dice come si scrive una parola, non esibisce il
// segno da evitare — mostrarglielo sarebbe insegnarglielo. E dice dove sta la
// strada più corta, che nel caso osservato era togliere il vocativo: «Questo me
// piace. Non mi prometti la luna» è più in carattere di qualunque appellativo.
export const REGOLA_LINGUA_INVARIANTE = `

LINGUA (vale per ogni frase che rivolgi allo studente): non sai se chi legge è una ragazza o un ragazzo, e non lo saprai mai. Racconta quello che ha fatto con verbi che al passato prossimo si coniugano con «avere» — «hai cercato», «hai parlato», «hai chiesto», «hai pensato», «hai messo», «hai lasciato fuori» — perché restano identici per chiunque. Se il verbo che ti viene si coniuga con «essere», oppure è riflessivo, sostituiscilo con uno che si coniuga con «avere»: vale anche dentro le frasi secondarie e le domande. Per il resto usa locuzioni che non cambiano desinenza («per conto tuo», «alle strette», «a tuo agio», «con calma»). Scrivi ogni parola con le sole lettere dell'alfabeto: quando una parola ti costringerebbe a scegliere un genere, cambia la parola — e spesso la strada più corta è toglierla, perché un appellativo o un aggettivo riferito a chi legge quasi sempre si può semplicemente non mettere. Ogni frase deve poter essere letta da una ragazza e da un ragazzo senza cambiare una lettera.`;

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
