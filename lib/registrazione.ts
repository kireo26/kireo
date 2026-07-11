// Età compiuta a una certa data, a partire dalla data di nascita
// (formato "YYYY-MM-DD"). Usata per il blocco under-14 in registrazione.
export function calcolaEta(dataNascita: string, oggi: Date = new Date()): number {
  const nascita = new Date(dataNascita);
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const meseGiornoOggi = oggi.getMonth() * 100 + oggi.getDate();
  const meseGiornoNascita = nascita.getMonth() * 100 + nascita.getDate();
  if (meseGiornoOggi < meseGiornoNascita) eta--;
  return eta;
}

export const ETA_MINIMA = 14;

// Anno di diploma stimato dall'anno frequentato (3°/4°/5°), assumendo un
// percorso di 5 anni e anno scolastico italiano settembre-giugno.
export function calcolaAnnoDiploma(annoFrequentato: number, oggi: Date = new Date()): number {
  const meseCorrente = oggi.getMonth(); // 0 = gennaio ... 8 = settembre
  const annoFineAnnoScolasticoCorrente = meseCorrente >= 8 ? oggi.getFullYear() + 1 : oggi.getFullYear();
  const anniRimanenti = 5 - annoFrequentato;
  return annoFineAnnoScolasticoCorrente + anniRimanenti;
}
