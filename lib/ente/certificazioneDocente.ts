// Cosa legge chi certifica la partecipazione di un docente, quando il database
// dice no. Testi miei e provvisori.
//
// MISURATO, non dedotto (01/11, l'ultima definizione di
// `certifica_partecipazione_docente`, `20261026100000`): la funzione rifiuta in
// QUATTRO modi suoi, e ognuno ha la sua frase.
//   • `evento_non_trovato` — l'evento non esiste o non è un webinar per docenti;
//   • `non_autorizzato`    — chi preme non è l'admin né l'ente organizzatore,
//                            oppure sta certificando sé stesso;
//   • `non_iscritto`       — la persona ha annullato l'iscrizione nel frattempo;
//   • `account_cancellato` — la persona ha cancellato l'account (20261206100000).
// Fuori dalla funzione: senza sessione PostgREST chiama come `anon`, che non la
// esegue (42501), e un token scaduto dà PGRST3xx — tutte e due «sessione
// persa», che si riconosce chiedendo la sessione. Il resto è la rete o il
// server. Nessun vincolo dell'update può fallire: le ore non sono mai null
// (`ore_riconoscibili_evento` fa coalesce) e il tipo del certificatore è uno di
// quelli ammessi.
//
// Il giorno in cui la funzione impara un quarto `raise`, lo si aggiunge qui:
// `npm run test:parenti` confronta questo elenco con la funzione.

import {
  classeErroreScrittura,
  messaggioErrore,
  TESTO_SESSIONE_PERSA_SCRITTURA,
  testoGuastoScrittura,
  testoRifiutoSconosciutoScrittura,
} from "@/lib/rifiutiScrittura";

export const RIFIUTI_CERTIFICAZIONE_DOCENTE: Record<string, string> = {
  evento_non_trovato: "Questo incontro non risulta più fra i webinar per docenti su KIREO: ricarica la pagina.",
  non_autorizzato:
    "Questa partecipazione non la puoi certificare tu: la certifica chi ha organizzato l'incontro, e nessuno certifica la propria.",
  non_iscritto: "Questa persona ha annullato l'iscrizione nel frattempo: l'elenco qui sotto è aggiornato.",
  // 03/11 (20261206100000), testo mio e provvisorio.
  account_cancellato: "Questa persona ha cancellato il suo account: la sua partecipazione non si può più certificare.",
};

const FRASE = "La partecipazione non è stata certificata.";

export function testoErroreCertificazioneDocente(errore: { code?: unknown; message?: unknown } | null, sessioneViva: boolean): string {
  const classe = classeErroreScrittura(errore, sessioneViva);
  if (classe === "sessione") return TESTO_SESSIONE_PERSA_SCRITTURA;
  if (classe === "guasto") return testoGuastoScrittura(FRASE);
  const motivo = messaggioErrore(errore).trim();
  return RIFIUTI_CERTIFICAZIONE_DOCENTE[motivo] ?? testoRifiutoSconosciutoScrittura(FRASE);
}
