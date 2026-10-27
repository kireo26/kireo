// L'ESITO DI UN'ISCRIZIONE D'UFFICIO, detto al referente (27/10).
//
// Fino a oggi il bottone diceva «Fatto ✓» qualunque cosa fosse successa: gli
// studenti scartati (non verificati, di un'altra scuola) e quelli già iscritti
// sparivano senza che nessuno lo dicesse, e il giorno della dashboard della
// scuola sarebbero comparsi come studenti che non hanno partecipato.
// `iscrivi_studenti_evento` e `iscrivi_classe_evento` (20261103130000) ora
// rispondono i conti; qui diventano una frase.
//
// «Etichetta: numero», non «2 iscritti»: con 1 il plurale non accorda. Le
// categorie a zero non si dicono, tranne «Iscritti», che è la risposta alla
// domanda. Testi miei, provvisori.
//
// Un esito che non si legge (null: la funzione di prima, che rispondeva void,
// o una risposta inattesa) non si racconta come un successo pieno: si dice che
// l'iscrizione è partita e che i numeri non li abbiamo.
export type EsitoIscrizione = {
  iscritti?: number;
  gia_iscritti?: number;
  non_verificati?: number;
  altra_scuola?: number;
  gruppo?: boolean;
};

export const TESTO_ESITO_NON_LETTO =
  "Iscrizione inviata, ma non siamo riusciti a leggere quanti studenti sono entrati: ricarica la pagina e controlla l'elenco.";

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function testoEsitoIscrizione(esito: unknown): { testo: string; avviso: boolean } {
  if (!esito || typeof esito !== "object") return { testo: TESTO_ESITO_NON_LETTO, avviso: true };
  const e = esito as EsitoIscrizione;
  if (e.gruppo === true) return { testo: "Classe iscritta come gruppo, a distanza.", avviso: false };
  const iscritti = numero(e.iscritti);
  if (iscritti === null) return { testo: TESTO_ESITO_NON_LETTO, avviso: true };
  const gia = numero(e.gia_iscritti) ?? 0;
  const nonVerificati = numero(e.non_verificati) ?? 0;
  const altra = numero(e.altra_scuola) ?? 0;
  // ERANO GIÀ TUTTI DENTRO (Mario, 27/10): «Iscritti adesso: 0» in testa
  // spaventava — il numero in testa a una frase decide come si legge il resto.
  // Davanti il fatto rassicurante. La frase per 20 è di Mario; quella per uno
  // solo è mia (con 1 «tutti e 1» non si dice, e «era già iscritto» accorda).
  if (iscritti === 0 && gia > 0 && nonVerificati === 0 && altra === 0) {
    return {
      testo: gia === 1 ? "Nessuna iscrizione nuova: la persona scelta aveva già un'iscrizione." : `Erano già iscritti tutti e ${gia}: nessuna iscrizione nuova.`,
      avviso: false,
    };
  }
  const parti = [`Iscritti adesso: ${iscritti}`];
  if (gia > 0) parti.push(`già iscritti prima: ${gia}`);
  if (nonVerificati > 0) parti.push(`non iscritti perché non verificati: ${nonVerificati}`);
  if (altra > 0) parti.push(`non iscritti perché non risultano della tua scuola: ${altra}`);
  return { testo: parti.join(" · ") + ".", avviso: nonVerificati > 0 || altra > 0 };
}
