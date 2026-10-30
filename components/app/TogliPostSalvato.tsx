"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { TESTI_POST_SALVATI } from "@/lib/app/postSalvati";

// Toglie un salvataggio dall'archivio, contando le righe tolte: zero è un
// rifiuto, non un «fatto» (il modo 11). Si toglie per id del salvataggio, non
// del post: un post cancellato non ha più un id da dare.
export default function TogliPostSalvato({ salvataggioId }: { salvataggioId: string }) {
  const router = useRouter();
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function togli() {
    setLavoro(true);
    setErrore(null);
    try {
      const { data, error } = await createClient().from("post_salvati").delete().eq("id", salvataggioId).select("id");
      if (error || !data || data.length === 0) {
        if (error) console.error("[archivio] togli un salvataggio:", descriviErrore(error));
        setErrore(TESTI_POST_SALVATI.togliNonRiuscito);
        return;
      }
      router.refresh();
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div className="flex-none text-right">
      <button type="button" onClick={togli} disabled={lavoro} className="text-xs text-kireo-muted underline underline-offset-2 hover:text-kireo-light disabled:opacity-50">
        {TESTI_POST_SALVATI.togli}
      </button>
      {errore && <p className="mt-1 text-xs text-red-400">{errore}</p>}
    </div>
  );
}
