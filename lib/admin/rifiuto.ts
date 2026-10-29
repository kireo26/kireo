// UN RIFIUTO PORTA LA SUA RAGIONE (Mario, 27/10).
//
// «Una decisione che cambia i piani di qualcun altro senza portare la sua
// ragione non è una decisione: è un esito.» L'ente ha scritto un evento (o una
// comunicazione, o un post), lo ha proposto, e si vede tornare indietro un
// rifiuto muto: non può correggerlo, perché non sa cosa c'era da correggere, e
// l'unica cosa che può fare è riproporlo uguale. Approvare non ha bisogno di
// spiegazioni — non toglie niente a nessuno —, rifiutare sì.
//
// Fino al 27/10 la nota era facoltativa, e nessun commento né messaggio diceva
// perché: era nata il 13/07 copiata da `comunicazioni`. Una sola regola per chi
// rifiuta (`AzioneApprovazione`; fino al 29/10 anche `AzioneApprovazionePost`,
// uscito quando i post hanno smesso di passare da una coda: un post si toglie
// con `erroreRimozione`, lib/admin/rimozionePost.ts), e la prova la chiama
// invece di leggerla.
//
// ⚠️ La regola sta nel client, che è l'unica strada da cui oggi si rifiuta
// (l'admin dalla coda). Un vincolo nel database (`stato <> 'rifiutato' or nota
// is not null`) la renderebbe vera anche dal SQL Editor, ma andrebbe dichiarato
// `not valid` per le righe vecchie senza nota, e un `not valid` rifiuta anche un
// aggiornamento qualunque di quelle righe. La condizione che lo farebbe
// costruire: una seconda strada per rifiutare che non passi da qui.

/** Il messaggio da mostrare se la nota manca, o `null` se si può rifiutare. ⚠️ Testo mio, provvisorio. */
export function erroreRifiuto(nota: string): string | null {
  return nota.trim().length > 0
    ? null
    : "Per rifiutare scrivi una nota: è l'unica cosa che dice all'ente cosa cambiare prima di riproporlo.";
}
