"use client";

import { useEffect, useRef, useState } from "react";
import { caricaApiYoutube, HOST_NOCOOKIE, type PlayerYoutube } from "@/lib/youtubeIframeApi";
import { type EsitoSonda, esitoDaCodiceErrore } from "@/lib/sondaYoutube";

// IL PLAYER DELLA DIRETTA, costruito con l'IFrame API invece che con un
// `iframe` grezzo per una ragione sola: un iframe non ci dice niente, e
// finché non ci diceva niente la pagina continuava a registrare presenze a
// chi stava guardando un riquadro nero.
//
// SE L'API NON SI CARICA SI TORNA ALL'IFRAME, che è quello che c'era fino al
// 4/10 e funziona: un bloccante di script o una rete che non arriva a
// youtube.com non devono lasciare uno studente senza video. ⚠️ Ma in quel ramo
// la presenza NON conta (dal 18/10, decisione di Mario): il video si vede, il
// suo avvio no, e la pagina lo dice.

// Dopo `onReady` si concede un momento prima di dire «si vede»: per un video
// con l'incorporamento bloccato il player può dirsi pronto e poi sollevare
// l'errore (stessa grazia della sonda, `useSondaIncorporamento`).
const MS_GRAZIA_DOPO_READY = 1500;

export default function PlayerDiretta({
  videoId,
  titolo,
  onErrore,
  onPronto,
  onAvvio,
  onRipiego,
  onFine,
}: {
  videoId: string;
  titolo: string;
  onErrore: (esito: EsitoSonda) => void;
  /** Il player si è caricato e per la grazia successiva non ha sollevato errori.
   *  Serve a dire che il video, riprovato, ADESSO si vede (18/10: l'incorporamento
   *  si spegne e si riaccende mentre la diretta è in onda). */
  onPronto?: () => void;
  /** Il video è partito (stato «in riproduzione») almeno una volta. Dal 18/10
   *  la presenza comincia da qui: prima non c'è niente da seguire. */
  onAvvio?: () => void;
  /** Lo script di YouTube non si è caricato e la pagina mostra il riquadro
   *  semplice: da qui non sappiamo se il video parte. */
  onRipiego?: () => void;
  /** Il video è finito (stato 0). Dal 25/10 la presenza finisce qui: dopo non
   *  c'è più niente a cui essere presenti. */
  onFine?: () => void;
}) {
  const contenitoreRef = useRef<HTMLDivElement>(null);
  // La callback in un ref: così l'effetto non dipende da lei e il player non
  // viene ricostruito se il genitore si ri-renderizza. L'aggiornamento sta in
  // un effetto e non nel corpo del render — scrivere su un ref durante il
  // render è la stessa famiglia della chiamata impura che il 28/09 ha morso
  // CardEvento. Questo effetto è dichiarato PRIMA di quello che costruisce il
  // player, così al primo giro il valore è già quello buono (e lo sarebbe
  // comunque, perché `useRef` parte dal primo `onErrore`).
  const onErroreRef = useRef(onErrore);
  const onProntoRef = useRef(onPronto);
  const onAvvioRef = useRef(onAvvio);
  const onRipiegoRef = useRef(onRipiego);
  const onFineRef = useRef(onFine);
  useEffect(() => {
    onErroreRef.current = onErrore;
    onProntoRef.current = onPronto;
    onAvvioRef.current = onAvvio;
    onRipiegoRef.current = onRipiego;
    onFineRef.current = onFine;
  }, [onErrore, onPronto, onAvvio, onRipiego, onFine]);
  const [ripiego, setRipiego] = useState(false);

  // NEL RIPIEGO NON SAPPIAMO SE IL VIDEO PARTE, e dal 18/10 NON SI DICHIARA
  // PARTITO (decisione di Mario: vedi `TESTO_RIPIEGO` in lib/live/presenza.ts
  // per il perché). `onAvvio` qui non si chiama mai: si avvisa il genitore che
  // siamo nel riquadro semplice, e lui lo dice allo studente e lo conta.
  useEffect(() => {
    if (ripiego) onRipiegoRef.current?.();
  }, [ripiego]);

  useEffect(() => {
    const contenitore = contenitoreRef.current;
    if (!contenitore || ripiego) return;

    let vivo = true;
    let errato = false;
    let grazia: ReturnType<typeof setTimeout> | null = null;
    let player: PlayerYoutube | null = null;
    // L'API SOSTITUISCE l'elemento che le si passa: le si dà un figlio usa e
    // getta, non il nodo che React possiede — altrimenti al prossimo render
    // React scriverebbe su un nodo che non è più nel documento.
    const bersaglio = document.createElement("div");
    bersaglio.className = "h-full w-full";
    contenitore.appendChild(bersaglio);

    caricaApiYoutube()
      .then((api) => {
        if (!vivo) return;
        player = new api.Player(bersaglio, {
          videoId,
          host: HOST_NOCOOKIE,
          width: "100%",
          height: "100%",
          // ⚠️ `rel: 0` (25/10): a fine video YouTube proponeva video di
          // terzi dentro la pagina di KIREO. Dal 2018 il parametro NON toglie
          // i suggeriti: li restringe al canale che ha pubblicato il video. È
          // il massimo che il player concede — la schermata finale resta.
          playerVars: { rel: 0 },
          events: {
            onError: (e) => {
              errato = true;
              if (vivo) onErroreRef.current(esitoDaCodiceErrore(e.data));
            },
            onStateChange: (e) => {
              if (vivo && e.data === 1) onAvvioRef.current?.();
              // ⚠️ Che una DIRETTA mandi lo stato 0 quando chi trasmette chiude
              // è documentato per l'IFrame API, non osservato a schermo da noi.
              if (vivo && e.data === 0) onFineRef.current?.();
            },
            onReady: () => {
              grazia = setTimeout(() => {
                if (vivo && !errato) onProntoRef.current?.();
              }, MS_GRAZIA_DOPO_READY);
            },
          },
        });
      })
      .catch(() => {
        if (vivo) setRipiego(true);
      });

    return () => {
      vivo = false;
      if (grazia) clearTimeout(grazia);
      try {
        player?.destroy();
      } catch {
        // Un player già smontato dall'API lancia: non è un guasto.
      }
      bersaglio.remove();
    };
  }, [videoId, ripiego]);

  if (ripiego) {
    return (
      <iframe
        src={`${HOST_NOCOOKIE}/embed/${videoId}?rel=0`}
        title={titolo}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return <div ref={contenitoreRef} className="h-full w-full" />;
}
