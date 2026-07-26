// Finestra della diretta, specchio lato client di evento_in_finestra_diretta
// (vedi supabase/migrations/20260726110000_diretta_presenze_domande.sql):
// da 15 minuti prima dell'inizio fino a data_fine (o, se assente, 3 ore
// dopo l'inizio). Solo per decidere COSA MOSTRARE (countdown/player/
// chiuso): l'unica autorizzazione reale resta lato DB (RLS + funzioni
// SECURITY DEFINER), qui è solo UX.
export type StatoDiretta = "non_ancora" | "in_corso" | "conclusa";

const QUINDICI_MINUTI_MS = 15 * 60 * 1000;
const DURATA_DEFAULT_MS = 3 * 60 * 60 * 1000;

export function statoDiretta(dataInizio: string, dataFine: string | null, ora: Date = new Date()): StatoDiretta {
  const inizio = new Date(dataInizio).getTime();
  const fine = dataFine ? new Date(dataFine).getTime() : inizio + DURATA_DEFAULT_MS;
  const now = ora.getTime();
  if (now < inizio - QUINDICI_MINUTI_MS) return "non_ancora";
  if (now < fine) return "in_corso";
  return "conclusa";
}

// Il link "Entra nella diretta" appare da 15 minuti prima dell'inizio fino
// alla chiusura, indipendentemente da youtube_video_id: se l'id manca
// ancora la pagina live mostra comunque uno stato onesto ("diretta in
// preparazione/non disponibile") invece di far sparire l'accesso.
export function finestraDirettaVisibile(dataInizio: string, dataFine: string | null, ora: Date = new Date()): boolean {
  const s = statoDiretta(dataInizio, dataFine, ora);
  return s === "non_ancora" ? new Date(dataInizio).getTime() - ora.getTime() <= QUINDICI_MINUTI_MS : s === "in_corso";
}
