// LE PAROLE DEGLI STATI, IN UN REGISTRO SOLO (Mario, 03/11).
//
// Il caso: la pagina di un ente nell'admin stampava «approvato», «inviata»,
// «in_approvazione» così come stanno nel database. Il terzo si vede subito; i
// primi due no, perché un valore grezzo che somiglia a una parola italiana
// nasconde il difetto. *Di quattordici righe, tredici sembravano a posto.* La
// cura non è tradurre due parole: è che nessuno possa più dichiarare verde una
// pagina guardandola.
//
// Quindi: ogni colonna di stato del database o ha le sue parole qui, o sta in
// `STATI_SENZA_PAROLE` con il perché. `npm run test:stati` confronta il
// registro con i valori veri (dalle migrazioni per i tipi, e sulla replica per
// tutto), e vieta che un testo prenda uno stato senza passare da una parola
// (`${…stato}`, `{x.stato}`, `?? x.stato`). Uno stato nuovo nasce rosso.
//
// Due difetti diversi, e il registro copre il primo: una parola che non è MAI
// stata cercata. `parolaDiStato` (lib/statoNonRiconosciuto.ts) copre il
// secondo: una parola cercata che a runtime manca.
//
// I testi nuovi sono miei e provvisori: le parole delle scuole, «Bozza» della
// coda dell'admin.

import { parolaDiStato } from "@/lib/statoNonRiconosciuto";
import { PAROLE_STATO_CONVERSAZIONE } from "@/lib/messaggi/statoConversazione";
import { PAROLE_STATO_EVENTO } from "@/lib/ente/eventiEnte";
import { ETICHETTA_STATO_POST } from "@/lib/ente/post";
import { ETICHETTA_STATO_NEWSLETTER } from "@/lib/newsletter/regole";
import { ETICHETTA_STATO_ENTE, ETICHETTA_STATO_RICHIESTA_UPGRADE } from "@/lib/admin/enti";
import { STATO_DOMANDA_CSV } from "@/lib/eventi/exportPresenze";

type Parole = Readonly<Record<string, string>>;

export const PAROLE_STATO_SCUOLA: Parole = {
  richiesta: "Richiesta, in attesa",
  convenzionata: "Convenzione firmata",
  attiva: "Attiva",
  sospesa: "Sospesa",
};

export const PAROLE_STATO_PROPOSTA: Parole = {
  inviata: "In attesa di risposta",
  accettata: "Accettata",
  rifiutata: "Rifiutata",
  ritirata: "Ritirata",
};

export const PAROLE_STATO_DOMANDA_LIVE: Parole = {
  nuova: "In attesa",
  letta: "Letta dall'organizzatore",
  risposta_live: "Risposta in diretta",
};

export const PAROLE_STATO_TAPPA: Parole = {
  bloccata: "Bloccata",
  aperta: "In corso",
  consegnata: "In revisione",
  revisionata: "Revisionata",
};

export const PAROLE_STATO_NEWSLETTER_ADMIN: Parole = {
  bozza: "Bozza",
  in_approvazione: "Da approvare",
  approvata: "Approvata",
  inviata: "Partita",
  rifiutata: "Rifiutata",
};

const etichette = (m: Record<string, { label: string }>): Parole =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.label]));

/**
 * Per ogni colonna, il tipo (se è un enum: la guardia ne legge i valori dalle
 * migrazioni) e le tabelle di parole che la mostrano. Ogni tabella copre TUTTI
 * i valori: una che ne copre una parte è una frase muta che aspetta il valore
 * mancante.
 */
export const PAROLE_DEGLI_STATI: Record<string, { tipo: string | null; parole: Record<string, Parole> }> = {
  "conversazioni_enti.stato": { tipo: "conversazione_ente_stato", parole: { ...PAROLE_STATO_CONVERSAZIONE } },
  "eventi.stato": { tipo: "evento_stato", parole: { tutti: PAROLE_STATO_EVENTO } },
  "post_enti.stato": { tipo: "post_ente_stato", parole: { tutti: etichette(ETICHETTA_STATO_POST) } },
  "newsletter_enti.stato": { tipo: null, parole: { ente: ETICHETTA_STATO_NEWSLETTER, admin: PAROLE_STATO_NEWSLETTER_ADMIN } },
  "istituzioni.stato": { tipo: "istituzione_stato", parole: { tutti: ETICHETTA_STATO_ENTE } },
  "scuole_profili.stato": { tipo: "scuola_profilo_stato", parole: { tutti: PAROLE_STATO_SCUOLA } },
  "richieste_upgrade.stato": { tipo: "richiesta_upgrade_stato", parole: { tutti: ETICHETTA_STATO_RICHIESTA_UPGRADE } },
  "proposte_incontro.stato": { tipo: "proposta_incontro_stato", parole: { tutti: PAROLE_STATO_PROPOSTA } },
  "domande_live.stato": { tipo: null, parole: { schermo: PAROLE_STATO_DOMANDA_LIVE, csv: STATO_DOMANDA_CSV } },
  "workshop_fasi_stato.stato": { tipo: null, parole: { tutti: PAROLE_STATO_TAPPA } },
};

/**
 * Le colonne di stato che nessuna schermata mostra come una parola, con il
 * perché [cercato il 03/11]. Il giorno in cui una pagina ne mostra una, va
 * spostata sopra: la guardia lessicale prende la forma, se nasce.
 */
export const STATI_SENZA_PAROLE: Record<string, string> = {
  "comunicazioni.stato": "tabella chiusa al client dal 30/10, nessuna schermata la legge",
  "conventions.stato": "nessun codice la legge",
  "iscrizioni_eventi.stato": "diventa una frase (lo storico, l'esito del CSV), non una parola: testoEsitoStorico ed esitoPresenzaPerExport",
  "istituzioni_aree.stato": "decide un ramo (approvata, tolta), e la pagina scrive una frase sua",
  "mission_attempt.stato": "decide un ramo (in corso o completata), mai mostrato",
  "test_attempt.stato": "decide un ramo (in corso o completata), mai mostrato",
  "workshop_iscrizioni.stato": "decide quale iscrizione si apre (iscrizioneCorrente), mai mostrato",
  "workshop_consegne.stato": "nessuna schermata lo mostra",
  "workshop_elaborati.stato": "decide un ramo (bozza o consegnato), mai mostrato",
  "newsletter_consegne.stato": "diventa un numero (testoEsitoNewsletter), mai una parola",
  "student_profiles.stato_verifica": "decide un ramo e una frase nel profilo e nella scuola, mai stampato",
};

/** La parola di uno stato di una colonna registrata; senza parola, lo dice. */
export function parolaDelloStato(colonna: keyof typeof PAROLE_DEGLI_STATI, valore: string | null | undefined, chi = "tutti"): string {
  const voce = PAROLE_DEGLI_STATI[colonna];
  return parolaDiStato(voce?.parole[chi] ?? {}, valore);
}
