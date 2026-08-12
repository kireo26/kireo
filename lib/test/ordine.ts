// KIREO — Test attitudinali: ordine delle opzioni randomizzato ma STABILE per
// tentativo. Il design originale aveva sempre A=analitico, B=relazionale…: il
// pattern era riconoscibile alla quarta domanda. Qui l'ordine è mescolato, ma
// deve restare identico se lo studente torna indietro o riprende il test —
// quindi è DERIVATO da (attemptId, itemId), non da un random a ogni render.
//
// Funzione pura e deterministica (nessuna dipendenza da Math.random): stesso
// input → stesso output. Usata dal player (client) e verificabile nei test.

// FNV-1a 32-bit: hash stabile della stringa seme.
function hashStringa(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: PRNG deterministico a 32 bit da un seme intero.
function mulberry32(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Restituisce una NUOVA lista con le opzioni mescolate in modo deterministico
// dal seme (attemptId, itemId). Fisher-Yates con il PRNG seminato.
export function ordineOpzioni<T>(attemptId: string, itemId: string, opzioni: readonly T[]): T[] {
  const rnd = mulberry32(hashStringa(`${attemptId}:${itemId}`));
  const a = [...opzioni];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
