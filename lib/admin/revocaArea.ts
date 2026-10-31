// LA REVOCA DI UN'AREA (Mario, 31/10): da quando l'ente sceglie le sue aree e
// valgono subito (20261123110000), l'unica decisione di KIREO su un'area è
// toglierla a un ente che se l'è presa a torto. Con la motivazione obbligatoria
// — è l'unica cosa che dice all'ente cosa è successo — e l'avviso, dentro KIREO
// (un trigger) e per email (/api/admin/revoca-area). La stessa forma dei post
// tolti dal feed. Testi miei e provvisori.

export function erroreRevoca(motivo: string): string | null {
  return motivo.trim().length > 0 ? null : "Per togliere un'area scrivi il motivo: lo legge l'ente.";
}

export function messaggioRevoca(errore: string): string {
  if (/motivo_mancante/.test(errore)) return "Per togliere un'area scrivi il motivo: lo legge l'ente.";
  if (/area_non_trovata/.test(errore)) return "Quest'area non c'è più, o è già stata tolta: ricarica la pagina.";
  if (/non_autorizzato/.test(errore)) return "Solo un admin può togliere un'area.";
  return "Non è stato possibile togliere l'area. Riprova.";
}

export const TESTI_AREE_ADMIN = {
  titolo: "Aree degli enti",
  spiegazione:
    "Le aree le sceglie l'ente e valgono subito. Un'area scelta a torto si toglie con un motivo, che arriva all'ente: i suoi post escono dalla pagina di quell'area e restano nella sua bacheca.",
  nonLette: "Non siamo riusciti a leggere le aree degli enti: ricarica la pagina.",
  nessuna: "Nessun ente ha ancora scelto un'area.",
  conferma: "L'area esce dal profilo dell'ente e dalla pagina dell'area, insieme ai suoi post. L'ente riceve il motivo. Non si torna indietro da qui.",
} as const;
