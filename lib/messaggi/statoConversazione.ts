// Le parole degli stati di una conversazione fra uno studente e un ente, in un
// posto solo (Mario, 03/11: la lista dell'ente stampava «account_cancellato»).
//
// Ogni stato del tipo `conversazione_ente_stato` ha una parola per ognuno dei
// tre che guardano la lista; `npm run test:staticonversazione` confronta le
// chiavi con l'enum delle migrazioni, quindi uno stato nuovo nasce rosso
// finché qualcuno non gli dà le sue parole.
//
// Uno stato che qui non c'è (un valore arrivato prima del codice) non si
// stampa com'è: si dice che non lo riconosciamo. Testi miei e provvisori.

import { parolaDiStato } from "@/lib/statoNonRiconosciuto";

export type StatoConversazione = "aperta" | "bloccata_da_studente" | "chiusa_da_admin" | "account_cancellato";
export type ChiGuarda = "ente" | "studente" | "admin";

export const PAROLE_STATO_CONVERSAZIONE: Record<ChiGuarda, Record<StatoConversazione, string>> = {
  ente: {
    aperta: "Aperta",
    bloccata_da_studente: "Bloccata dallo studente",
    chiusa_da_admin: "Chiusa da KIREO",
    account_cancellato: "Account cancellato",
  },
  studente: {
    aperta: "Aperta",
    bloccata_da_studente: "Bloccata",
    chiusa_da_admin: "Chiusa da KIREO",
    // Chi ha cancellato l'account non entra più: la parola c'è perché la
    // tabella sia completa, non perché qualcuno la legga.
    account_cancellato: "Account cancellato",
  },
  admin: {
    aperta: "in corso",
    bloccata_da_studente: "segnalata: bloccata dallo studente",
    chiusa_da_admin: "chiusa da KIREO",
    account_cancellato: "chiusa: lo studente ha cancellato l'account",
  },
};

export { STATO_NON_RICONOSCIUTO as STATO_CONVERSAZIONE_NON_RICONOSCIUTO } from "@/lib/statoNonRiconosciuto";

export function paroleStatoConversazione(stato: string | null | undefined, chi: ChiGuarda): string {
  return parolaDiStato(PAROLE_STATO_CONVERSAZIONE[chi], stato);
}
