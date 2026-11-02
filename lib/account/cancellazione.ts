// La pagina dell'account (02/11): cosa legge chi sta per cancellarsi, e cosa
// legge se il database dice no. La regola NON sta qui: sta in
// `stato_cancellazione_account` (20261202100000), che la pagina legge prima e
// `delete_own_account` riapplica dopo. Qui ci sono solo le parole.
//
// Testi di Mario (01/11): `TESTO_STAFF_RESTA_IL_NOME` e
// `TESTO_REFERENTE_SENZA_SUCCESSORE`. Gli altri sono miei e provvisori.
//
// ⚠️ Al referente senza successore il bottone NON c'è, non è spento: *un
// bottone spento con una spiegazione accanto invita a premerlo e poi dice di
// no* (Mario). Lo stesso per l'ente e per l'admin.

import {
  classeErroreScrittura,
  messaggioErrore,
  TESTO_SESSIONE_PERSA_SCRITTURA,
  testoGuastoScrittura,
  testoRifiutoSconosciutoScrittura,
} from "@/lib/rifiutiScrittura";

export type StatoCancellazione =
  | { puo: true; ruolo: string; resta_il_nome: boolean }
  | { puo: false; ruolo?: string; motivo: "referente_senza_successore" | "ruolo_non_previsto" | "profilo_mancante"; tutor_attivi?: number };

export const TESTO_STAFF_RESTA_IL_NOME =
  "Il tuo account sparisce. Le presenze che hai certificato restano, con il tuo nome e la data: sono il documento con cui la scuola riconosce le ore ai tuoi studenti.";

export const TESTO_REFERENTE_SENZA_SUCCESSORE =
  "Prima di andartene devi passare la scuola a qualcun altro: promuovi un tutor a referente, oppure invitane uno.";

export const TESTI_ACCOUNT = {
  studente:
    "Rimuove definitivamente il tuo profilo, la scuola collegata, le aree di interesse, le attività e le iscrizioni agli eventi. Non si torna indietro.",
  senzaFirme: "Il tuo account sparisce, con tutto quello che hai salvato su KIREO. Non si torna indietro.",
  conFirme: "Il tuo account sparisce. Quello che hai firmato su KIREO resta, con il tuo nome e la data.",
  ente: "L'account di un ente non si chiude da qui: scrivici da Contatti, e decidiamo insieme cosa succede alla pagina dell'ente.",
  admin: "L'account di un admin non si chiude da qui.",
  profiloMancante: "Questo account risulta già cancellato.",
  nonLetto: "Non siamo riusciti a leggere se puoi cancellare l'account adesso: ricarica la pagina.",
  domanda: "Vuoi davvero cancellare l'account? Non si torna indietro.",
  esportaNonDisponibile:
    "Per il tuo ruolo «Scarica i miei dati» non c'è ancora. Se ti serve una copia dei tuoi dati, scrivici da Contatti.",
} as const;

const STAFF = new Set(["tutor_scuola", "referente_scuola"]);

export type PresentazioneCancellazione =
  | { bottone: true; testo: string }
  | { bottone: false; testo: string; linkStaff: boolean };

/** Cosa dice la sezione, e se il bottone c'è. `null` = non letto. */
export function presentaCancellazione(stato: StatoCancellazione | null): PresentazioneCancellazione {
  if (stato === null) return { bottone: false, testo: TESTI_ACCOUNT.nonLetto, linkStaff: false };
  if (!stato.puo) {
    if (stato.motivo === "referente_senza_successore") return { bottone: false, testo: TESTO_REFERENTE_SENZA_SUCCESSORE, linkStaff: true };
    if (stato.motivo === "profilo_mancante") return { bottone: false, testo: TESTI_ACCOUNT.profiloMancante, linkStaff: false };
    return { bottone: false, testo: stato.ruolo === "admin" ? TESTI_ACCOUNT.admin : TESTI_ACCOUNT.ente, linkStaff: false };
  }
  if (stato.ruolo === "studente" && !stato.resta_il_nome) return { bottone: true, testo: TESTI_ACCOUNT.studente };
  if (!stato.resta_il_nome) return { bottone: true, testo: TESTI_ACCOUNT.senzaFirme };
  return { bottone: true, testo: STAFF.has(stato.ruolo) ? TESTO_STAFF_RESTA_IL_NOME : TESTI_ACCOUNT.conFirme };
}

/** Lo stato letto dal database, controllato nella forma: altrimenti `null`. */
export function leggiStatoCancellazione(dati: unknown): StatoCancellazione | null {
  if (!dati || typeof dati !== "object") return null;
  const d = dati as Record<string, unknown>;
  if (d.puo === true && typeof d.ruolo === "string") return { puo: true, ruolo: d.ruolo, resta_il_nome: d.resta_il_nome === true };
  if (d.puo === false && (d.motivo === "referente_senza_successore" || d.motivo === "ruolo_non_previsto" || d.motivo === "profilo_mancante")) {
    return {
      puo: false,
      motivo: d.motivo,
      ruolo: typeof d.ruolo === "string" ? d.ruolo : undefined,
      tutor_attivi: typeof d.tutor_attivi === "number" ? d.tutor_attivi : undefined,
    };
  }
  return null;
}

const FRASE = "L'account non è stato cancellato.";

/** Il rifiuto della cancellazione: dice la regola, «riprova» solo a un guasto. */
export function testoErroreCancellazione(errore: { code?: unknown; message?: unknown } | null, sessioneViva: boolean): string {
  const classe = classeErroreScrittura(errore, sessioneViva);
  if (classe === "sessione") return TESTO_SESSIONE_PERSA_SCRITTURA;
  if (classe === "guasto") return testoGuastoScrittura(FRASE);
  const motivo = messaggioErrore(errore).trim();
  if (motivo === "referente_senza_successore") return TESTO_REFERENTE_SENZA_SUCCESSORE;
  if (motivo === "ruolo_non_previsto") return TESTI_ACCOUNT.ente;
  if (motivo === "profilo_mancante") return TESTI_ACCOUNT.profiloMancante;
  return testoRifiutoSconosciutoScrittura(FRASE);
}

export const ETICHETTA_RUOLO_ACCOUNT: Record<string, string> = {
  studente: "Studente",
  docente: "Docente",
  referente_scuola: "Referente della scuola",
  tutor_scuola: "Tutor della scuola",
  istituzione: "Ente",
  admin: "Admin KIREO",
};

// --- La password, cambiata da dentro -------------------------------------
// Prima si poteva solo dal link di «Password dimenticata»: chi voleva
// cambiarla senza averla dimenticata doveva fingere di averla dimenticata.
// Si chiede quella attuale, perché l'account d'ente è condiviso di fatto da un
// ufficio e un computer lasciato aperto non deve bastare.
export const PASSWORD_MINIMA = 8;

export const TESTI_PASSWORD = {
  attualeMancante: "Scrivi la password che usi adesso.",
  troppoCorta: `La nuova password deve avere almeno ${PASSWORD_MINIMA} caratteri.`,
  diverse: "Le due password nuove non coincidono.",
  attualeSbagliata: "La password attuale non è giusta.",
  cambiata: "Password cambiata. La prossima volta che entri, usa quella nuova.",
} as const;

export function erroriPassword(attuale: string, nuova: string, conferma: string): string[] {
  const e: string[] = [];
  if (!attuale) e.push(TESTI_PASSWORD.attualeMancante);
  if (nuova.length < PASSWORD_MINIMA) e.push(TESTI_PASSWORD.troppoCorta);
  else if (nuova !== conferma) e.push(TESTI_PASSWORD.diverse);
  return e;
}

// --- Il passaggio della scuola --------------------------------------------
export function testoConfermaPassaggio(nome: string): string {
  return `Rendere ${nome} referente della scuola? Tu diventi tutor, senza deleghe: le decide il nuovo referente.`;
}
export const TESTI_PASSAGGIO = {
  fatto: "Fatto: la scuola ha un nuovo referente. Adesso puoi cancellare il tuo account, se vuoi.",
  nonReferente: "Solo il referente può passare la scuola: ricarica la pagina.",
  tutorNonValido: "Questa persona non è più un tutor attivo della scuola: ricarica la pagina.",
} as const;

export function testoErrorePassaggio(errore: { code?: unknown; message?: unknown } | null, sessioneViva: boolean): string {
  const classe = classeErroreScrittura(errore, sessioneViva);
  if (classe === "sessione") return TESTO_SESSIONE_PERSA_SCRITTURA;
  const frase = "La scuola non è passata.";
  if (classe === "guasto") return testoGuastoScrittura(frase);
  const motivo = messaggioErrore(errore).trim();
  if (motivo === "non_referente") return TESTI_PASSAGGIO.nonReferente;
  if (motivo === "tutor_non_valido") return TESTI_PASSAGGIO.tutorNonValido;
  return testoRifiutoSconosciutoScrittura(frase);
}
