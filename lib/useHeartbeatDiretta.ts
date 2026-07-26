"use client";

import { useEffect } from "react";

// Heartbeat ogni 60s verso /api/live/ping mentre la diretta è in corso e la
// scheda è visibile (Page Visibility API): un ping saltato non è un errore
// da mostrare, il prossimo tentativo tra 60s lo recupera — la certificazione
// finale è comunque tollerante (soglia 75%, non 100%).
export function useHeartbeatDiretta(eventoId: string, attivo: boolean) {
  useEffect(() => {
    if (!attivo) return;

    let annullato = false;

    async function ping() {
      if (document.visibilityState !== "visible" || annullato) return;
      try {
        await fetch("/api/live/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventoId }),
        });
      } catch {
        // silenzioso: vedi commento sopra.
      }
    }

    ping();
    const intervallo = setInterval(ping, 60000);

    return () => {
      annullato = true;
      clearInterval(intervallo);
    };
  }, [eventoId, attivo]);
}
