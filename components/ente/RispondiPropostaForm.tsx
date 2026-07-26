"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function RispondiPropostaForm({ propostaId }: { propostaId: string }) {
  const router = useRouter();
  const [risposta, setRisposta] = useState("");
  const [caricamento, setCaricamento] = useState<"accetta" | "rifiuta" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function rispondi(accetta: boolean) {
    setCaricamento(accetta ? "accetta" : "rifiuta");
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("rispondi_proposta_incontro", {
        p_proposta_id: propostaId,
        p_accetta: accetta,
        p_risposta: risposta.trim() || null,
      });
      if (error) {
        setErrore("Non è stato possibile inviare la risposta. Riprova.");
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
        value={risposta}
        onChange={(e) => setRisposta(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Messaggio per la scuola (facoltativo)"
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      {errore && <p className="text-sm text-red-400">{errore}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="primary" onClick={() => rispondi(true)} disabled={caricamento !== null}>
          {caricamento === "accetta" ? "…" : "Accetta"}
        </Button>
        <Button type="button" variant="outline" onClick={() => rispondi(false)} disabled={caricamento !== null}>
          {caricamento === "rifiuta" ? "…" : "Rifiuta"}
        </Button>
      </div>
    </div>
  );
}

export function CreaEventoDaPropostaLink({ propostaId }: { propostaId: string }) {
  return (
    <Link href={`/ente/eventi?proposta=${propostaId}`} className="mt-3 inline-block text-xs text-kireo-orange underline underline-offset-2">
      Crea l&apos;evento collegato →
    </Link>
  );
}
