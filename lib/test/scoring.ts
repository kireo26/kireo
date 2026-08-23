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
import { assemblaT3, type CandidateCongelate } from "./assembla-t3";

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
      for (const peso of opz.pesi) add(peso.asse, peso.punti); // punteggi invariati
      // Motivazione UNA VOLTA, sotto l'asse dove pesa di più; gli altri assi
      // toccati nominati in coda («— tocca anche X»). Prima la stessa frase
      // compariva identica sotto ogni asse e sembrava un errore: così è vera,
      // e dice in più che certe risposte pesano su due dimensioni.
      const positivi = opz.pesi.filter((x) => x.punti > 0).sort((a, b) => b.punti - a.punti);
      if (positivi.length > 0) {
        const cap = (a: AsseStile) => a.charAt(0).toUpperCase() + a.slice(1);
        const coda = positivi.length > 1 ? ` — tocca anche ${positivi.slice(1).map((x) => cap(x.asse)).join(" e ")}` : "";
        nota(positivi[0].asse, item, `${opz.label.toLowerCase()}${coda}`);
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

// ─────────────────────────────────────────── T3 (torneo + tensione)
// Riassembla gli item dalle candidate CONGELATE (mai rilette da area_signal) e
// dall'attemptId, poi trasforma le risposte in prove. Due nature ben distinte:
//  - COPPIA → prova d'AREA (area_slug valorizzato, asse null). L'area scelta
//    vince l'incontro; il valore finale è il tasso di vittorie (vittorie/incontri
//    giocati), così le coppie ripetute non falsano la classifica.
//  - TENSIONE → prova di STILE (asse valorizzato, area_slug null). MAI una prova
//    d'area: le due opzioni sono la stessa area, ciò che discrimina è l'asse.
export type RisultatoT3 = { evidenze: EvidenzaTest[]; classifica: { area_slug: string; vittorie: number; incontri: number }[] };

export function calcolaEvidenzeT3(congelate: CandidateCongelate, attemptId: string, risposte: Map<string, { opzioneId?: string }>): RisultatoT3 {
  const items = assemblaT3(congelate, attemptId);

  const vittorie = new Map<string, number>();
  const incontri = new Map<string, number>();
  const motArea = new Map<string, string>();
  const itemArea = new Map<string, string>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  const pickAsse = new Map<AsseStile, number>();
  const motAsse = new Map<AsseStile, string>();
  const itemAsse = new Map<AsseStile, string>();
  let tensioneRisposte = 0;
  const bumpA = (k: AsseStile) => pickAsse.set(k, (pickAsse.get(k) ?? 0) + 1);

  for (const item of items) {
    const opzId = risposte.get(item.id)?.opzioneId;
    if (!opzId) continue;
    if (item.kind === "coppia") {
      const scelta = item.opzioni.find((o) => o.id === opzId);
      if (!scelta) continue;
      for (const o of item.opzioni) bump(incontri, o.area); // entrambe hanno giocato
      bump(vittorie, scelta.area);
      if (!motArea.has(scelta.area)) {
        motArea.set(scelta.area, `${item.frammento}, hai scelto «${scelta.label.toLowerCase()}».`);
        itemArea.set(scelta.area, item.id);
      }
    } else {
      const scelta = item.opzioni.find((o) => o.id === opzId);
      if (!scelta) continue;
      tensioneRisposte++;
      bumpA(scelta.asse);
      if (!motAsse.has(scelta.asse)) {
        motAsse.set(scelta.asse, `${item.frammento}, hai scelto «${scelta.label.toLowerCase()}».`);
        itemAsse.set(scelta.asse, item.id);
      }
    }
  }

  const evidenze: EvidenzaTest[] = [];

  // Prove d'area: solo per le aree che hanno vinto almeno un incontro (l'area
  // vinta, mai i perdenti — T3 alza, non abbassa). Valore = tasso di vittorie.
  for (const [area, v] of vittorie) {
    const g = incontri.get(area) ?? 0;
    if (v <= 0 || g <= 0) continue;
    const valore = clamp01(v / g);
    evidenze.push({ area_slug: area, dimensione: "interest", valore: Number(valore.toFixed(3)), peso: PESO_TEST, motivazione: motArea.get(area) ?? "È emersa dai confronti.", item_id: itemArea.get(area) ?? items[0]?.id ?? "t3" });
  }

  // Prove di stile: una per asse scelto, valore = quota di scelte su quell'asse.
  for (const [asse, n] of pickAsse) {
    if (n <= 0 || tensioneRisposte <= 0) continue;
    const valore = clamp01(n / tensioneRisposte);
    evidenze.push({ asse, dimensione: "interest", valore: Number(valore.toFixed(3)), peso: PESO_TEST, motivazione: motAsse.get(asse) ?? "È emerso dai confronti dentro l'area.", item_id: itemAsse.get(asse) ?? items[0]?.id ?? "t3" });
  }

  // Classifica: per l'esito (ordine delle candidate). Vittorie desc, a parità
  // l'ordine congelato (che riflette il punteggio T1 pregresso).
  const classifica = congelate.candidate
    .map((area_slug) => ({ area_slug, vittorie: vittorie.get(area_slug) ?? 0, incontri: incontri.get(area_slug) ?? 0 }))
    .sort((a, b) => b.vittorie - a.vittorie || congelate.candidate.indexOf(a.area_slug) - congelate.candidate.indexOf(b.area_slug));

  return { evidenze, classifica };
}
