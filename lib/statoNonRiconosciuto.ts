// Quando una parola per uno stato non c'è, non si stampa il valore della
// macchina: si dice che non lo riconosciamo (Mario, 03/11, dopo
// «account_cancellato» comparso a un ente). Un posto solo per la frase, e per
// la regola: ogni tabella di parole degli stati passa da qui.
// Testo mio e provvisorio.
export const STATO_NON_RICONOSCIUTO = "Stato non riconosciuto";

export function parolaDiStato(parole: Readonly<Record<string, string>>, stato: string | null | undefined): string {
  if (stato && Object.prototype.hasOwnProperty.call(parole, stato)) return parole[stato];
  return STATO_NON_RICONOSCIUTO;
}
