"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Promuove un evento APPROVATO consumando quota_eventi_promossi del piano
// (anno accademico corrente) — la funzione SQL fa tutti i controlli
// incrociati (proprietà, stato, quota), qui solo UI e gestione errori.
export default function MettiInEvidenzaButton({
  eventoId,
  quotaRimasta,
}: {
  eventoId: string;
  quotaRimasta: number;
}) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const quotaEsaurita = quotaRimasta <= 0;

  async function handleClick() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("metti_in_evidenza_evento", { p_evento_id: eventoId });
      if (error) {
        if (error.message?.includes("quota_eventi_promossi_esaurita")) {
          setErrore("Hai esaurito gli eventi in evidenza del tuo piano per quest'anno accademico.");
        } else {
          setErrore("Non è stato possibile mettere in evidenza l'evento. Riprova più tardi.");
        }
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  if (quotaEsaurita) {
    return (
      <div className="text-xs text-kireo-muted">
        Eventi in evidenza esauriti per quest&apos;anno.{" "}
        <Link href="/ente/piano" className="text-kireo-orange underline underline-offset-2">
          Scopri i piani →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Button type="button" variant="outline" onClick={handleClick} disabled={caricamento}>
        {caricamento ? "Metto in evidenza…" : "Metti in evidenza"}
      </Button>
      {errore && <p className="mt-1.5 text-xs text-red-400">{errore}</p>}
    </div>
  );
}
