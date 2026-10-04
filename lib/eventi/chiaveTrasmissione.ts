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

import { fineDiretta } from "@/lib/live";
import { formattaDataOra } from "@/lib/formato";

export type StatoChiave = "non_preparata" | "pronta" | "mai_arrivata";

export function statoChiaveTrasmissione(opts: {
  haChiave: boolean;
  dataInizio: string;
  dataFine: string | null;
  ora?: Date;
}): StatoChiave {
  if (opts.haChiave) return "pronta";
  const ora = opts.ora ?? new Date();
  const fine = new Date(fineDiretta(opts.dataInizio, opts.dataFine)).getTime();
  // La diretta è passata e la chiave non è mai arrivata: un fallimento
  // nostro, e dirlo è l'unica cosa che resta da fare. Senza questo ramo
  // l'ente leggerebbe per sempre «non è ancora stata preparata» su un evento
  // che non si può più trasmettere — la stessa frase per un'attesa e per una
  // cosa che non succederà mai.
  if (Number.isFinite(fine) && ora.getTime() >= fine) return "mai_arrivata";
  return "non_preparata";
}

export type TestoChiave = { titolo: string; dettaglio: string; tono: "ok" | "attesa" | "errore" };

export function testoChiaveTrasmissione(stato: StatoChiave, aggiornataIl: string | null): TestoChiave {
  if (stato === "pronta") {
    return {
      titolo: "La chiave di trasmissione è pronta.",
      dettaglio: aggiornataIl
        ? `Preparata il ${formattaDataOra(aggiornataIl, "long")}. Copiala in YouTube Studio quando imposti la diretta: questa è l'unica valida, se te ne arriva un'altra sostituisce questa.`
        : "Copiala in YouTube Studio quando imposti la diretta.",
      tono: "ok",
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
