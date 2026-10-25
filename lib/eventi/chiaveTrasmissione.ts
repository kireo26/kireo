// I TRE MOMENTI DELLA CHIAVE, come li legge l'ente.
//
// Fino al 4/10 ce n'era uno solo, ed era una promessa: «riceverai la chiave
// di trasmissione da KIREO prima dell'evento». L'ente che non l'aveva ancora
// non sapeva se era in ritardo lui o noi — e dietro quella frase non c'era
// niente che gliela mandasse (vedi 20261004120000_chiave_trasmissione.sql).
//
// È la terza proprietà che di solito si dimentica: finché la cosa non c'è, il
// pannello deve dirlo. Come per la domanda finale, dove il buco adesso si
// vede.
//
// IL TESTO È UN VALORE e non tre rami dentro il JSX: una frase composta in un
// .tsx non si può provare da uno script Node, e una proprietà dichiarata e
// non provata è un test che non c'è ancora.
//
// ⚠️ I TESTI SONO DA RILEGGERE (voce). Questa è la stesura di servizio: la
// sostanza dei tre momenti è di Mario, le parole sono mie.

import { fineEffettiva } from "@/lib/live";
import { formattaDataOra } from "@/lib/formato";

// "incompleta": c'è una chiave e manca il server. Fino al 25/10 la tabella non
// aveva la colonna, quindi è il caso di ogni riga scritta prima di
// 20261027130000 — e una chiave senza server non trasmette: dirla «pronta»
// sarebbe il difetto di partenza con un'altra faccia.
export type StatoChiave = "non_preparata" | "incompleta" | "pronta" | "mai_arrivata";

export function statoChiaveTrasmissione(opts: {
  haChiave: boolean;
  haServer: boolean;
  dataInizio: string;
  dataFine: string | null;
  chiusaIl: string | null;
  ora?: Date;
}): StatoChiave {
  if (opts.haChiave && opts.haServer) return "pronta";
  const ora = opts.ora ?? new Date();
  const fine = new Date(fineEffettiva(opts.dataInizio, opts.dataFine, opts.chiusaIl)).getTime();
  // La diretta è passata e la chiave non è mai arrivata: un fallimento
  // nostro, e dirlo è l'unica cosa che resta da fare. Senza questo ramo
  // l'ente leggerebbe per sempre «non è ancora stata preparata» su un evento
  // che non si può più trasmettere — la stessa frase per un'attesa e per una
  // cosa che non succederà mai.
  if (Number.isFinite(fine) && ora.getTime() >= fine) return "mai_arrivata";
  return opts.haChiave ? "incompleta" : "non_preparata";
}

export type TestoChiave = { titolo: string; dettaglio: string; tono: "ok" | "attesa" | "errore" };

export function testoChiaveTrasmissione(stato: StatoChiave, aggiornataIl: string | null): TestoChiave {
  if (stato === "pronta") {
    // ⚠️ TESTO PROVVISORIO, e di proposito (Mario, 25/10). Fino a oggi diceva
    // «Copiala in YouTube Studio quando imposti la diretta»: falso — la chiave
    // di un altro canale in Studio non si incolla, va nel programma che
    // trasmette. Questa riga corregge solo il POSTO. Il testo finale aspetta una
    // decisione che non è di codice: a chi lo scriviamo? Un referente PCTO non
    // ha un programma di trasmissione, usa Zoom, Meet o Teams — quindi o
    // chiediamo all'ente quello sforzo, o KIREO trasmette per lui. Un testo
    // scritto per un utente che non sappiamo chi sia arriva vecchio.
    return {
      titolo: "La chiave di trasmissione è pronta.",
      dettaglio: aggiornataIl
        ? `Preparata il ${formattaDataOra(aggiornataIl, "long")}. Server e chiave vanno nel programma con cui trasmetti, non in YouTube Studio. Questa è l'unica valida: se te ne arriva un'altra, sostituisce questa.`
        : "Server e chiave vanno nel programma con cui trasmetti, non in YouTube Studio.",
      tono: "ok",
    };
  }
  if (stato === "incompleta") {
    return {
      titolo: "Manca ancora l'indirizzo del server.",
      dettaglio: "La chiave c'è, ma senza l'indirizzo a cui mandarla non si trasmette. Lo prepara KIREO e lo trovi qui: ti avvisiamo appena c'è. Se l'evento è vicino e qui non cambia niente, scrivici da contatti.",
      tono: "attesa",
    };
  }
  if (stato === "mai_arrivata") {
    return {
      titolo: "La chiave non è arrivata in tempo, e non è colpa tua.",
      dettaglio: "La diretta era ospitata da KIREO e la chiave non è stata preparata prima dell'orario. Scrivici da contatti: ricostruiamo cosa è andato storto.",
      tono: "errore",
    };
  }
  return {
    titolo: "La chiave di trasmissione non è ancora stata preparata.",
    dettaglio: "La prepara KIREO e la trovi qui: ti avvisiamo appena c'è, non devi chiederla. Se l'evento è vicino e qui non vedi niente, scrivici da contatti.",
    tono: "attesa",
  };
}
