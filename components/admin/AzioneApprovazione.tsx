"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function AzioneApprovazione({
  tabella,
  id,
  statoApprovato,
  statoRifiutato,
}: {
  tabella: "eventi" | "comunicazioni";
  id: string;
  statoApprovato: string;
  statoRifiutato: string;
}) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [caricamento, setCaricamento] = useState<"approva" | "rifiuta" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleAzione(stato: string, chiave: "approva" | "rifiuta") {
    setCaricamento(chiave);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(tabella)
        .update({ stato, note_revisione: nota.trim() || null })
        .eq("id", id);
      if (error) {
        setErrore("Non è stato possibile aggiornare. Riprova.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        placeholder="Nota di revisione (facoltativa, visibile all'ente)"
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      {errore && <p className="text-sm text-red-400">{errore}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="primary" onClick={() => handleAzione(statoApprovato, "approva")} disabled={caricamento !== null}>
          {caricamento === "approva" ? "Approvazione…" : "Approva"}
        </Button>
        <Button type="button" variant="outline" onClick={() => handleAzione(statoRifiutato, "rifiuta")} disabled={caricamento !== null}>
          {caricamento === "rifiuta" ? "Rifiuto…" : "Rifiuta"}
        </Button>
      </div>
    </div>
  );
}
