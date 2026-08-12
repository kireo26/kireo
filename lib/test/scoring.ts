// KIREO — Test attitudinali: scoring (SOLO server, importato dalla route di
// finalizzazione). Trasforma le risposte AUTOREVOLI (lette da test_response)
// nelle prove per il profilo unico. Le magnitudini di punteggio vivono qui, non
// nel config client (anti-gaming leggero: il peso è comunque basso).
//
// T1 (aree): scelta +3 · negativo −2 · forzata +3/−1. Un'area sotto zero → nessuna prova.
// T2 (assi): situazionali +3 (± secondari) · forzate +3/−1 · ordina posizione
//   3/2/1/0 · alloca ore/totale×4 · Likert 1-5. La NORMALIZZAZIONE è per-asse,
//   sul massimo teorico di CIASCUN asse (analitico/operativo hanno un tetto più
//   alto per via delle Likert e delle forzate): normalizzare su un massimo comune
//   li gonfierebbe entrambi. Un asse sotto zero → nessuna prova.
//
// Le prove entrano in `evidence` con dimensione='interest', fonte='test' e PESO
// BASSO fisso (0,35): una missione (peso 1,2-1,5) vale tre-quattro test, così un
// test compilato strategicamente viene corretto dalle missioni. NON alzare il peso.

import type { AsseStile } from "@/lib/escape/tipi";
import { getTest } from "./config";
import type { ItemT2 } from "./config";

export const PESO_TEST = 0.35;
const SCORE_RIFERIMENTO = 9; // T1: 3 scelte positive sulla stessa area → valore 1

export type EvidenzaTest = {
  area_slug?: string | null;
  asse?: AsseStile | null;
  dimensione: "interest";
  valore: number; // 0..1
  peso: number; // > 0
  motivazione: string;
  item_id: string;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const ASSI: AsseStile[] = ["analitico", "relazionale", "creativo", "operativo"];

// ─────────────────────────────────────────── T1 (aree)
export function calcolaEvidenzeTest(testSlug: string, risposte: Map<string, string>): EvidenzaTest[] {
  const test = getTest(testSlug);
  if (!test || test.misura !== "aree") return [];

  const punteggi = new Map<string, number>();
  const motivazioni = new Map<string, string[]>();
  const itemDiArea = new Map<string, string>();
  const add = (area: string, delta: number) => punteggi.set(area, (punteggi.get(area) ?? 0) + delta);
  const racchiudi = (s: string) => (s.startsWith("«") && s.endsWith("»") ? s : `«${s}»`);
  const positiva = (area: string, item: { id: string; frammento: string }, opzLabel: string) => {
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
      add(opz.area, -2);
    } else if (item.tipo === "forzata") {
      add(opz.area, 3);
      positiva(opz.area, item, opz.label);
      const altra = item.opzioni.find((o) => o.id !== opz.id);
      if (altra) add(altra.area, -1);
    } else {
      add(opz.area, 3);
      positiva(opz.area, item, opz.label);
    }
  }

  const evidenze: EvidenzaTest[] = [];
  for (const [area, score] of punteggi) {
    if (score <= 0) continue;
    const valore = clamp01(score / SCORE_RIFERIMENTO);
    const mots = motivazioni.get(area) ?? [];
    evidenze.push({ area_slug: area, dimensione: "interest", valore: Number(valore.toFixed(3)), peso: PESO_TEST, motivazione: mots.slice(0, 2).join(" · ") || "È emersa dalle tue risposte.", item_id: itemDiArea.get(area) ?? test.items[0].id });
  }
  return evidenze;
}

// ─────────────────────────────────────────── T2 (assi)

// Punti positivi che un item può dare a un asse (per il massimo teorico).
function maxItemPerAsse(item: ItemT2, asse: AsseStile): number {
  if (item.tipo === "scelta") return Math.max(0, ...item.opzioni.map((o) => o.pesi.filter((p) => p.asse === asse).reduce((a, p) => a + p.punti, 0)));
  if (item.tipo === "ordina") return item.elementi.some((e) => e.asse === asse) ? 3 : 0; // 1° posto
  if (item.tipo === "alloca") return item.voci.some((v) => v.asse === asse) ? 4 : 0; // tutte le ore su quell'asse
  return item.asse === asse ? 5 : 0; // Likert max
}

// Massimo teorico per asse, CALCOLATO dagli item (non hard-coded): è la base
// della normalizzazione per-asse. Analitico/operativo escono più alti — è
// proprio per questo che NON si normalizza su un massimo comune.
export function massimiTeorici(testSlug: string): Record<AsseStile, number> {
  const test = getTest(testSlug);
  const m: Record<AsseStile, number> = { analitico: 0, relazionale: 0, creativo: 0, operativo: 0 };
  if (!test || test.misura !== "assi") return m;
  for (const item of test.items) for (const asse of ASSI) m[asse] += maxItemPerAsse(item, asse);
  return m;
}

type PayloadT2 = { opzioneId?: string; ordine?: string[]; allocazioni?: Record<string, number>; valore?: number };

// risposte: mappa itemId → payload (dal DB). Un asse sotto zero → nessuna prova.
export function calcolaEvidenzeT2(testSlug: string, risposte: Map<string, PayloadT2>): EvidenzaTest[] {
  const test = getTest(testSlug);
  if (!test || test.misura !== "assi") return [];

  const grezzi: Record<AsseStile, number> = { analitico: 0, relazionale: 0, creativo: 0, operativo: 0 };
  const motivazioni: Record<AsseStile, string[]> = { analitico: [], relazionale: [], creativo: [], operativo: [] };
  const itemDiAsse: Partial<Record<AsseStile, string>> = {};
  const add = (asse: AsseStile, delta: number) => (grezzi[asse] += delta);
  const nota = (asse: AsseStile, item: ItemT2, testo: string) => { motivazioni[asse].push(`${item.frammento}: ${testo}.`); if (!itemDiAsse[asse]) itemDiAsse[asse] = item.id; };

  for (const item of test.items) {
    const p = risposte.get(item.id);
    if (!p) continue;
    if (item.tipo === "scelta") {
      const opz = item.opzioni.find((o) => o.id === p.opzioneId);
      if (!opz) continue;
      for (const peso of opz.pesi) {
        add(peso.asse, peso.punti);
        if (peso.punti > 0) nota(peso.asse, item, opz.label.toLowerCase());
      }
    } else if (item.tipo === "ordina") {
      const ordine = p.ordine ?? item.elementi.map((e) => e.id);
      ordine.forEach((id, i) => {
        const el = item.elementi.find((e) => e.id === id);
        if (!el) return;
        const punti = [3, 2, 1, 0][i] ?? 0;
        add(el.asse, punti);
        if (i === 0) nota(el.asse, item, `hai messo per prima «${el.label.toLowerCase()}»`);
      });
    } else if (item.tipo === "alloca") {
      const alloc = p.allocazioni ?? {};
      let maxOre = 0, maxVoce: string | null = null;
      for (const v of item.voci) {
        const ore = Number(alloc[v.id]) || 0;
        if (ore <= 0) continue;
        add(v.asse, Math.round((ore / item.totale) * 4));
        if (ore > maxOre) { maxOre = ore; maxVoce = v.label.toLowerCase(); }
        if (maxVoce) itemDiAsse[v.asse] = itemDiAsse[v.asse] ?? item.id;
      }
      if (maxVoce) {
        const v = item.voci.find((x) => x.label.toLowerCase() === maxVoce);
        if (v) nota(v.asse, item, `«${maxVoce}»`);
      }
    } else {
      // likert 1-5
      const val = Math.max(1, Math.min(5, Number(p.valore) || 0));
      if (val > 0) { add(item.asse, val); if (val >= 4) nota(item.asse, item, "ti ci sei riconosciuto"); }
    }
  }

  const massimi = massimiTeorici(testSlug);
  const evidenze: EvidenzaTest[] = [];
  for (const asse of ASSI) {
    const score = grezzi[asse];
    if (score <= 0) continue; // asse sotto zero (o a zero): nessuna prova
    const valore = clamp01(score / (massimi[asse] || 1)); // normalizzazione PER-ASSE
    const mots = motivazioni[asse];
    evidenze.push({ asse, dimensione: "interest", valore: Number(valore.toFixed(3)), peso: PESO_TEST, motivazione: mots.slice(0, 2).join(" · ") || "È emerso dal tuo modo di rispondere.", item_id: itemDiAsse[asse] ?? test.items[0].id });
  }
  return evidenze;
}
