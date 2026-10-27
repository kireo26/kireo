"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { testoEsitoIscrizione } from "@/lib/scuola/esitoIscrizione";

type Classe = { id: string; nomeVisualizzato: string };

export default function IscriviClasseEventoForm({ eventoId, classi }: { eventoId: string; classi: Classe[] }) {
  const router = useRouter();
  const [classeId, setClasseId] = useState("");
  const [modalita, setModalita] = useState<"individuale" | "dad">("individuale");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ testo: string; avviso: boolean } | null>(null);

  async function handleIscrivi() {
    if (!classeId) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("iscrivi_classe_evento", {
        p_classe_id: classeId,
        p_evento_id: eventoId,
        p_modalita: modalita,
      });
      if (error) {
        console.error("[scuola] iscrivi_classe_evento:", descriviErrore(error));
        setErrore("Non è stato possibile iscrivere la classe.");
        return;
      }
      setEsito(testoEsitoIscrizione(data));
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  if (classi.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select value={classeId} onChange={(e) => setClasseId(e.target.value)} className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light">
        <option value="">Iscrivi una classe…</option>
        {classi.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nomeVisualizzato}
          </option>
        ))}
      </select>
      <select
        value={modalita}
        onChange={(e) => setModalita(e.target.value as "individuale" | "dad")}
        className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
      >
        <option value="individuale">In presenza (individuale)</option>
        <option value="dad">A distanza (gruppo)</option>
      </select>
      <Button type="button" variant="outline" onClick={handleIscrivi} disabled={!classeId || caricamento}>
        {caricamento ? "…" : "Iscrivi classe"}
      </Button>
      {esito && <span className={`text-sm ${esito.avviso ? "text-kireo-orange" : "text-kireo-green-light"}`}>{esito.testo}</span>}
      {errore && <span className="text-sm text-red-400">{errore}</span>}
    </div>
  );
}
