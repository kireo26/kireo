import type { Dimensione } from "./tipi";

// I valori dell'enum `escape_fonte` (supabase/migrations/20260810100000 +
// 20260812100000 + 20260927110000 + 20261004150000). Il tipo vive qui e non in
// `tipi.ts` perché è qui che serve: `npm run test:fonti` confronta queste
// chiavi con i valori estratti dalle migrazioni, quindi una fonte aggiunta in
// SQL e dimenticata qui (o viceversa) diventa rossa.
export type Fonte = "mission" | "test" | "evento" | "presenza" | "workshop" | "activity";

// DA QUALE FONTE NASCE QUALE DIMENSIONE — e la conseguenza, scritta accanto.
//
// PERCHÉ QUESTO FILE ESISTE. La regola che segue è stata scritta tre volte in
// tre posti diversi e ignorata tutte e tre le volte da chi l'aveva scritta: il
// 28/09 in `lib/eventi/consegna.ts`, il 28/09 in `lib/live.ts`, e il 4/10 in un
// messaggio che la enunciava per esteso e sei righe sotto sommava pesi come se
// non valesse. Il motivo è che quei commenti stavano accanto a CHI LEGGE
// `interest_score`, e chi rompe la regola non tocca chi legge: la tocca chi
// AGGIUNGE UNA SORGENTE, e per farlo deve scegliere una dimensione.
//
// Quindi il posto giusto è questo: il punto in cui si tiene insieme
// `fonte → dimensione`. Chi aggiunge la quinta sorgente deve passare di qui, e
// legge la conseguenza prima di scegliere.
//
// ════════════════════════════ LA CONSEGUENZA ════════════════════════════
//
//   Una fonte che non scrive `interest` non potrà MAI, da sola o in
//   combinazione con altre, produrre un'affinità.
//
// Perché: `eleggibilePerAffinita` (lib/percorso/stato.ts) chiede
// `confidence >= 0,40` **e** `interest_score !== null`, e
// `ricalcola_area_signal` calcola `interest_score` come media pesata delle sole
// righe `dimensione = 'interest'` — quindi resta NULL se non ce n'è nessuna. La
// confidence invece somma il peso di TUTTE le dimensioni, quindi sale: una
// consegna e una presenza portano l'area fra le «aree che stai sfiorando», dove
// non c'è nessun punteggio da esibire, e non in classifica.
//
// La frase di Mario, parola per parola, perché resti:
//
//   «Né una consegna né una presenza possono creare un'affinità, per nessun
//   peso e per nessun numero. Alzano la confidence e popolano le aree sfiorate.
//   L'interesse lo scrivono solo i test e le missioni.»
//
// ⚠️ CHE SIA GIUSTO È UNA DECISIONE DI PRODOTTO, E NON È DI CHI SCRIVE CODICE.
// Detta ad alta voce, quella frase afferma che uno studente con quattro
// consegne eccellenti e dieci incontri seguiti per intero sulla stessa area non
// ha nessuna affinità su quell'area. Può essere giusto — un test e una missione
// chiedono una preferenza esplicita, una consegna e una presenza no — ed è in
// mano a Mario. Finché non la cambia lui, NON si aggira da qui: non si aggiunge
// una riga `interest` a una fonte per «far funzionare» un caso.
export const DIMENSIONI_PER_FONTE: Record<Fonte, readonly Dimensione[]> = {
  // Una missione è l'unica fonte che scrive tutte e quattro: le sue prove
  // nascono da azioni scelte (il mandato, i gettoni, il piano, i ruoli) più
  // tre passi aperti giudicati dall'AI. lib/escape/scoring.ts
  mission: ["interest", "performance", "self_efficacy", "curiosity"],

  // I tre test attitudinali: interesse DICHIARATO. lib/test/scoring.ts
  test: ["interest"],

  // La risposta alla domanda finale di una diretta: come si ragiona davanti a
  // un problema, non verso cosa si è orientati — la domanda l'ha posta
  // qualcun altro. lib/eventi/consegna.ts
  evento: ["performance"],

  // L'aver seguito una diretta per intero: curiosità. A un incontro ci si può
  // essere trovati per mille motivi (la classe, un'ora buca, un docente che
  // l'ha detto), quindi non è interesse; ma andarci e restare è un'azione.
  // supabase/migrations/20261004160000_presenza_profilo.sql
  presenza: ["curiosity"],

  // Predisposte e senza scrittori: il cross-feed da `activity_log` e dai
  // workshop è rinviato (vedi i punti aperti in CLAUDE.md). Quando si
  // accenderanno, la scala dei pesi va RICALIBRATA da zero e non trasportata —
  // `activity_log.peso` è un intero 1…25 che si somma, `evidence.peso` è
  // 0,35…1,5 e pesa una media.
  workshop: [],
  activity: [],
};

// Le fonti che oggi scrivono qualcosa. Separata dalla tabella perché «non ha
// scrittori» è un'affermazione sul presente, e il giorno in cui una delle due
// predisposte si accende è questa riga che cambia.
export const FONTI_VIVE = ["mission", "test", "evento", "presenza"] as const;

export function scriveInteresse(fonte: Fonte): boolean {
  return DIMENSIONI_PER_FONTE[fonte].includes("interest");
}

// Una fonte può, da sola, portare un'area in classifica? È la conseguenza
// qui sopra resa eseguibile — così chi se lo chiede non deve ricostruirla
// leggendo due file.
export function puoProdurreAffinita(fonte: Fonte): boolean {
  return scriveInteresse(fonte);
}
