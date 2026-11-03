// CONSERVARE TUTTO, TOGLIERE IL NOME (Mario, 03/11): quando uno studente cancella
// l'account il suo testo esce (la colonna diventa NULL, `testo_rimosso_il` dice
// quando), e la riga resta, perché è un fatto: una domanda fatta, un messaggio
// mandato. Chi legge dall'altra parte vede che c'era, e perché non c'è più.
//
// Il testo della conversazione è di Mario; gli altri sono miei e provvisori.

export const TESTO_CONVERSAZIONE_ACCOUNT_CANCELLATO = "Questa persona ha cancellato il suo account.";

export const TESTO_MESSAGGIO_RIMOSSO = "Messaggio cancellato: chi l'ha scritto ha cancellato il suo account.";

export const TESTO_DOMANDA_RIMOSSA = "Domanda cancellata: chi l'ha fatta ha cancellato il suo account.";

/** Un testo NULL è un testo tolto con l'account: mai una riga vuota senza spiegazione. */
export function testoOppureRimosso(testo: string | null | undefined, alPosto: string): string {
  return typeof testo === "string" ? testo : alPosto;
}
