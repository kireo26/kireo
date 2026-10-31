"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { TESTI_REGISTRAZIONI_SALVATE as T } from "@/lib/app/registrazioniSalvate";

// Toglie una registrazione dall'archivio, per id del salvataggio (un evento
// cancellato non ha più un id da dare), contando le righe tolte.
export default function TogliRegistrazioneSalvata({ salvataggioId }: { salvataggioId: string }) {
  const router = useRouter();
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function togli() {
    setLavoro(true);
    setErrore(null);
    try {
      const { data, error } = await createClient().from("registrazioni_salvate").delete().eq("id", salvataggioId).select("id");
      if (error || !data || data.length === 0) {
        if (error) console.error("[archivio] togli una registrazione:", descriviErrore(error));
        setErrore(T.togliNonRiuscito);
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
        {T.togli}
      </button>
      {errore && <p className="mt-1 text-xs text-red-400">{errore}</p>}
    </div>
  );
}
