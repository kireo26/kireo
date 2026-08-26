// Scansione di un valore JSON con una lista di pattern, in un posto solo.
//
// Serve a tre chiamanti che altrimenti scriverebbero tre ricorsioni destinate a
// divergere: la guardia sulla lingua invariante (accordoGenere), la guardia sul
// registro (registroStudente) e il tripwire del finale, che gira sulle stringhe
// cablate invece che su una risposta AI.
//
// Le CHIAVI non si guardano mai: sono nomi di campo, non lingua. Solo i valori
// di tipo stringa.

// Raccoglie ogni stringa dentro un valore JSON, a qualunque profondità: la
// risposta di un revisore è un oggetto con array di frasi, e la forma cambia da
// un revisore all'altro.
export function stringheInJson(valore: unknown): string[] {
  if (typeof valore === "string") return [valore];
  if (Array.isArray(valore)) return valore.flatMap(stringheInJson);
  if (valore && typeof valore === "object") return Object.values(valore).flatMap(stringheInJson);
  return [];
}

// Tutte le occorrenze, non solo la prima: si contano i casi, non i testi.
//
// I pattern arrivano da liste diverse e non tutte hanno il flag `g` — quelle del
// lessico-verdetto nascono come pattern da `match`, quelle dell'accordo come
// pattern da `matchAll`. Normalizzare qui evita che l'una o l'altra lista debba
// ricordarsi di una convenzione: chi scrive un pattern pensa al pattern.
export function trovaConPattern(testo: string, patterns: RegExp[]): string[] {
  const t = String(testo || "").toLowerCase();
  const out: string[] = [];
  for (const re of patterns) {
    const globale = re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
    globale.lastIndex = 0;
    for (const m of t.matchAll(globale)) out.push(m[0]);
  }
  return out;
}

export function trovaConPatternInJson(valore: unknown, patterns: RegExp[]): string[] {
  return stringheInJson(valore).flatMap((s) => trovaConPattern(s, patterns));
}
