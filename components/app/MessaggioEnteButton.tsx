"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Riservato ai maggiorenni (gate anche server-side in apri_conversazione_ente).
// Se esiste già una conversazione aperta con questo ente, porta dritti lì
// invece di aprirne un'altra (nessun vincolo DB sull'unicità, gestito qui
// lato UI).
export default function MessaggioEnteButton({
  istituzioneId,
  userId,
  maggiorenne,
  conversazioneEsistenteId,
}: {
  istituzioneId: string;
  userId: string | null;
  maggiorenne: boolean;
  conversazioneEsistenteId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mostraForm, setMostraForm] = useState(false);
  const [testo, setTesto] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!userId) {
    return (
      <Link href={`/accedi?redirectedFrom=${encodeURIComponent(pathname)}`} className="text-sm font-medium text-kireo-orange underline underline-offset-2">
        Scrivi un messaggio
      </Link>
    );
  }

  if (!maggiorenne) {
    return (
      <Button type="button" variant="outline" disabled>
        Messaggi disponibili dai 18 anni
      </Button>
    );
  }

  if (conversazioneEsistenteId) {
    return (
      <Link href={`/app/messaggi/${conversazioneEsistenteId}`} className="text-sm font-medium text-kireo-orange underline underline-offset-2">
        Vai alla tua conversazione
      </Link>
    );
  }

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!testo.trim()) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("apri_conversazione_ente", { p_istituzione_id: istituzioneId, p_corpo: testo.trim() });
      if (error || !data) {
        if (error?.message?.includes("troppe_conversazioni_oggi")) setErrore("Hai raggiunto il numero massimo di conversazioni per oggi. Riprova domani.");
        else setErrore("Non è stato possibile inviare il messaggio. Riprova.");
        return;
      }
      router.push(`/app/messaggi/${data}`);
    } finally {
      setCaricamento(false);
    }
  }

  if (!mostraForm) {
    return (
      <Button type="button" variant="outline" onClick={() => setMostraForm(true)}>
        Scrivi un messaggio
      </Button>
    );
  }

  return (
    <form onSubmit={invia} className="max-w-sm space-y-2">
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Scrivi il tuo messaggio..."
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      {errore && <p className="text-xs text-red-400">{errore}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={caricamento || !testo.trim()}>
          {caricamento ? "Invio…" : "Invia"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setMostraForm(false)} disabled={caricamento}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
