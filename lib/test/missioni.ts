// KIREO — Ponte area → missione per l'esito di T3. NON definisce un mapping
// nuovo: riusa le `areeCandidate` già dichiarate su ogni missione Escape
// (REGISTRO_MISSIONI_AREE), scegliendo per ogni area la missione dove quell'area
// è più centrale.
//
// In v2 tutte le missioni sono etichettate `tipo: "cross-area"` (ognuna tocca
// più aree), quindi `tipo` non distingue: il vero segnale di centralità è la
// POSIZIONE dell'area in `areeCandidate` (indice 0 = tema portante). Regola
// deterministica, a preferenza decrescente:
//   1) indice più basso dell'area nella lista (più centrale);
//   2) a parità, la lista PIÙ CORTA (missione più mono-tematica: la Missione 01
//      elenca tutte e 18 le aree, quindi perde contro una a sei temi);
//   3) a parità, l'ordine nel registro.

import { REGISTRO_MISSIONI_AREE } from "@/lib/escape/config";

export type MissioneSuggerita = { slug: string; titolo: string };

// Slug delle missioni del «blocco» di un'area: tutte quelle che elencano l'area
// tra le `areeCandidate`. Usato dalle Guide per «≥1 missione del blocco
// completata» (si interseca con i mission_attempt completati dello studente).
export function missioniDelBlocco(areaSlug: string): string[] {
  return REGISTRO_MISSIONI_AREE.filter((m) => m.areeCandidate.includes(areaSlug)).map((m) => m.slug);
}

export function missionePerArea(areaSlug: string): MissioneSuggerita | null {
  let migliore: { slug: string; titolo: string; indice: number; ampiezza: number } | null = null;
  for (const m of REGISTRO_MISSIONI_AREE) {
    const idx = m.areeCandidate.indexOf(areaSlug);
    if (idx === -1) continue;
    const cand = { slug: m.slug, titolo: m.titolo, indice: idx, ampiezza: m.areeCandidate.length };
    if (!migliore || cand.indice < migliore.indice || (cand.indice === migliore.indice && cand.ampiezza < migliore.ampiezza)) {
      migliore = cand;
    }
  }
  return migliore ? { slug: migliore.slug, titolo: migliore.titolo } : null;
}
