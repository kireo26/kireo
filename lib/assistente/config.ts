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

// Gate di sblocco dell'assistente basato sullo stato di avanzamento del
// percorso (lib/percorso/stato.ts), sullo stesso modello di GATE_GUIDE_ATTIVO
// in lib/guide/config.ts. Fase di test: false → NON collegato a nulla (né alla
// pagina dell'assistente, né ad AREE_ATTIVE, né alla dashboard): oggi l'unico
// interruttore che decide se un'area ha l'assistente resta AREE_ATTIVE. Quando
// il gate verrà attivato, lo sblocco combinerà questa costante con le
// condizioni di statoAvanzamento(). Deliberatamente inerte finché non lo si
// collega di proposito.
export const GATE_ASSISTENTE_ATTIVO = false;
