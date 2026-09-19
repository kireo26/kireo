// Dalle righe AUTOREVOLI di `test_response` alle prove: un posto solo.
//
// PERCHÉ ESISTE, e non è un riordino. Il 2026-09-19 il robot del banco ha
// salvato le quattordici risposte di T1 come stringhe nude (`"i1d"`) invece
// che come payload (`{opzioneId: "i1d"}`). La route legge `payload.opzioneId`,
// quindi non ne ha vista nessuna: zero prove, profilo vuoto, e il primo ad
// accorgersene è stato T3, due test più tardi, dicendo che le aree candidate
// erano meno di tre.
//
// Il controllo che avrebbe dovuto prenderlo era verde, e questa è la parte da
// non perdere: `verifica-percorso-robot.js` chiamava lo scoring passandogli la
// mappa delle risposte GIÀ SVOLTA — `new Map(Object.entries(T1_RISPOSTE))` —
// cioè esattamente nella forma che la route produce DOPO aver letto il
// payload. Provava il pezzo dopo quello rotto. Finché la lettura del payload
// vive dentro la route, nessun controllo può attraversarla senza riscriverla,
// e una copia riscritta è una copia che diverge.
//
// Quindi la lettura sta qui, la route la chiama, e il banco la attraversa con
// i payload veri del robot: se il robot salva una forma che la route non sa
// leggere, `npm run test:percorso` lo dice prima della passata invece che a
// metà.

import { SLUG_T3, getTest } from "./config";
import { calcolaEvidenzeT2, calcolaEvidenzeT3, calcolaEvidenzeTest, type EvidenzaTest } from "./scoring";
import { T3_FROZEN_ITEM_ID, type CandidateCongelate } from "./assembla-t3";

/** Una riga di `test_response` come la restituisce il database. */
export type RigaRisposta = { item_id: string; payload: unknown };

type PayloadT2 = { opzioneId?: string; ordine?: string[]; allocazioni?: Record<string, number>; valore?: number };

/**
 * Le prove di un tentativo, calcolate dalle sue righe.
 *
 * Nessuna eccezione e nessun ripiego silenzioso: un payload che non si sa
 * leggere semplicemente non produce prove — ed è per questo che chi chiama
 * DEVE guardare quante ne sono uscite, invece di dare per buono l'array.
 */
export function evidenzeDaRighe(testSlug: string, attemptId: string, righe: RigaRisposta[]): EvidenzaTest[] {
  if (testSlug === SLUG_T3) {
    // T3: si riassembla dagli item congelati (mai riletti da `area_signal`).
    const frozen = righe.find((r) => r.item_id === T3_FROZEN_ITEM_ID);
    const congelate = (frozen?.payload as CandidateCongelate | undefined) ?? { candidate: [], asseDominante: null };
    const risposte = new Map<string, { opzioneId?: string }>();
    for (const r of righe) {
      if (r.item_id === T3_FROZEN_ITEM_ID) continue;
      risposte.set(r.item_id, (r.payload as { opzioneId?: string }) ?? {});
    }
    return calcolaEvidenzeT3(congelate, attemptId, risposte).evidenze;
  }

  const test = getTest(testSlug);
  if (test?.misura === "assi") {
    const risposte = new Map<string, PayloadT2>();
    for (const r of righe) risposte.set(r.item_id, (r.payload as PayloadT2) ?? {});
    return calcolaEvidenzeT2(testSlug, risposte);
  }

  const risposte = new Map<string, string>();
  for (const r of righe) {
    const opzioneId = (r.payload as { opzioneId?: string })?.opzioneId;
    if (opzioneId) risposte.set(r.item_id, opzioneId);
  }
  return calcolaEvidenzeTest(testSlug, risposte);
}
