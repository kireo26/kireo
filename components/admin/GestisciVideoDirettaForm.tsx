"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { estraiIdYoutube } from "@/lib/youtube";

// Solo admin (eventi_admin_tutto copre già l'update, nessuna nuova
// policy necessaria): imposta/modifica/rimuove youtube_video_id in ogni
// momento, indipendentemente dallo stato dell'evento — è il "kill switch"
// esplicitamente richiesto (rimozione = "Entra nella diretta" sparisce e
// la pagina live mostra "diretta non disponibile", vedi lib/live.ts +
// EntraDirettaLink/PannelloLive).
export default function GestisciVideoDirettaForm({ eventoId, videoIdAttuale }: { eventoId: string; videoIdAttuale: string | null }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [caricamento, setCaricamento] = useState<"salva" | "rimuovi" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva() {
    const id = estraiIdYoutube(link);
    if (!id) {
      setErrore("Incolla un link YouTube valido.");
      return;
    }
    setCaricamento("salva");
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("eventi").update({ youtube_video_id: id }).eq("id", eventoId);
      if (error) {
        setErrore("Non è stato possibile salvare. Riprova.");
        return;
      }
      setLink("");
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  async function rimuovi() {
    setCaricamento("rimuovi");
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("eventi").update({ youtube_video_id: null }).eq("id", eventoId);
      if (error) {
        setErrore("Non è stato possibile rimuovere. Riprova.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-kireo-muted">
        Video diretta: {videoIdAttuale ? <span className="text-kireo-green-light">impostato ({videoIdAttuale})</span> : <span className="text-kireo-orange">non impostato</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Link YouTube della diretta"
          className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-xs text-kireo-light placeholder:text-kireo-muted focus:outline-none focus:border-kireo-green"
        />
        <button
          type="button"
          onClick={salva}
          disabled={caricamento !== null}
          className="rounded-lg bg-kireo-green px-3 py-2 text-xs font-semibold text-kireo-light hover:bg-kireo-green-light disabled:opacity-50"
        >
          {caricamento === "salva" ? "Salvataggio…" : "Imposta"}
        </button>
        {videoIdAttuale && (
          <button
            type="button"
            onClick={rimuovi}
            disabled={caricamento !== null}
            className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {caricamento === "rimuovi" ? "Rimozione…" : "Rimuovi"}
          </button>
        )}
      </div>
      {errore && <p className="text-xs text-red-400">{errore}</p>}
    </div>
  );
}
