// IL CODICE D'INVITO DEL TUTOR: la forma, e quello che legge chi lo prova
// (passo 5.1 del capitolo della scuola, 01/11; la regola sta in testa a
// 20261201100000).
//
// La forma conta perché il tetto conta i codici sbagliati: la pagina verifica
// mentre si scrive, e senza un controllo sulla forma ogni lettera battuta
// sarebbe un tentativo, e un referente arriverebbe al tetto scrivendo il primo
// codice. Si verifica solo un codice intero: quello vecchio (8 caratteri) o
// quello nuovo (16, in quattro gruppi).
export const FORMA_CODICE_INVITO = /^TUTOR-(?:[0-9A-F]{8}|[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})$/;

export function normalizzaCodiceInvito(grezzo: string): string {
  return grezzo.trim().toUpperCase();
}

export function codiceInvitoCompleto(codice: string): boolean {
  return FORMA_CODICE_INVITO.test(codice);
}

export type EsitoVerificaInvito =
  | { esito: "valido"; nomeScuola: string | null }
  | { esito: "non_valido" }
  | { esito: "troppi_tentativi" }
  | { esito: "non_controllato" };

// La risposta della funzione SQL, letta senza fidarsi della forma.
export function leggiEsitoVerifica(dati: unknown): EsitoVerificaInvito {
  if (!dati || typeof dati !== "object") return { esito: "non_controllato" };
  const d = dati as { esito?: unknown; nome_scuola?: unknown };
  if (d.esito === "valido") return { esito: "valido", nomeScuola: typeof d.nome_scuola === "string" ? d.nome_scuola : null };
  if (d.esito === "non_valido") return { esito: "non_valido" };
  if (d.esito === "troppi_tentativi") return { esito: "troppi_tentativi" };
  return { esito: "non_controllato" };
}

// Testi miei e provvisori.
export const TESTI_CODICE_INVITO = {
  forma: "Il codice comincia con TUTOR- ed è quello del link che ti ha mandato il referente.",
  nonValido: "Codice non valido o già usato.",
  troppiTentativi:
    "Troppi codici sbagliati provati da questa rete nell'ultima ora: riprova fra un'ora, oppure apri il link dell'invito che ti ha mandato il referente.",
  nonControllato: "Non siamo riusciti a controllare il codice: riprova fra qualche istante.",
} as const;
