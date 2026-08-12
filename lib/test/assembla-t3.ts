// KIREO — T3 «Più a fondo»: assemblaggio deterministico degli item a partire
// dalle aree già emerse. Logica PURA: nessuna AI, nessuna chiamata esterna,
// nessun accesso al DB. Le stesse (candidate, asseDominante, attemptId) danno
// sempre gli stessi item nello stesso ordine — così il player (che assembla per
// mostrare) e lo scoring (che riassembla per correggere) coincidono, e tornando
// indietro/riprendendo il test la sequenza non cambia.
//
// Due tipi di item (vedi config.ts):
//  - COPPIA: due vignette di aree DIVERSE (torneo). La scelta = +1 incontro
//    all'area vinta → prova d'AREA.
//  - TENSIONE: due vignette della STESSA area (candidate #1), asse diverso. La
//    scelta discrimina lo STILE dentro l'area, non l'area → prova di STILE.

import type { AsseStile } from "@/lib/escape/tipi";
import { VIGNETTE_T3, type ItemT3, type VignettaT3 } from "./config";
import { getAreaBySlug } from "@/data/aree";
import { ordineOpzioni } from "./ordine";

// item_id della riga sintetica in test_response che CONGELA le candidate del
// tentativo (niente migrazione: si riusa test_response). Non è un item vero, lo
// scoring e il player lo ignorano (il suo id non compare tra gli item assemblati).
export const T3_FROZEN_ITEM_ID = "__t3_frozen__";

export const MIN_CANDIDATE = 3;
export const MAX_CANDIDATE = 5;
export const OBIETTIVO_COPPIE = 8; // + 3 tensione ⇒ 11 item totali (dentro 10-12)
export const NUM_TENSIONE = 3;

export type SegnaleArea = { area_slug: string; interest_score: number };
export type CandidateCongelate = { candidate: string[]; asseDominante: AsseStile | null };

const nomeArea = (slug: string) => getAreaBySlug(slug)?.nome ?? slug;
const capitalizza = (s: string) => (s.length ? s[0].toUpperCase() + s.slice(1) : s);

// Aree candidate: le più alte in area_signal, al massimo MAX_CANDIDATE. Ordine
// per punteggio decrescente, con pareggio risolto per slug (deterministico).
// Solo aree presenti nel banco vignette. Sotto MIN_CANDIDATE → [] (fallback).
export function selezionaCandidate(segnali: SegnaleArea[]): string[] {
  const valide = segnali.filter((s) => s.area_slug in VIGNETTE_T3);
  const ordinate = [...valide].sort((a, b) => b.interest_score - a.interest_score || a.area_slug.localeCompare(b.area_slug));
  const top = ordinate.slice(0, MAX_CANDIDATE).map((s) => s.area_slug);
  return top.length >= MIN_CANDIDATE ? top : [];
}

// Coppie di indici (i<j) ordinate per VICINANZA di rango: le aree adiacenti nel
// ranking sono le più vicine di punteggio, quindi la scelta è più informativa
// (proxy deterministico della «vicinanza di punteggio» usando solo l'ordine
// congelato, non i punteggi grezzi, che allo scoring non sono disponibili).
function coppieOrdinate(n: number): [number, number][] {
  const coppie: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) coppie.push([i, j]);
  return coppie.sort((p, q) => p[1] - p[0] - (q[1] - q[0]) || p[0] - q[0] || p[1] - q[1]);
}

function itemCoppia(vx: VignettaT3, vy: VignettaT3): ItemT3 {
  return {
    id: `t3_c_${vx.id}_${vy.id}`,
    numero: 0,
    kind: "coppia",
    domanda: "Ti hanno fatto provare due pomeriggi diversi. Quale sceglieresti di rivivere?",
    frammento: `Tra passare un pomeriggio a ${vx.testo} o a ${vy.testo}`,
    opzioni: [
      { id: vx.id, label: capitalizza(vx.testo), area: vx.area },
      { id: vy.id, label: capitalizza(vy.testo), area: vy.area },
    ],
  };
}

function itemTensione(area: string, vi: VignettaT3, vj: VignettaT3): ItemT3 {
  return {
    id: `t3_t_${vi.id}_${vj.id}`,
    numero: 0,
    kind: "tensione",
    area,
    domanda: `Anche questi due pomeriggi erano nello stesso campo, ${nomeArea(area)}. Quale ti somiglia di più?`,
    frammento: `Dentro ${nomeArea(area)}, tra ${vi.testo} e ${vj.testo}`,
    opzioni: [
      { id: vi.id, label: capitalizza(vi.testo), asse: vi.asse },
      { id: vj.id, label: capitalizza(vj.testo), asse: vj.asse },
    ],
  };
}

// Genera le coppie area-contro-area: una passata per combo di vignette (indice
// 0, poi 1, poi 2), in ordine di vicinanza, finché non si raggiunge
// OBIETTIVO_COPPIE. Con 5 aree bastano combo diverse (nessuna ripetizione di
// coppia); con 3-4 aree la stessa coppia ricorre con vignette diverse (scene
// concrete diverse, torneo comunque robusto perché lo scoring normalizza per
// incontri giocati).
function costruisciCoppie(candidate: string[]): ItemT3[] {
  const coppieIdx = coppieOrdinate(candidate.length);
  const out: ItemT3[] = [];
  for (let combo = 0; combo < 3 && out.length < OBIETTIVO_COPPIE; combo++) {
    for (const [i, j] of coppieIdx) {
      if (out.length >= OBIETTIVO_COPPIE) break;
      const vx = VIGNETTE_T3[candidate[i]][combo];
      const vy = VIGNETTE_T3[candidate[j]][combo];
      out.push(itemCoppia(vx, vy));
    }
  }
  return out;
}

// Tre item di tensione sull'area candidata #1: i tre accostamenti delle sue tre
// vignette. Se l'asse dominante (da T2) è tra i tre, gli accostamenti che lo
// contengono vanno per primi — così lo studente incontra subito «il tuo stile
// contro un altro» dentro l'area che gli piace di più.
function costruisciTensione(candidate: string[], asseDominante: AsseStile | null): ItemT3[] {
  const area = candidate[0];
  const [v0, v1, v2] = VIGNETTE_T3[area];
  const accostamenti: [VignettaT3, VignettaT3][] = [
    [v0, v1],
    [v0, v2],
    [v1, v2],
  ];
  const contieneDom = (p: [VignettaT3, VignettaT3]) => (asseDominante && (p[0].asse === asseDominante || p[1].asse === asseDominante) ? 0 : 1);
  const ordinati = accostamenti
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => contieneDom(a.p) - contieneDom(b.p) || a.idx - b.idx)
    .slice(0, NUM_TENSIONE);
  return ordinati.map(({ p }) => itemTensione(area, p[0], p[1]));
}

// Assemblaggio completo. Ordine di presentazione mescolato ma STABILE per
// tentativo (seme = attemptId), come T1/T2. Lo scoring non dipende dall'ordine
// (mappa le risposte per id), ma il player sì: la sequenza non deve cambiare tra
// un caricamento e l'altro.
export function assemblaT3(congelate: CandidateCongelate, attemptId: string): ItemT3[] {
  const { candidate, asseDominante } = congelate;
  if (candidate.length < MIN_CANDIDATE) return [];
  const grezzi = [...costruisciCoppie(candidate), ...costruisciTensione(candidate, asseDominante)];
  const ordinati = ordineOpzioni(attemptId, "t3_sequenza", grezzi);
  return ordinati.map((it, i) => ({ ...it, numero: i + 1 }));
}
