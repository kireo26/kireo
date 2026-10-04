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
// youtube.com non devono lasciare uno studente senza video. In quel ramo non
// si dichiara niente — nessun errore, quindi la presenza continua a contare,
// che è la direzione giusta dove non sappiamo.
export default function PlayerDiretta({
  videoId,
  titolo,
  onErrore,
}: {
  videoId: string;
  titolo: string;
  onErrore: (esito: EsitoSonda) => void;
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
  useEffect(() => {
    onErroreRef.current = onErrore;
  }, [onErrore]);
  const [ripiego, setRipiego] = useState(false);

  useEffect(() => {
    const contenitore = contenitoreRef.current;
    if (!contenitore || ripiego) return;

    let vivo = true;
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
          events: {
            onError: (e) => {
              if (vivo) onErroreRef.current(esitoDaCodiceErrore(e.data));
            },
          },
        });
      })
      .catch(() => {
        if (vivo) setRipiego(true);
      });

    return () => {
      vivo = false;
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
        src={`${HOST_NOCOOKIE}/embed/${videoId}`}
        title={titolo}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return <div ref={contenitoreRef} className="h-full w-full" />;
}
