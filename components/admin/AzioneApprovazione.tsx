"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { erroreRifiuto } from "@/lib/admin/rifiuto";
import { TESTI_AVVISI } from "@/lib/admin/avvisiEnte";

// Approva / non approva un evento o una newsletter (30/10). La decisione e
// l'avviso all'ente passano dal server (`/api/admin/decisione`): prima di
// allora l'approvazione di un evento era un update da qui, e l'ente non lo
// sapeva finché non riapriva la pagina.
export default function AzioneApprovazione({ cosa, id }: { cosa: "evento" | "newsletter"; id: string }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [caricamento, setCaricamento] = useState<"approva" | "rifiuta" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  async function handleAzione(approva: boolean) {
    // Un rifiuto porta la sua ragione (`lib/admin/rifiuto.ts`): si controlla
    // prima di mandare, così un rifiuto muto non parte mai.
    if (!approva) {
      const manca = erroreRifiuto(nota);
      if (manca) {
        setErrore(manca);
        return;
      }
    }
    setCaricamento(approva ? "approva" : "rifiuta");
    setErrore(null);
    setAvviso(null);
    try {
      const risposta = await fetch("/api/admin/decisione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cosa, id, approva, nota }),
      });
      const corpo = (await risposta.json().catch(() => ({}))) as { errore?: string; emailInviata?: boolean; esitoEmail?: string };
      if (!risposta.ok) {
        setErrore(corpo.errore ?? "Non è stato possibile aggiornare. Riprova.");
        return;
      }
      // Un'email non partita NON si rilegge subito: la riga della coda uscirebbe
      // e l'avviso con lei (il 30/10 successo e fallimento erano lo stesso
      // schermo). Si aggiorna quando l'admin l'ha letto; l'esito resta anche in
      // «Email all'ente non partite».
      if (corpo.emailInviata) router.refresh();
      else setAvviso(TESTI_AVVISI.dopoDecisione(corpo.esitoEmail));
    } catch {
      setErrore("Non è stato possibile aggiornare. Riprova.");
    } finally {
      setCaricamento(null);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        placeholder="Nota di revisione (obbligatoria per non approvare, arriva all'ente)"
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      {errore && <p className="text-sm text-red-400">{errore}</p>}
      {avviso && (
        <div className="space-y-2">
          <p className="text-sm text-kireo-orange">{avviso}</p>
          <Button type="button" variant="outline" onClick={() => router.refresh()}>
            Ho letto, aggiorna la coda
          </Button>
        </div>
      )}
      <div className="flex gap-3">
        <Button type="button" variant="primary" onClick={() => handleAzione(true)} disabled={caricamento !== null || avviso !== null}>
          {caricamento === "approva" ? "Approvazione…" : "Approva"}
        </Button>
        <Button type="button" variant="outline" onClick={() => handleAzione(false)} disabled={caricamento !== null || avviso !== null}>
          {caricamento === "rifiuta" ? "Un momento…" : "Non approvare"}
        </Button>
      </div>
    </div>
  );
}
