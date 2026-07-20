"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// A differenza di AzioneApprovazione (un semplice update su una tabella),
// approvare un upgrade tocca due tabelle (istituzioni + richieste_upgrade)
// in un'unica operazione atomica: passa dalla funzione SQL
// approva_richiesta_upgrade invece di due update separati lato client, per
// non rischiare una scrittura a metà se la seconda fallisse.
export default function AzioneApprovazioneUpgrade({ richiestaId }: { richiestaId: string }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [caricamento, setCaricamento] = useState<"approva" | "rifiuta" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleApprova() {
    setCaricamento("approva");
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("approva_richiesta_upgrade", {
        p_richiesta_id: richiestaId,
        p_nota: nota.trim() || null,
      });
      if (error) {
        setErrore("Non è stato possibile approvare la richiesta. Riprova.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  async function handleRifiuta() {
    setCaricamento("rifiuta");
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("richieste_upgrade")
        .update({ stato: "rifiutata", note_kireo: nota.trim() || null })
        .eq("id", richiestaId);
      if (error) {
        setErrore("Non è stato possibile rifiutare la richiesta. Riprova.");
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
        placeholder="Nota (facoltativa, visibile all'ente)"
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      {errore && <p className="text-sm text-red-400">{errore}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="primary" onClick={handleApprova} disabled={caricamento !== null}>
          {caricamento === "approva" ? "Approvazione…" : "Approva"}
        </Button>
        <Button type="button" variant="outline" onClick={handleRifiuta} disabled={caricamento !== null}>
          {caricamento === "rifiuta" ? "Rifiuto…" : "Rifiuta"}
        </Button>
      </div>
    </div>
  );
}
