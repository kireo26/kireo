import { formattaData, formattaOra, stessoGiornoItaliano } from "./formato";

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

// Finestra della DOMANDA finale, specchio lato client di
// domanda_consegna_modificabile (20260929120000_finestra_domanda_consegna.sql):
// dall'approvazione dell'evento fino alla fine della diretta. Si chiude
// ESATTAMENTE dove si apre `consegnaAperta` — la stessa `fine` per entrambe, così
// le due finestre non possono divergere e una domanda non cambia mai sotto a chi
// sta già rispondendo.
//
// Lo `stato` dell'evento non entra qui, come non entra in `consegnaAperta`: lo
// guarda chi chiama (il pannello si monta solo sugli approvati). Questo specchio
// risponde alla sola metà che dipende dall'orologio.
export function domandaModificabile(dataInizio: string, dataFine: string | null, ora: Date = new Date()): boolean {
  const inizio = new Date(dataInizio).getTime();
  const fine = dataFine ? new Date(dataFine).getTime() : inizio + DURATA_DEFAULT_MS;
  return ora.getTime() < fine;
}

// Quando la diretta finisce: è l'istante che chiude la finestra della domanda e
// apre quella della consegna. Esportato perché è un ORARIO CHE SI DICE A UNA
// PERSONA («la diretta è finita il … alle …»), e un orario detto a qualcuno è una
// cosa che si prova, non che si ricalcola in tre posti.
export function fineDiretta(dataInizio: string, dataFine: string | null): string {
  if (dataFine) return dataFine;
  return new Date(new Date(dataInizio).getTime() + DURATA_DEFAULT_MS).toISOString();
}

// LA DIRETTA STA ANDANDO, specchio lato client di `evento_in_diretta`
// (20261004130000_presenza_dentro_la_diretta.sql). È una funzione a sé e non un
// ramo di `statoDiretta` per la ragione che l'ha resa necessaria: `statoDiretta`
// dice `in_corso` da quindici minuti prima dell'inizio — ed è giusto, perché chi
// arriva prima deve vedere il player comparire da sé — ma la presenza non si
// conta lì. Il 4/10 quattro ping raccolti tutti nel pre-roll hanno certificato
// una presenza a una diretta di cinque minuti che lo studente non ha visto: il
// numeratore stava su venti minuti, il denominatore su cinque.
//
// Quindi: `statoDiretta` risponde a COSA MOSTRARE, questa a COSA CONTARE. Sono
// due domande, e tenerle nella stessa funzione è il modo in cui sono tornate a
// essere una.
export function presenzaRilevabile(dataInizio: string, dataFine: string | null, ora: Date = new Date()): boolean {
  const inizio = new Date(dataInizio).getTime();
  const fine = dataFine ? new Date(dataFine).getTime() : inizio + DURATA_DEFAULT_MS;
  const now = ora.getTime();
  return now >= inizio && now < fine;
}

// L'ATTESA HA UN ORARIO, non un «fra poco». La riga del pannello diceva «Sta
// per iniziare» in tutti e quindici i minuti del pre-roll: chi arriva alle 19:01
// per una diretta delle 19:15 legge una frase che promette «adesso» e aspetta
// quattordici minuti davanti a un riquadro, senza sapere se è in anticipo lui o
// in ritardo l'ente. Un'attesa con un orario è un'attesa; un'attesa senza è un
// dubbio.
//
// L'ORA E NON LA DATA, tranne quando il giorno è diverso: il pre-roll dura un
// quarto d'ora, quindi l'inizio è quasi sempre oggi — ma una diretta che
// comincia alle 00:05, guardata alle 23:52, è domani, e «Comincia alle 00:05»
// lì farebbe credere a un orario già passato.
//
// È UN VALORE e non tre rami dentro il JSX, per la ragione di casa: una frase
// composta in un `.tsx` non si può provare da uno script Node, e una proprietà
// dichiarata e non provata è un test che non c'è ancora.
export function testoAttesaDiretta(dataInizio: string, ora: Date = new Date()): string {
  const quando = stessoGiornoItaliano(dataInizio, ora)
    ? `alle ${formattaOra(dataInizio)}`
    : `il ${formattaData(dataInizio, "long")} alle ${formattaOra(dataInizio)}`;
  return `Comincia ${quando}`;
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
