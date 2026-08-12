// KIREO — Test attitudinali: scoring (SOLO server, importato dalla route di
// finalizzazione). Trasforma le risposte AUTOREVOLI (lette da test_response)
// nelle prove per il profilo unico. Le magnitudini di punteggio vivono qui, non
// nel config client (anti-gaming leggero: il peso è comunque basso).
//
// Regole di T1:
//  - scelta positiva → +3 all'area scelta;
//  - scelta negativa (item «cosa ti annoierebbe») → −2 all'area scelta;
//  - scelta forzata a coppia → +3 all'area scelta, −1 all'altra opzione;
//  - un'area può finire SOTTO ZERO: in quel caso NON si genera alcuna prova
//    (non esistono prove a peso/valore negativo nello schema).
//
// Le prove entrano in `evidence` con dimensione='interest', fonte='test' e
// PESO BASSO fisso: un'azione strutturata in missione pesa 1,2-1,5, quindi una
// missione vale tre o quattro test. NON alzare questo peso: serve a far sì che
// un test compilato strategicamente venga corretto dalle missioni successive.

import { getTest } from "./config";

// Peso deliberatamente basso delle prove di test (vedi sopra). Non modificare.
export const PESO_TEST = 0.35;
// Punteggio di riferimento per normalizzare il `valore` in 0..1: tre scelte
// positive sulla stessa area (3 × +3). Un'area scelta una volta → ~0,33; scelta
// tre volte → 1,0. Stabile fra studenti (non dipende dal massimo individuale),
// così il valore è confrontabile in aggregazione col contributo delle missioni.
const SCORE_RIFERIMENTO = 9;

export type EvidenzaTest = {
  area_slug: string;
  dimensione: "interest";
  valore: number; // 0..1
  peso: number; // > 0
  motivazione: string;
  item_id: string;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// risposte: mappa itemId → opzioneId scelta (dal DB).
export function calcolaEvidenzeTest(testSlug: string, risposte: Map<string, string>): EvidenzaTest[] {
  const test = getTest(testSlug);
  if (!test) return [];

  const punteggi = new Map<string, number>();
  const motivazioni = new Map<string, string[]>();
  const itemDiArea = new Map<string, string>(); // area → item rappresentativo (prima scelta positiva)
  const add = (area: string, delta: number) => punteggi.set(area, (punteggi.get(area) ?? 0) + delta);
  // Racchiude l'etichetta tra caporali SOLO se non li ha già (alcune opzioni
  // sono citazioni — titoli di giornale, frasi — e portano le «» dentro il
  // testo): evita le virgolette doppie annidate («« … »») nella motivazione.
  const racchiudi = (s: string) => (s.startsWith("«") && s.endsWith("»") ? s : `«${s}»`);
  const positiva = (area: string, item: TestItemLite, opzLabel: string) => {
    const arr = motivazioni.get(area) ?? [];
    arr.push(`${item.frammento} hai scelto ${racchiudi(opzLabel)}.`);
    motivazioni.set(area, arr);
    if (!itemDiArea.has(area)) itemDiArea.set(area, item.id);
  };

  for (const item of test.items) {
    const opzId = risposte.get(item.id);
    if (!opzId) continue;
    const opz = item.opzioni.find((o) => o.id === opzId);
    if (!opz) continue;

    if (item.tipo === "negativo") {
      add(opz.area, -2); // rifiuto: penalizza, nessuna motivazione positiva
    } else if (item.tipo === "forzata") {
      add(opz.area, 3);
      positiva(opz.area, item, opz.label);
      const altra = item.opzioni.find((o) => o.id !== opz.id);
      if (altra) add(altra.area, -1); // l'opzione non scelta: −1, nessuna motivazione
    } else {
      add(opz.area, 3);
      positiva(opz.area, item, opz.label);
    }
  }

  const evidenze: EvidenzaTest[] = [];
  for (const [area, score] of punteggi) {
    if (score <= 0) continue; // aree sotto zero (o a zero): nessuna prova
    const valore = clamp01(score / SCORE_RIFERIMENTO);
    const mots = motivazioni.get(area) ?? [];
    const motivazione = mots.slice(0, 2).join(" · ") || "È emersa dalle tue risposte.";
    evidenze.push({
      area_slug: area,
      dimensione: "interest",
      valore: Number(valore.toFixed(3)),
      peso: PESO_TEST,
      motivazione,
      item_id: itemDiArea.get(area) ?? test.items[0].id,
    });
  }
  return evidenze;
}

// tipo minimale usato solo internamente (evita di reimportare TestItem intero)
type TestItemLite = { id: string; frammento: string };
