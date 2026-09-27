"use client";

import { useEffect } from "react";

// Heartbeat ogni 60s verso /api/live/ping mentre la diretta è in corso e la
// scheda è visibile (Page Visibility API): un ping saltato non è un errore
// da mostrare, il prossimo tentativo tra 60s lo recupera — la certificazione
// finale è comunque tollerante (soglia 75%, non 100%).

// ⚠️ QUELLO CHE UN PING PRODUCE, E QUELLO CHE NON PRODUCE. Produce ore PCTO e un
// certificato di partecipazione (chiudi_diretta_evento, soglia 75%). NON produce
// una prova d'area — niente `evidence`, niente `area_signal` — e la scelta è
// deliberata, non un lavoro lasciato a metà.
//
// IL NUMERO CHE LA DECIDE: un'area entra nella classifica delle affinità a
// `confidence >= 0,40`, e `confidence = least(1, Σpeso / 10)`, quindi la barra è
// Σpeso >= 4. Se una presenza valesse ~1,0 come una consegna, QUATTRO DIRETTE
// basterebbero a creare un'affinità — e una presenza è, alla lettera, aver tenuto
// una scheda aperta e visibile: questo file non sa nemmeno se il video sta
// andando. Un'affermazione su una persona che nessuna sua scelta sostiene.
//
// Quello che dalla diretta lascia un segno nel profilo è la CONSEGNA (la risposta
// alla domanda posta in diretta): lib/eventi/consegna.ts, e la ragione per esteso
// in testa a supabase/migrations/20260927120000_consegna_evento.sql.
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
