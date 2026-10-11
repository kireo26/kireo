// Come si scrive in un log un errore che arriva dal database.
//
// ⚠️⚠️ IL DIFETTO DA CUI NASCE (11/10/2026, e la frase è di Mario):
//
//     «Si conserva la parte dell'errore che dice CHE è andata male, e si butta
//     quella che dice COSA. Il primo pezzo lo sapevamo già — l'utente ha visto
//     un rosso. Il secondo era l'unico che serviva.»
//
// Il caso vero. L'export presenze dell'admin rispondeva 500 e nel log c'era:
//
//     Errore esporta_presenze_admin: structure of query does not match
//       function result type
//
// Postgres, su quell'errore, emette SEMPRE anche un `DETAIL` che dice quale
// colonna, quale tipo si aspettava e quale ha trovato:
//
//     Returned type character varying(255) does not match expected type text
//       in column 3.
//
// `details` arriva fino a noi dentro l'oggetto errore di PostgREST, e lo
// buttavamo via con un `error.message ?? error`. Senza quella riga sono serviti
// tre giri di query sul database per ricostruire a mano una cosa che il
// database aveva già detto al primo colpo.
//
// ⚠️ LA CLASSE ERA DI DICIOTTO PUNTI, non di uno: ogni posto del progetto che
// logga un errore Supabase teneva solo `message`. Curarne uno avrebbe lasciato
// la classe — e il prossimo difetto sarebbe arrivato muto da un altro file.
//
// COSA CONTIENE UN ERRORE POSTGREST, e perché servono tutti e quattro:
//   • `message`  — che è andata male. È quello che avevamo.
//   • `details`  — cosa, esattamente. Il `DETAIL` di Postgres: la colonna, il
//                  valore che ha violato un vincolo, la riga in conflitto.
//   • `hint`     — cosa fare. Postgres lo riempie su diversi errori comuni
//                  («Perhaps you meant to reference the column…»).
//   • `code`     — lo SQLSTATE. È l'unico pezzo che si può confrontare in
//                  codice senza leggere una frase (23505, 42804, 42501…).
//
// ⚠️ ACCETTA `unknown` DI PROPOSITO: in un `catch` non si sa cosa arriva, e un
// helper che pretende la forma giusta è un helper che qualcuno scavalca con un
// `.message` al volo — cioè il difetto di partenza, ricreato dalla cura. Qui
// qualunque valore produce comunque una riga leggibile.

/** La forma di un errore PostgREST, per quel che ci serve leggerne. */
type ErroreForse = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

function pezzo(etichetta: string, valore: unknown): string | null {
  if (valore === null || valore === undefined) return null;
  const s = typeof valore === "string" ? valore.trim() : String(valore);
  return s === "" ? null : `${etichetta}: ${s}`;
}

/**
 * Una riga sola, con tutto quello che l'errore sapeva dire.
 *
 * Esempio, sul difetto dell'11/10:
 *   «structure of query does not match function result type · dettaglio:
 *    Returned type character varying(255) does not match expected type text in
 *    column 3. · codice: 42804»
 *
 * Su un valore che non è un errore PostgREST (un `Error` di JavaScript, una
 * stringa, `null`) degrada verso il dire qualcosa invece di niente: mai una
 * riga vuota, perché una riga vuota in un log si legge come «non è successo».
 */
export function descriviErrore(e: unknown): string {
  if (e === null || e === undefined) return "(nessun errore riportato)";
  if (typeof e === "string") return e;

  if (typeof e === "object") {
    const o = e as ErroreForse;
    const pezzi = [
      pezzo("", o.message)?.replace(/^: /, ""),
      pezzo("dettaglio", o.details),
      pezzo("suggerimento", o.hint),
      pezzo("codice", o.code),
    ].filter((p): p is string => Boolean(p));
    if (pezzi.length > 0) return pezzi.join(" · ");
  }

  // Un oggetto senza nessuno dei quattro campi: meglio la sua forma grezza che
  // «[object Object]», che è il modo più economico di non dire niente.
  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}
