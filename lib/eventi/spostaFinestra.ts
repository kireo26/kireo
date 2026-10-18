// I testi dello spostamento della finestra di una diretta (18/10). Un VALORE e
// non rami nel JSX, per poterli provare da uno script.
//
// ⚠️ Tutti miei, da rileggere (voce). Il successo dice anche la cosa che la
// funzione NON fa — avvisare gli iscritti — perché chi sposta un orario dà per
// scontato che gli altri lo sappiano.
//
// `chiave` è il messaggio d'errore della funzione SQL (o un nostro codice); si
// riconosce per sottostringa, e ciò che non si riconosce è un guasto NOSTRO,
// non un dato sbagliato di chi compila.
export function messaggioSpostaFinestra(chiave: string | null): string {
  if (chiave === null) {
    return "Orario aggiornato. Chi è iscritto lo vede alla prossima apertura della pagina, ma non riceve nessun avviso: se l'incontro è vicino, diglielo tu.";
  }
  if (chiave.includes("diretta_gia_chiusa")) {
    return "La diretta è già stata chiusa: presenze e ore sono state certificate su quell'orario, che quindi non si può più cambiare.";
  }
  if (chiave.includes("fine_prima_di_inizio")) return "La fine deve venire dopo l'inizio.";
  if (chiave.includes("date_mancanti")) return "Servono sia l'inizio sia la fine, in ora italiana.";
  if (chiave.includes("non_autorizzato")) return "Solo chi organizza l'incontro, o KIREO, può spostarne l'orario.";
  return "Non siamo riusciti a salvare il nuovo orario: è un problema nostro, non dei dati che hai scritto. Riprova fra un momento.";
}
