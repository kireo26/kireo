"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function AttivaIstituzioneButton({ istituzioneId }: { istituzioneId: string }) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleClick() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("istituzioni").update({ stato: "attiva" }).eq("id", istituzioneId);
      if (error) {
        setErrore("Non è stato possibile attivarla. Riprova.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="primary" onClick={handleClick} disabled={caricamento}>
        {caricamento ? "Attivazione…" : "Attiva"}
      </Button>
      {errore && <p className="mt-1.5 text-sm text-red-400">{errore}</p>}
    </div>
  );
}
