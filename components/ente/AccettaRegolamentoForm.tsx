"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Blocco per gli enti già registrati prima dell'introduzione del
// regolamento (i nuovi lo accettano al momento della registrazione, vedi
// RichiestaAccessoEnteForm). istituzioni_update_propria copre già questa
// scrittura, nessuna funzione dedicata necessaria.
export default function AccettaRegolamentoForm({ istituzioneId }: { istituzioneId: string }) {
  const router = useRouter();
  const [accettato, setAccettato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  async function handleClick() {
    if (!accettato) {
      setErrore("Devi spuntare la casella per continuare.");
      return;
    }
    setErrore(null);
    setCaricamento(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("istituzioni")
        .update({ regolamento_accettato_il: new Date().toISOString() })
        .eq("id", istituzioneId);
      if (error) {
        setErrore("Non è stato possibile salvare. Riprova.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md space-y-4 text-left">
      <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5">
        <input
          id="accetta-regolamento"
          type="checkbox"
          checked={accettato}
          onChange={(e) => {
            setAccettato(e.target.checked);
            setErrore(null);
          }}
          className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
        />
        <label htmlFor="accetta-regolamento" className="text-sm text-kireo-muted">
          Ho letto e accetto il{" "}
          <a href="/ente/regolamento" target="_blank" className="text-kireo-orange underline underline-offset-2">
            Regolamento enti
          </a>
        </label>
      </div>
      {errore && <p className="text-sm text-red-400">{errore}</p>}
      <Button type="button" variant="primary" className="w-full" onClick={handleClick} disabled={caricamento}>
        {caricamento ? "Salvataggio…" : "Continua"}
      </Button>
    </div>
  );
}
