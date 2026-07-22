"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Consenso esplicito: insert/delete diretti su newsletter_docenti (RLS
// select/insert/delete own), nessun invio email reale collegato — stesso
// limite noto altrove nel progetto.
export default function NewsletterToggle({ userId, iscrittoIniziale }: { userId: string; iscrittoIniziale: boolean }) {
  const router = useRouter();
  const [iscritto, setIscritto] = useState(iscrittoIniziale);
  const [caricamento, setCaricamento] = useState(false);

  async function handleClick() {
    setCaricamento(true);
    try {
      const supabase = createClient();
      if (iscritto) {
        const { error } = await supabase.from("newsletter_docenti").delete().eq("user_id", userId);
        if (!error) setIscritto(false);
      } else {
        const { error } = await supabase.from("newsletter_docenti").insert({ user_id: userId });
        if (!error) setIscritto(true);
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-kireo-card p-4">
      <div>
        <p className="font-heading text-sm font-semibold text-kireo-light">Newsletter docenti</p>
        <p className="mt-1 text-xs text-kireo-muted">Novità su AI, valutazione, normativa e PCTO — una volta al mese.</p>
      </div>
      <Button type="button" variant={iscritto ? "outline" : "primary"} onClick={handleClick} disabled={caricamento}>
        {caricamento ? "Un momento…" : iscritto ? "Disiscriviti" : "Iscriviti"}
      </Button>
    </div>
  );
}
