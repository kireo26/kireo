import { fineEffettiva } from "@/lib/live";

// RIVEDERE UNA DIRETTA (Mario, 31/10). Una regola sola per la card, la sezione
// dell'area e la pagina: un evento si riapre se è un webinar finito e la sonda
// del server ha visto la sua registrazione partire (`registrazione_esito =
// 'disponibile'`, lib/eventi/sondaRegistrazione.ts). L'id del video da solo non
// basta: è un indirizzo, non una registrazione.
//
// ⚠️ RIVEDERE NON È ESSERCI: niente presenza, niente ore, mai. La pagina che si
// apre di qui non manda battiti, e lo schermo lo dice accanto al bottone.

export type EventoRivedibile = {
  tipo: string;
  data_inizio: string;
  data_fine: string | null;
  diretta_chiusa_il: string | null;
  youtube_video_id: string | null;
  registrazione_esito?: string | null;
};

export function registrazioneRivedibile(e: EventoRivedibile, adesso: Date = new Date()): boolean {
  if (e.tipo !== "webinar" || !e.youtube_video_id || e.registrazione_esito !== "disponibile") return false;
  return new Date(fineEffettiva(e.data_inizio, e.data_fine, e.diretta_chiusa_il)).getTime() <= adesso.getTime();
}

export function hrefRivedi(eventoId: string): string {
  return `/eventi/${eventoId}/rivedi`;
}

// La riga accanto al bottone è di Mario; il resto è mio e provvisorio.
export const TESTI_RIVEDI = {
  bottone: "Rivedi la registrazione",
  nonConta: "Rivedere la registrazione non conta come partecipazione.",
  sezioneEyebrow: "Già trasmessi",
  sezioneTitolo: "Le dirette che puoi rivedere",
  nonDisponibile: "La registrazione di questo incontro non è disponibile.",
  tornaEnte: "Vai alla pagina dell'ente",
} as const;

// Quante dirette già trasmesse mostra la pagina di un'area: le più recenti.
export const RIVEDIBILI_AREA_MASSIMO = 6;

// LA SEZIONE DEGLI EVENTI DI UN'AREA SENZA EVENTI IN PROGRAMMA (Mario, 31/10).
// Prima diceva «I prossimi eventi arrivano a settembre», e il 31 ottobre: una
// frase che sapeva una cosa che nessuno le aveva detto, e mentiva da sola senza
// rompersi. Questa dice solo quello che è vero adesso, dalla pagina stessa.
// ⚠️ NIENTE DATE PROMESSE, MAI: nessuno sa quando un ente di quell'area
// organizzerà qualcosa, e una pagina che promette settembre a un ragazzo di
// quinta gli sta dicendo di tornare dopo il diploma. I due testi sono di Mario.
export function testoNessunEventoInProgramma(ciSonoGiaTrasmessi: boolean): string {
  return ciSonoGiaTrasmessi
    ? "Non ci sono eventi in programma in quest'area. Qui sotto trovi quelli già trasmessi."
    : "Non ci sono ancora eventi in quest'area.";
}
