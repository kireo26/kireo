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

// Finestra della CONSEGNA, specchio lato client di consegna_evento_aperta
// (20260927120000_consegna_evento.sql): dalla fine della diretta a
// ORE_FINESTRA_CONSEGNA ore dopo. Stesso patto dello specchio sopra — serve solo
// a decidere cosa mostrare, l'autorizzazione vera è il `with check` della policy
// di insert su consegne_evento, che chiama `puo_consegnare_evento`.
//
// ⚠️ LA PRESENZA NON PRODUCE UN SEGNALE D'AREA, ED È DELIBERATO. Sta scritto qui
// perché questo file è l'altro posto in cui uno verrebbe a «completare il
// lavoro»: c'è l'heartbeat, c'è la consegna che scrive prove, e in mezzo la
// presenza che non ne scrive. Il numero: un'area entra nelle affinità a
// confidence >= 0,40 (cioè Σpeso >= 4) E un interesse non nullo — se la
// presenza valesse ~1,0 su quella dimensione, quattro dirette basterebbero a
// creare un'affinità, e la
// presenza è aver tenuto una scheda aperta. (La dimensione va detta: la
// consegna pesa 1,0 e NON può creare un'affinità per nessun numero, perché
// emette solo `performance`.) La ragione per esteso sta in testa a
// supabase/migrations/20260927120000_consegna_evento.sql.
export const ORE_FINESTRA_CONSEGNA = 48;

export function consegnaAperta(dataInizio: string, dataFine: string | null, ora: Date = new Date()): boolean {
  const inizio = new Date(dataInizio).getTime();
  const fine = dataFine ? new Date(dataFine).getTime() : inizio + DURATA_DEFAULT_MS;
  const now = ora.getTime();
  return now >= fine && now < fine + ORE_FINESTRA_CONSEGNA * 60 * 60 * 1000;
}

// Un evento è già cominciato. Serve a decidere se OFFRIRE l'iscrizione: una
// prenotazione per una cosa già iniziata non serve a niente e promette
// qualcosa. Sta qui, con l'ora iniettabile come le sorelle, per due ragioni —
// si prova con un istante fisso invece che con l'orologio della macchina, e in
// un componente non compare una chiamata impura dentro il render.
export function eventoCominciato(dataInizio: string, ora: Date = new Date()): boolean {
  return new Date(dataInizio).getTime() <= ora.getTime();
}

// Il link "Entra nella diretta" appare da 15 minuti prima dell'inizio fino
// alla chiusura, indipendentemente da youtube_video_id: se l'id manca
// ancora la pagina live mostra comunque uno stato onesto ("diretta in
// preparazione/non disponibile") invece di far sparire l'accesso.
export function finestraDirettaVisibile(dataInizio: string, dataFine: string | null, ora: Date = new Date()): boolean {
  const s = statoDiretta(dataInizio, dataFine, ora);
  return s === "non_ancora" ? new Date(dataInizio).getTime() - ora.getTime() <= QUINDICI_MINUTI_MS : s === "in_corso";
}
