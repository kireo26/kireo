// CHI PUÒ CONDIVIDERE IL PROFILO CON UN ENTE E SCRIVERGLI (28/10).
//
// Specchio di `puo_contattare_enti()` (20261109110000): uno studente con una
// data di nascita. Il database decide; questo serve alla pagina dell'ente per
// non mostrare un bottone che il database rifiuterebbe, e per dire a chi non
// ha una data come fare. L'età minima (14 anni) non si ricontrolla: la tiene
// `profiles_eta_minima`, quindi una data che c'è è una data accettata.
//
// ⚠️ Prima del 28/10 questo lo faceva per caso il cancello dei 18 anni, che
// trattava una data assente come «minorenne»: tolta l'età, docenti, account
// d'ente e studenti senza data potevano «condividere il profilo». La regola
// adesso è scritta, e non dipende più da un'altra.
export type ContattoEnti = "si" | "manca_data" | "non_studente";

export function contattoEnti(ruolo: string | null | undefined, dataNascita: string | null | undefined): ContattoEnti {
  if (ruolo !== "studente") return "non_studente";
  if (!dataNascita) return "manca_data";
  return "si";
}

// Il posto dove si aggiunge la data: /app la chiede prima di tutto il resto
// (`CompletaEtaForm`, montato da app/app/layout.tsx). Testi miei, provvisori.
export const HREF_AGGIUNGI_DATA = "/app";
// Una frase sola per i tre gesti, sotto la fila: per uno studente senza data
// mancano tutti e tre per la stessa ragione.
export const TESTO_MANCA_DATA_CONTATTO =
  "Per iscriverti alla newsletter di un ente, condividere il tuo profilo o scrivergli ci serve la tua data di nascita.";
// /disiscrizione: lì può arrivare anche chi non è uno studente (un sì dato da
// studente, il ruolo cambiato dopo), quindi niente link a /app.
export const TESTO_MANCA_DATA_COMUNICAZIONI =
  "Non conosciamo la tua data di nascita: quando la aggiungi nella tua area, qui potrai scegliere se ricevere le comunicazioni di KIREO.";
export const TESTO_AGGIUNGI_DATA = "Aggiungila";
