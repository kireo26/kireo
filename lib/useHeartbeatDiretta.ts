"use client";

import { useEffect, useState } from "react";
import { esitoBattito, type EsitoBattito } from "@/lib/live/presenza";

// Heartbeat ogni 60s verso /api/live/ping mentre la diretta è in corso e la
// scheda è visibile (Page Visibility API): un ping saltato non è un errore
// da mostrare, il prossimo tentativo tra 60s lo recupera — la certificazione
// finale è comunque tollerante (soglia 75%, non 100%).

// ⚠️ QUELLO CHE UN PING PRODUCE, E QUELLO CHE NON PRODUCE. Produce ore PCTO, un
// certificato di partecipazione e il credito di ESPLORAZIONE — una riga in
// `activity_log` per ogni area dell'evento, peso 15 o 25, che alimenta il radar
// (chiudi_diretta_evento, soglia 75%). NON produce una prova d'AFFINITÀ — niente
// `evidence`, niente `area_signal` — e la scelta è deliberata, non un lavoro
// lasciato a metà: è la stessa separazione che la home dichiara, «conta dove hai
// messo piede, non le tue attitudini».
//
// IL NUMERO CHE LA DECIDE: un'area entra nella classifica delle affinità a
// `confidence >= 0,40`, e `confidence = least(1, Σpeso / 10)`, quindi la barra è
// Σpeso >= 4 E un interesse non nullo. Se una presenza valesse ~1,0 SU QUELLA
// DIMENSIONE — non come una consegna, che emette solo performance e per questo
// non crea affinità per nessun numero — QUATTRO DIRETTE
// basterebbero a creare un'affinità — e una presenza è, alla lettera, aver tenuto
// una scheda aperta e visibile: questo file non sa nemmeno se il video sta
// andando. Un'affermazione su una persona che nessuna sua scelta sostiene.
//
// Quello che dalla diretta lascia un segno nel profilo è la CONSEGNA (la risposta
// alla domanda posta in diretta): lib/eventi/consegna.ts, e la ragione per esteso
// in testa a supabase/migrations/20260927120000_consegna_evento.sql.
// ⚠️ DAL 25/10 LA RISPOSTA SI LEGGE. Fino ad allora un battito respinto (401,
// sessione persa) era indistinguibile da uno riuscito: la pagina diceva «In
// diretta» e il conteggio sul database si era fermato. L'hook restituisce
// l'esito dell'ULTIMO battito, e la pagina lo dice allo studente. Il ciclo non
// cambia: un `setInterval` che non dipende dall'esito dell'`await`, quindi un
// battito che fallisce non ferma i successivi.
export function useHeartbeatDiretta(eventoId: string, attivo: boolean): EsitoBattito | null {
  const [esito, setEsito] = useState<EsitoBattito | null>(null);
  useEffect(() => {
    if (!attivo) return;

    let annullato = false;

    async function ping() {
      if (document.visibilityState !== "visible" || annullato) return;
      let status: number | null = null;
      let corpo: unknown = null;
      try {
        const r = await fetch("/api/live/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventoId }),
        });
        status = r.status;
        corpo = await r.json().catch(() => null);
      } catch {
        // rete: il prossimo tentativo fra 60s.
      }
      if (annullato) return;
      const e = esitoBattito(status, corpo);
      if (e !== "ok" && e !== "chiusa") console.error("useHeartbeatDiretta: battito non accettato", e, status, corpo);
      setEsito(e);
      // Una diretta chiusa non riapre: battere ancora sarebbe solo rumore.
      if (e === "chiusa") clearInterval(intervallo);
    }

    // `ping` legge `intervallo` solo dopo un `await`, quando è già assegnato.
    ping();
    const intervallo = setInterval(ping, 60000);

    return () => {
      annullato = true;
      clearInterval(intervallo);
    };
  }, [eventoId, attivo]);
  return esito;
}
