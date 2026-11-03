// La pagina dell'account (02/11): cosa legge chi sta per cancellarsi, e cosa
// legge se il database dice no. La regola NON sta qui: sta in
// `stato_cancellazione_account` (20261202100000), che la pagina legge prima e
// `delete_own_account` riapplica dopo. Qui ci sono solo le parole.
//
// Testi di Mario: `TESTO_REFERENTE_SENZA_SUCCESSORE` (01/11) e
// `TESTO_NON_RESTA_NIENTE` (03/11). Gli altri sono miei e provvisori.
//
// ⚠️ Prima del clic si dice il NUMERO, non una frase (Mario, 03/11): il testo
// fisso di prima («Le presenze che hai certificato restano») il 02/11 l'ha letto
// una referente che aveva firmato dieci verifiche, e niente presenze. Il numero
// lo conta il database, le parole stanno in `lib/account/firme.ts`.
//
// ⚠️ Al referente senza successore il bottone NON c'è, non è spento: *un
// bottone spento con una spiegazione accanto invita a premerlo e poi dice di
// no* (Mario). Lo stesso per l'ente e per l'admin.

import { descriviFirme, totaleFirme, type Firma } from "@/lib/account/firme";
import {
  classeErroreScrittura,
  messaggioErrore,
  TESTO_SESSIONE_PERSA_SCRITTURA,
  testoGuastoScrittura,
  testoRifiutoSconosciutoScrittura,
} from "@/lib/rifiutiScrittura";

/** I tre esiti, decisi dal database (`stato_cancellazione_account`, 20261204110000). */
export type EsitoCancellazione = "cancellato" | "cancellato_resta_il_nome" | "anonimizzato";

export type StatoCancellazione =
  | { puo: true; ruolo: string; resta_il_nome: boolean; firme: Firma[]; esito: EsitoCancellazione }
  | { puo: false; ruolo?: string; motivo: "referente_senza_successore" | "ruolo_non_previsto" | "profilo_mancante"; tutor_attivi?: number };

export const TESTO_NON_RESTA_NIENTE =
  "Non resterà nulla di te: il profilo sparisce per intero e questo indirizzo tornerà libero.";

/** Chi lascia firme: quali, quante, e che l'indirizzo non torna libero. */
export function testoRestaIlNome(firme: Firma[], email: string, ruolo?: string): string {
  const base = `Il tuo account sparisce, ma il tuo nome resterà su ${descriviFirme(firme)}. L'indirizzo ${email} non potrà più essere usato per registrarsi.`;
  // Uno studente o un docente con una firma è raro, ma le sue attività
  // restano come quelle di tutti, e qui con il nome: lo si dice.
  if (ruolo === "studente" || ruolo === "docente") return `${base} ${TESTO_ATTIVITA_CON_IL_NOME}`;
  return base;
}

// CONSERVARE TUTTO, TOGLIERE IL NOME (Mario, 03/11): prima del clic si dicono
// tre cose — le attività restano per sempre senza il nome; quello che ha
// scritto viene cancellato; le ore certificate restano con il suo nome. Il
// numero delle firme qui non c'è: chi diventa anonimo non ne ha.
const TESTO_ATTIVITA_CON_IL_NOME =
  "Le attività che hai fatto restano con il tuo nome; quello che hai scritto viene cancellato.";

export function testoAnonimo(ruolo: string, email: string): string {
  if (ruolo === "docente") {
    return `Il tuo account sparisce, e il tuo nome esce da KIREO. Restano per sempre, senza il tuo nome, i webinar a cui hai partecipato. Quello che hai scritto viene cancellato: le domande che hai fatto durante le dirette. Gli attestati restano con il tuo nome: sono il documento della tua formazione. L'indirizzo ${email} tornerà libero.`;
  }
  return `Il tuo account sparisce, e il tuo nome esce da KIREO. Restano per sempre, senza il tuo nome, le attività che hai fatto: test, missioni, workshop, eventi. Quello che hai scritto viene cancellato: le risposte aperte, il diario, le domande e i messaggi. Le ore che ti sono state certificate restano con il tuo nome: sono il documento con cui la scuola le riconosce. L'indirizzo ${email} tornerà libero.`;
}

export const TESTO_REFERENTE_SENZA_SUCCESSORE =
  "Prima di andartene devi passare la scuola a qualcun altro: promuovi un tutor a referente, oppure invitane uno.";

export const TESTI_ACCOUNT = {
  ente: "L'account di un ente non si chiude da qui: scrivici da Contatti, e decidiamo insieme cosa succede alla pagina dell'ente.",
  admin: "L'account di un admin non si chiude da qui.",
  profiloMancante: "Questo account risulta già cancellato.",
  nonLetto:
    "Non siamo riusciti a contare cosa resterebbe di te dopo la cancellazione, quindi per ora non si procede: ricarica la pagina.",
  statoCambiato:
    "Nel frattempo è cambiato quello che resterebbe di te dopo la cancellazione: l'account non è stato cancellato. Ricarica la pagina e rileggi prima di decidere.",
  domanda: "Vuoi davvero cancellare l'account? Non si torna indietro.",
  esportaNonDisponibile:
    "Per il tuo ruolo «Scarica i miei dati» non c'è ancora. Se ti serve una copia dei tuoi dati, scrivici da Contatti.",
} as const;

export type PresentazioneCancellazione =
  | { bottone: true; testo: string }
  | { bottone: false; testo: string; linkStaff: boolean };

/** Cosa dice la sezione, e se il bottone c'è. `null` = non letto, e non si procede. */
export function presentaCancellazione(stato: StatoCancellazione | null, email: string): PresentazioneCancellazione {
  if (stato === null) return { bottone: false, testo: TESTI_ACCOUNT.nonLetto, linkStaff: false };
  if (!stato.puo) {
    if (stato.motivo === "referente_senza_successore") return { bottone: false, testo: TESTO_REFERENTE_SENZA_SUCCESSORE, linkStaff: true };
    if (stato.motivo === "profilo_mancante") return { bottone: false, testo: TESTI_ACCOUNT.profiloMancante, linkStaff: false };
    return { bottone: false, testo: stato.ruolo === "admin" ? TESTI_ACCOUNT.admin : TESTI_ACCOUNT.ente, linkStaff: false };
  }
  if (stato.esito === "anonimizzato") return { bottone: true, testo: testoAnonimo(stato.ruolo, email) };
  if (stato.esito === "cancellato") return { bottone: true, testo: TESTO_NON_RESTA_NIENTE };
  return { bottone: true, testo: testoRestaIlNome(stato.firme, email, stato.ruolo) };
}

/** Dopo il clic: cosa è successo davvero, dall'esito che il database restituisce. */
export function testoDopoLaCancellazione(esito: unknown, email: string): string {
  if (esito === "cancellato") return `Account cancellato. Non è rimasto niente di te, e l'indirizzo ${email} è di nuovo libero.`;
  if (esito === "anonimizzato")
    return `Account cancellato. Il tuo nome non c'è più: le attività restano senza nome, e quello che hai scritto è stato cancellato. L'indirizzo ${email} è di nuovo libero.`;
  if (esito === "cancellato_resta_il_nome")
    return `Account cancellato. Il tuo nome resta sulle firme che hai lasciato, e l'indirizzo ${email} non potrà più essere usato per registrarsi.`;
  return "Account cancellato.";
}

function leggiFirme(v: unknown): Firma[] | null {
  if (!Array.isArray(v)) return null;
  const firme: Firma[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") return null;
    const f = x as Record<string, unknown>;
    if (typeof f.tabella !== "string" || typeof f.colonna !== "string" || typeof f.n !== "number" || !Number.isInteger(f.n) || f.n < 0) return null;
    firme.push({ tabella: f.tabella, colonna: f.colonna, n: f.n });
  }
  return firme;
}

/**
 * Lo stato letto dal database, controllato nella forma: altrimenti `null`.
 * ⚠️ Senza le firme contate non si legge niente: il sostituto plausibile di un
 * conteggio mancato è «non resterà niente», cioè una bugia che non si ritira.
 */
export function leggiStatoCancellazione(dati: unknown): StatoCancellazione | null {
  if (!dati || typeof dati !== "object") return null;
  const d = dati as Record<string, unknown>;
  if (d.puo === true && typeof d.ruolo === "string") {
    const firme = leggiFirme(d.firme);
    if (firme === null || firme.length === 0 || typeof d.resta_il_nome !== "boolean") return null;
    if (d.resta_il_nome !== totaleFirme(firme) > 0) return null;
    // L'esito deve dire la stessa cosa del conteggio: una lapide se ci sono
    // firme, e altrimenti uno dei due. Uno che contraddice non si legge.
    const esito = d.esito;
    if (esito !== "cancellato" && esito !== "cancellato_resta_il_nome" && esito !== "anonimizzato") return null;
    if ((esito === "cancellato_resta_il_nome") !== d.resta_il_nome) return null;
    return { puo: true, ruolo: d.ruolo, resta_il_nome: d.resta_il_nome, firme, esito };
  }
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
  if (motivo === "stato_cambiato") return TESTI_ACCOUNT.statoCambiato;
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
