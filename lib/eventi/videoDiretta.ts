// La riga che la console del moderatore mostra quando il video di una diretta
// non arriva agli studenti (18/10). È un VALORE e non un ramo nel JSX, per la
// ragione di casa: una frase composta in un `.tsx` non si prova da uno script.
//
// «Etichetta: numero» (la forma di Mario): nessun accordo da sbagliare fra «1
// studente» e «12 studenti».
//
// ⚠️ ZERO E «NON LO SO» TACCIONO TUTTI E DUE, e per due ragioni diverse: zero è
// la notizia buona e non serve un riquadro rosso per dirla; `null` vuol dire
// che non abbiamo potuto contare — e dire «0» lì sarebbe la risposta comoda.
// ⚠️ Testo mio, da rileggere (voce).
export function rigaPlayerRotti(rotti: number | null): string | null {
  if (rotti === null || rotti <= 0) return null;
  return `Il video non si vede. Studenti che in questo momento vedono un riquadro rosso al posto della diretta: ${rotti}.`;
}
