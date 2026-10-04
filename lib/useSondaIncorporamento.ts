"use client";

import { useEffect, useState } from "react";
import { caricaApiYoutube, HOST_NOCOOKIE, type PlayerYoutube } from "./youtubeIframeApi";
import { type EsitoSonda, MS_ATTESA_SONDA, esitoDaCodiceErrore } from "./sondaYoutube";

// Quanto si aspetta dopo l'ultimo tasto prima di provare il video: senza,
// una digitazione a mano creerebbe e distruggerebbe un player per carattere.
const MS_ATTESA_DIGITAZIONE = 400;

// Dopo `onReady` si concede un momento prima di dichiarare `attivo`: per un
// video con l'incorporamento bloccato il player può dirsi pronto e poi
// sollevare l'errore. Un «attivo» dichiarato troppo presto sarebbe la
// risposta comoda — quella che nessuno torna a ricontrollare.
const MS_GRAZIA_DOPO_READY = 1500;

// LA SONDA NASCOSTA, quella che gira nel pannello dell'ente e in quello
// dell'admin: costruisce un player di un pixel fuori campo, ascolta
// `onError`, e non riproduce niente. Serve a sapere GIORNI PRIMA quello che
// oggi si scopre alle 17:01, con una classe davanti.
//
// Non torna mai un esito inventato: finché non c'è una risposta l'esito è
// `null` (sonda mai partita) oppure `non_controllato` (partita e muta), che
// sono due cose diverse da «va bene».
export function useSondaIncorporamento(videoId: string | null): { esito: EsitoSonda | null; inCorso: boolean } {
  // LA RISPOSTA PORTA CON SÉ L'ID A CUI SI RIFERISCE, e l'esito si DERIVA
  // invece di azzerarlo quando il link cambia. Non è una rifinitura: con un
  // azzeramento, fra il cambio del link e il reset ci sarebbe un istante in
  // cui a schermo c'è il verdetto del video PRECEDENTE — cioè una risposta
  // sbagliata, che è molto peggio di nessuna risposta. Così non può
  // succedere per costruzione, e sparisce anche il setState sincrono
  // nell'effetto.
  const [risposta, setRisposta] = useState<{ id: string; esito: EsitoSonda } | null>(null);

  useEffect(() => {
    if (!videoId) return;
    // Catturato dopo la guardia: dentro `concludi` il tipo di `videoId` non
    // si restringe da sé, e un `!` qui sarebbe un'asserzione al posto di un
    // fatto.
    const id = videoId;

    let vivo = true;
    let player: PlayerYoutube | null = null;
    let contenitore: HTMLDivElement | null = null;
    let risposto = false;
    const timer: ReturnType<typeof setTimeout>[] = [];

    function concludi(nuovo: EsitoSonda) {
      if (!vivo || risposto) return;
      risposto = true;
      setRisposta({ id, esito: nuovo });
    }

    timer.push(
      setTimeout(() => {
        if (!vivo) return;
        timer.push(setTimeout(() => concludi("non_controllato"), MS_ATTESA_SONDA));

        caricaApiYoutube()
          .then((api) => {
            if (!vivo || risposto) return;
            contenitore = document.createElement("div");
            contenitore.setAttribute("aria-hidden", "true");
            contenitore.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0";
            document.body.appendChild(contenitore);
            player = new api.Player(contenitore, {
              videoId: id,
              host: HOST_NOCOOKIE,
              width: "1",
              height: "1",
              events: {
                onError: (e) => concludi(esitoDaCodiceErrore(e.data)),
                onReady: () => {
                  timer.push(setTimeout(() => concludi("attivo"), MS_GRAZIA_DOPO_READY));
                },
              },
            });
          })
          .catch(() => concludi("non_controllato"));
      }, MS_ATTESA_DIGITAZIONE),
    );

    return () => {
      vivo = false;
      for (const t of timer) clearTimeout(t);
      try {
        player?.destroy();
      } catch {
        // Un player già smontato dall'API lancia: non è un guasto da riportare.
      }
      contenitore?.remove();
    };
  }, [videoId]);

  // `inCorso` è vero quando c'è un id da provare e non c'è ancora una
  // risposta PER QUELL'ID: comprende anche l'attesa della digitazione, ed è
  // onesto — da quel momento la sonda sta per partire e non sappiamo ancora
  // niente.
  const esito = risposta !== null && risposta.id === videoId ? risposta.esito : null;
  return { esito, inCorso: videoId !== null && esito === null };
}
