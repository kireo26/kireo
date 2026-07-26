"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Variante dedicata di AzioneApprovazione (tabella diversa: post_enti usa
// motivo_rifiuto invece di note_revisione, e registra approvato_da/il
// all'approvazione — nessun'altra coda admin lo fa, non generalizzato nel
// componente condiviso per non appesantirlo).
export default function AzioneApprovazionePost({ id }: { id: string }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [caricamento, setCaricamento] = useState<"approva" | "rifiuta" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function approva() {
    setCaricamento("approva");
    setErrore(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("post_enti")
        .update({ stato: "approvato", approvato_da: user?.id ?? null, approvato_il: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        setErrore("Non è stato possibile approvare. Riprova.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  async function rifiuta() {
    setCaricamento("rifiuta");
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("post_enti")
        .update({ stato: "rifiutato", motivo_rifiuto: motivo.trim() || null })
        .eq("id", id);
      if (error) {
        setErrore("Non è stato possibile rifiutare. Riprova.");
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
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
        placeholder="Motivo del rifiuto (facoltativo, visibile all'ente)"
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      {errore && <p className="text-sm text-red-400">{errore}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="primary" onClick={approva} disabled={caricamento !== null}>
          {caricamento === "approva" ? "Approvazione…" : "Approva"}
        </Button>
        <Button type="button" variant="outline" onClick={rifiuta} disabled={caricamento !== null}>
          {caricamento === "rifiuta" ? "Rifiuto…" : "Rifiuta"}
        </Button>
      </div>
    </div>
  );
}
