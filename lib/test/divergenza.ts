// KIREO — Divergenza test↔missioni per gli assi di stile (Fase 2).
//
// Confronta l'asse dominante EMERSO DAL TEST con quello EMERSO DALLE MISSIONI.
// Se differiscono E lo studente ha completato ≥ 2 missioni, l'esito segnala una
// divergenza (status da_verificare + blocco a tono mai colpevole). Con meno di
// 2 missioni non c'è abbastanza azione per mettere in dubbio la dichiarazione:
// nessuna divergenza. Logica pura, testabile senza DB.

import type { AsseStile } from "@/lib/escape/tipi";

export const SOGLIA_MISSIONI_DIVERGENZA = 2;

export type ProvaAsse = { asse: AsseStile | null; valore: number; peso: number; fonte: string };

const ASSI: AsseStile[] = ["analitico", "relazionale", "creativo", "operativo"];

// Asse con la media pesata più alta tra le prove passate; null se nessuna prova.
function asseDominante(prove: ProvaAsse[]): AsseStile | null {
  const num: Record<AsseStile, number> = { analitico: 0, relazionale: 0, creativo: 0, operativo: 0 };
  const den: Record<AsseStile, number> = { analitico: 0, relazionale: 0, creativo: 0, operativo: 0 };
  for (const p of prove) {
    if (!p.asse || !(p.peso > 0)) continue;
    num[p.asse] += p.valore * p.peso;
    den[p.asse] += p.peso;
  }
  let dominante: AsseStile | null = null;
  let migliore = -1;
  for (const a of ASSI) {
    if (den[a] === 0) continue;
    const media = num[a] / den[a];
    if (media > migliore) {
      migliore = media;
      dominante = a;
    }
  }
  return dominante;
}

export function calcolaDivergenza(
  prove: ProvaAsse[],
  missioniCompletate: number,
): { asseTest: AsseStile; asseMissioni: AsseStile } | null {
  if (missioniCompletate < SOGLIA_MISSIONI_DIVERGENZA) return null;
  const asseTest = asseDominante(prove.filter((p) => p.fonte === "test"));
  const asseMissioni = asseDominante(prove.filter((p) => p.fonte === "mission"));
  if (!asseTest || !asseMissioni || asseTest === asseMissioni) return null;
  return { asseTest, asseMissioni };
}
