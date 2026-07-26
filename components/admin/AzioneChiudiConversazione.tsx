"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AzioneChiudiConversazione({ id }: { id: string }) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);

  async function chiudi() {
    setCaricamento(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("chiudi_conversazione_admin", { p_conversazione_id: id });
      if (!error) router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <button type="button" onClick={chiudi} disabled={caricamento} className="text-xs text-red-300 underline underline-offset-2">
      {caricamento ? "Chiusura…" : "Chiudi forzatamente"}
    </button>
  );
}
