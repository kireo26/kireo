"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// LASCIARE IL WORKSHOP.
//
// Scritto per chi si è pentito, non per il robot del banco. Prima del
// 2026-08-30 non c'era nessuna strada da «attivo» a «ritirato»: un ruolo preso
// per sbaglio restava preso, e non si poteva cambiare.
//
// LA CONFERMA DICE COSA SUCCEDE AL LAVORO GIÀ FATTO. È la parte che conta: un
// ritiro che non lo dice non lo clicca nessuno. Le tre righe sono vere per
// costruzione, non rassicurazioni — `ritira_iscrizione_workshop` cambia
// soltanto lo stato dell'iscrizione, e le policy di lettura dell'elaborato
// guardano lo studente, non lo stato.
export default function RitiroIscrizione({ iscrizioneId, ruoloTitolo }: { iscrizioneId: string; ruoloTitolo: string }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function ritirati() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("ritira_iscrizione_workshop", { p_iscrizione_id: iscrizioneId });
      if (error) {
        setErrore("Non è stato possibile lasciare il workshop. Riprova fra un momento.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  if (!aperto) {
    return (
      <div className="pt-2 text-center">
        <button type="button" onClick={() => setAperto(true)} className="text-xs text-kireo-muted underline hover:text-kireo-light">
          Lascia il workshop o cambia ruolo
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-base font-semibold leading-[1.25] text-kireo-light">
        Vuoi lasciare il ruolo {ruoloTitolo}?
      </h2>
      <ul className="mt-3 space-y-2 text-sm text-kireo-light/90">
        <li>
          <span className="text-kireo-muted">·</span> Il tuo lavoro resta dov&apos;è — le sezioni che hai scritto, la chat con il
          cliente, le revisioni che hai ricevuto. Non si cancella niente.
        </li>
        <li>
          <span className="text-kireo-muted">·</span> Puoi tornare su questo stesso ruolo quando vuoi, e riprendere da dove eri.
        </li>
        <li>
          <span className="text-kireo-muted">·</span> Oppure puoi prendere un altro ruolo di questo workshop: quello comincia da
          zero, e quello di adesso ti resta qui.
        </li>
      </ul>

      {errore && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{errore}</p>}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={ritirati}
          disabled={caricamento}
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-kireo-light hover:border-white/40 disabled:opacity-50"
        >
          {caricamento ? "Un momento…" : "Sì, lascia questo ruolo"}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="rounded-full bg-kireo-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-kireo-green-light"
        >
          No, continuo
        </button>
      </div>
    </div>
  );
}
