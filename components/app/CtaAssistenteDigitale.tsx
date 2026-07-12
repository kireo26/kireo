"use client";

import { useState } from "react";
import { registraAttivita } from "@/lib/app/activityLog";

// Nessun assistente reale oggi (nessuna infrastruttura LLM nel progetto):
// CTA onesta che traccia l'intenzione (chat_assistente) e mostra uno stato
// "in arrivo" invece di una chat finta o promesse non mantenute. Il
// disclaimer AI è integrato nel testo di presentazione, non in un'alert a
// parte, perché la funzione non è ancora attiva.
export default function CtaAssistenteDigitale({ areaSlug, areaNome }: { areaSlug: string; areaNome: string }) {
  const [aperto, setAperto] = useState(false);

  function handleClick() {
    setAperto(true);
    registraAttivita(areaSlug, "chat_assistente");
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center">
      <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
        Parla con l&apos;assistente digitale di {areaNome.toLowerCase()}
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-kireo-muted">
        Presto potrai fare domande su questa area a un assistente digitale — le risposte sono generate da
        un&apos;intelligenza artificiale, non da una persona.
      </p>
      <button
        type="button"
        onClick={handleClick}
        className="mt-4 inline-flex items-center justify-center rounded-full border border-kireo-light/30 px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:border-kireo-light/60 hover:bg-white/5"
      >
        {aperto ? "Arriva presto" : "Parla con l'assistente digitale"}
      </button>
      {aperto && (
        <p className="mt-3 text-xs text-kireo-muted">
          Non è ancora attivo: nel frattempo scarica la guida o dai un&apos;occhiata agli eventi qui sopra.
        </p>
      )}
    </div>
  );
}
