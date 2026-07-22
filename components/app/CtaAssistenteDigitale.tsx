"use client";

import { useState } from "react";
import Link from "next/link";
import { registraAttivita } from "@/lib/app/activityLog";
import { isAreaAttiva } from "@/lib/assistente/config";

// Per l'area Informatica & Digitale l'assistente è attivo (vedi
// lib/assistente): la CTA porta al pannello di chat in /app/assistente —
// area protetta, guardia auth+ruolo già garantita da app/app/layout.tsx e
// dal middleware (un visitatore non loggato viene rimandato ad /accedi con
// redirectedFrom già gestito lì, nessun bisogno di ripeterlo qui). Per le
// altre 17 aree resta lo stato onesto "in arrivo" di sempre.
export default function CtaAssistenteDigitale({ areaSlug, areaNome }: { areaSlug: string; areaNome: string }) {
  const [aperto, setAperto] = useState(false);
  const attiva = isAreaAttiva(areaSlug);

  function handleClickInArrivo() {
    setAperto(true);
    registraAttivita(areaSlug, "chat_assistente");
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center">
      <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
        Parla con l&apos;assistente digitale di {areaNome.toLowerCase()}
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-kireo-muted">
        {attiva
          ? "Fai domande su questa area a un assistente digitale — le risposte sono generate da un'intelligenza artificiale, non da una persona."
          : "Presto potrai fare domande su questa area a un assistente digitale — le risposte sono generate da un'intelligenza artificiale, non da una persona."}
      </p>
      {attiva ? (
        <Link
          href={`/app/assistente/${areaSlug}`}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-kireo-green px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
        >
          Parla con l&apos;assistente digitale
        </Link>
      ) : (
        <>
          <button
            type="button"
            onClick={handleClickInArrivo}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-kireo-light/30 px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:border-kireo-light/60 hover:bg-white/5"
          >
            {aperto ? "Arriva presto" : "Parla con l'assistente digitale"}
          </button>
          {aperto && (
            <p className="mt-3 text-xs text-kireo-muted">
              Non è ancora attivo: nel frattempo scarica la guida o dai un&apos;occhiata agli eventi qui sopra.
            </p>
          )}
        </>
      )}
    </div>
  );
}
