// Motore riusabile per l'assistente digitale, area per area: attivare
// un'area nuova significa aggiungere il suo slug qui (il blocco di
// contenuti nel system prompt si genera da data/aree.ts, vedi prompt.ts) —
// zero codice nuovo, come richiesto dal compito.
export const AREE_ATTIVE: readonly string[] = ["informatica-digitale"];

export function isAreaAttiva(areaSlug: string): boolean {
  return AREE_ATTIVE.includes(areaSlug);
}

// Modello: Haiku, il più recente disponibile — costi contenuti per una
// chat di orientamento, non serve la profondità di Sonnet/Opus qui.
export const MODELLO_ASSISTENTE = "claude-haiku-4-5";

export const MAX_MESSAGGI_CONVERSAZIONE = 20;
export const MAX_CONVERSAZIONI_GIORNO = 3;
export const MAX_CARATTERI_MESSAGGIO = 2000;
