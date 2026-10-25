// IL CONTATORE SOTTO IL CAMPO DELLA DOMANDA FINALE (26/10).
//
// Fino al 26/10 diceva «0 di 200 caratteri: ancora un po'» anche a zero
// caratteri: il testo giusto a 180 su 200, detto a chi non ha ancora scritto
// una parola. Tre momenti diversi, tre frasi: non hai cominciato, stai
// scrivendo, ci sei quasi. Un valore e non un ternario nel JSX, così si prova
// da uno script. ⚠️ Testi MIEI e provvisori.
//
// «Ci sei quasi» comincia all'80% del minimo: scelto, non misurato.
export const QUOTA_QUASI = 0.8;

const caratteri = (n: number) => (n === 1 ? "1 carattere" : `${n} caratteri`);

export function testoContatoreCaratteri(scritti: number, minimo: number): string {
  if (scritti >= minimo) return caratteri(scritti);
  if (scritti === 0) return `Servono almeno ${caratteri(minimo)}.`;
  const base = `${scritti} di ${minimo} caratteri`;
  return scritti >= QUOTA_QUASI * minimo ? `${base}: ci sei quasi.` : `${base}.`;
}
