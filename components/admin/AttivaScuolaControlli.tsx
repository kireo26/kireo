"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Attivazione a due stadi: prima si registra la data di firma della
// convenzione (stato -> convenzionata), poi un secondo passo esplicito
// attiva davvero la scuola (stato -> attiva, sblocca le funzioni). Due
// bottoni distinti invece di uno solo: la firma della convenzione e
// l'attivazione tecnica possono avvenire in momenti diversi.
export default function AttivaScuolaControlli({
  scuolaProfiloId,
  stato,
  convenzioneFirmataIl,
}: {
  scuolaProfiloId: string;
  stato: string;
  convenzioneFirmataIl: string | null;
}) {
  const router = useRouter();
  const [data, setData] = useState(convenzioneFirmataIl ?? new Date().toISOString().slice(0, 10));
  const [caricamento, setCaricamento] = useState<"convenzione" | "attiva" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function registraConvenzione() {
    setCaricamento("convenzione");
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("scuole_profili")
        .update({ convenzione_firmata_il: data, stato: "convenzionata" })
        .eq("id", scuolaProfiloId);
      if (error) {
        setErrore("Non è stato possibile registrare la convenzione.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  async function attiva() {
    setCaricamento("attiva");
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("scuole_profili").update({ stato: "attiva" }).eq("id", scuolaProfiloId);
      if (error) {
        setErrore("Non è stato possibile attivare la scuola.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  if (stato === "attiva") {
    return <span className="rounded-full bg-kireo-green/15 px-3 py-1 text-xs font-semibold text-kireo-green-light">Attiva</span>;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      {stato === "richiesta" && (
        <>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
          />
          <Button type="button" variant="outline" onClick={registraConvenzione} disabled={caricamento !== null}>
            {caricamento === "convenzione" ? "…" : "Registra convenzione firmata"}
          </Button>
        </>
      )}
      {stato === "convenzionata" && (
        <>
          <span className="text-xs text-kireo-muted">Convenzione firmata il {convenzioneFirmataIl}</span>
          <Button type="button" variant="primary" onClick={attiva} disabled={caricamento !== null}>
            {caricamento === "attiva" ? "Attivazione…" : "Attiva"}
          </Button>
        </>
      )}
      {errore && <span className="text-sm text-red-400">{errore}</span>}
    </div>
  );
}
