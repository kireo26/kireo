"use client";

import { useState } from "react";

export type VoceChecklist = { label: string; completata: boolean };

// Badge cliccabile: apre la checklist delle voci mancanti del profilo,
// invece di limitarsi a mostrare un numero senza spiegarlo.
export default function BadgeProfiloPercentuale({ percentuale, voci }: { percentuale: number; voci: VoceChecklist[] }) {
  const [aperto, setAperto] = useState(false);

  return (
    <div className="relative flex-none">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
        className="rounded-full border border-white/10 bg-kireo-card px-4 py-2 text-sm font-semibold text-kireo-light transition-colors hover:border-white/20"
      >
        Profilo {percentuale}%
      </button>
      {aperto && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-kireo-card p-4 shadow-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Completa il tuo profilo</p>
          <ul className="space-y-2">
            {voci.map((voce) => (
              <li key={voce.label} className="flex items-center gap-2 text-sm">
                <span className={voce.completata ? "text-kireo-green-light" : "text-kireo-muted"}>
                  {voce.completata ? "✓" : "○"}
                </span>
                <span className={voce.completata ? "text-kireo-light" : "text-kireo-muted"}>{voce.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
