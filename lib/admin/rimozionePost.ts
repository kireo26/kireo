// TOGLIERE UN POST (Mario, 29/10). Non è cancellarlo: il post esce dal feed e
// resta leggibile all'ente e all'admin, con chi l'ha tolto, quando e perché
// (`togli_post`, 20261113110000). La motivazione è obbligatoria come nel
// rifiuto di un evento, e arriva all'ente: è l'unica cosa che gli dice cosa
// non andava.
//
// Prima del gesto la conferma dice quante notifiche ai follower sono già
// partite: togliere il post non le ritira. Chi le apre arriva alla Bacheca e
// legge che il post non c'è più (`?post=`, lib/app/bacheca.ts).
//
// ⚠️ Testi miei e provvisori.

/** Il messaggio se la motivazione manca, o `null` se si può togliere. */
export function erroreRimozione(motivo: string): string | null {
  return motivo.trim().length > 0
    ? null
    : "Per togliere un post scrivi il motivo: arriva all'ente, ed è l'unica cosa che gli dice cosa non andava.";
}

/**
 * La conferma prima del gesto. `notifiche` è quante notifiche «Nuovo post»
 * sono già partite per quel post, o `null` se non si è riusciti a contarle:
 * non letto non vuol dire zero.
 */
export function testoConfermaRimozione(notifiche: number | null): string {
  const quante =
    notifiche === null
      ? "Non siamo riusciti a contare le notifiche già partite per questo post."
      : notifiche === 0
        ? "Per questo post non è partita nessuna notifica."
        : notifiche === 1
          ? "Per questo post è già partita 1 notifica a uno studente che segue l'ente: resta nella sua campanella, e aprendola leggerà che il post non c'è più."
          : `Per questo post sono già partite ${notifiche} notifiche agli studenti che seguono l'ente: restano nelle loro campanelle, e aprendole leggeranno che il post non c'è più.`;
  return `${quante} L'ente riceve il motivo. Un post tolto non torna nel feed.`;
}

/** Il rifiuto del database, detto a chi ha premuto. */
export function messaggioTogliPost(errore: string): string {
  if (errore.includes("post_non_visibile")) return "Questo post non è più nel feed: forse l'ha già tolto qualcun altro. Ricarica la pagina.";
  if (errore.includes("motivo_mancante")) return erroreRimozione("") as string;
  if (errore.includes("non_autorizzato")) return "Solo un admin può togliere un post.";
  return "Non è stato possibile togliere il post. Riprova.";
}
