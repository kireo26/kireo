"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

// Avvia T3 tramite la route dedicata, che crea il tentativo E congela le aree
// candidate (niente insert diretto come IniziaTest: il congelamento dev'essere
// autorevole e server-side). Gemello di IniziaTest, ma passa per /api.
export default function IniziaTestT3({ etichetta = "Inizia il test" }: { etichetta?: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function inizia() {
    setErrore(null);
    setInCorso(true);
    try {
      const res = await fetch("/api/test/t3/inizia", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrore(data.errore ?? "Non è stato possibile avviare il test. Riprova.");
        return;
      }
      if (data.fallback) {
        setErrore("Ti servono ancora un paio di aree emerse: fai prima «Da dove parti».");
        return;
      }
      router.refresh();
    } catch {
      setErrore("Non è stato possibile avviare il test. Riprova.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={inizia} disabled={inCorso}>
        {inCorso ? "…" : etichetta}
      </Button>
      {errore && <p className="mt-2 text-sm text-red-400">{errore}</p>}
    </div>
  );
}
