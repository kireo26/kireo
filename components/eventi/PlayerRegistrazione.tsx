"use client";

import { useState } from "react";
import PlayerDiretta from "@/components/live/PlayerDiretta";
import type { EsitoSonda } from "@/lib/sondaYoutube";

// Il player di una registrazione (31/10): lo stesso PlayerDiretta con cui il
// banco ha visto partire la registrazione di 5doxLWDlAJU, e NIENTE ALTRO.
// Nessun battito, nessuna presenza, nessuna ora: rivedere non è esserci, e
// `npm run test:rivedi` vieta che qui entri `useHeartbeatDiretta` o una
// chiamata a /api/live. Se il video non parte lo diciamo, invece di lasciare
// un riquadro nero: la sonda lo aveva visto, ma un video può sparire dopo.
export default function PlayerRegistrazione({ videoId, titolo }: { videoId: string; titolo: string }) {
  const [rotto, setRotto] = useState<EsitoSonda | null>(null);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/5 bg-black">
      {rotto ? (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <p className="font-heading text-base font-semibold text-kireo-light">La registrazione non si riesce a riprodurre.</p>
          <p className="mt-2 max-w-md text-sm text-kireo-muted">
            Può averla tolta o resa privata chi l&apos;ha pubblicata. Riprova più tardi.
          </p>
        </div>
      ) : (
        <PlayerDiretta videoId={videoId} titolo={titolo} onErrore={setRotto} />
      )}
    </div>
  );
}
