"use client";

import { useState } from "react";

export default function TutorPanel({
  iscrizioneId,
  workshopSlug,
  ruoloSlug,
  faseId,
  sezioneId,
  testoCorrente,
}: {
  iscrizioneId: string;
  workshopSlug: string;
  ruoloSlug: string;
  faseId: string;
  sezioneId: string;
  testoCorrente: string;
}) {
  const [modoAttivo, setModoAttivo] = useState<"aiuto" | "revisione" | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [risposta, setRisposta] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function chiedi(modo: "aiuto" | "revisione") {
    setModoAttivo(modo);
    setCaricamento(true);
    setErrore(null);
    setRisposta(null);
    try {
      const res = await fetch("/api/workshop/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iscrizioneId, workshopSlug, ruoloSlug, faseId, sezioneId, modo, testoCorrente }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrore(data.errore ?? "Non è stato possibile contattare il tutor.");
        return;
      }
      setRisposta(data.risposta);
    } catch {
      setErrore("Errore di connessione. Riprova.");
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => chiedi("aiuto")}
          disabled={caricamento}
          className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-kireo-light hover:border-kireo-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          Chiedi aiuto
        </button>
        <button
          type="button"
          onClick={() => chiedi("revisione")}
          disabled={caricamento || !testoCorrente.trim()}
          className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-kireo-light hover:border-kireo-orange disabled:cursor-not-allowed disabled:opacity-50"
        >
          Fai revisionare
        </button>
      </div>

      {(caricamento || risposta || errore) && (
        <div className="mt-3 rounded-xl border border-white/10 bg-kireo-dark p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">
            Tutor · {modoAttivo === "revisione" ? "Revisione" : "Aiuto"}
          </p>
          {caricamento && <p className="mt-2 text-kireo-muted">Sto pensando…</p>}
          {!caricamento && risposta && <p className="mt-2 whitespace-pre-wrap text-kireo-light/90">{risposta}</p>}
          {!caricamento && errore && <p className="mt-2 text-red-400">{errore}</p>}
        </div>
      )}
    </div>
  );
}
