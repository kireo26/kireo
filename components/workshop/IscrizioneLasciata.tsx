"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Quello che vede chi ha lasciato un ruolo e torna sulla pagina del workshop.
//
// La cosa da non sbagliare qui è il tempo verbale: il lavoro NON è archiviato,
// è ancora suo e ancora lì. Chi ha lasciato un ruolo per sbaglio deve trovare
// una strada per tornare, non un cimitero.
export default function IscrizioneLasciata({ iscrizioneId, ruoloTitolo }: { iscrizioneId: string; ruoloTitolo: string }) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function riprendi() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("riprendi_iscrizione_workshop", { p_iscrizione_id: iscrizioneId });
      if (error) {
        setErrore(
          error.message?.includes("iscrizione_gia_attiva")
            ? "Risulta già attivo un altro ruolo di questo workshop: lascia quello, e poi puoi tornare qui."
            : "Non è stato possibile riprendere il ruolo. Riprova fra un momento.",
        );
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-kireo-card p-6 sm:p-8">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Hai lasciato il ruolo {ruoloTitolo}</h2>
      <p className="mt-2 text-sm text-kireo-light/90">
        Il lavoro che avevi fatto è ancora qui: le sezioni, la chat con il cliente, le revisioni. Se riprendi, riparti da dove eri.
      </p>

      {errore && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{errore}</p>}

      <button
        type="button"
        onClick={riprendi}
        disabled={caricamento}
        className="mt-5 rounded-full bg-kireo-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-kireo-green-light disabled:opacity-50"
      >
        {caricamento ? "Un momento…" : `Riprendi ${ruoloTitolo}`}
      </button>

      <p className="mt-4 text-sm text-kireo-muted">Oppure scegli un altro ruolo qui sotto: quello comincia da zero.</p>
    </div>
  );
}
