"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Riservato ai maggiorenni (gate anche server-side, vedi
// manifestazioni_interesse_insert_own): condivide nome, cognome, scuola e
// aree di interesse con l'ente — MAI email/telefono, il contatto passa
// solo dai messaggi in piattaforma. Revocabile qui e da /app/profilo.
export default function ManifestazioneInteresseButton({
  istituzioneId,
  userId,
  maggiorenne,
  manifestazioneAttivaId,
}: {
  istituzioneId: string;
  userId: string | null;
  maggiorenne: boolean;
  manifestazioneAttivaId: string | null;
}) {
  const pathname = usePathname();
  const [id, setId] = useState(manifestazioneAttivaId);
  const [mostraInfo, setMostraInfo] = useState(false);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!userId) {
    return (
      <Link
        href={`/accedi?redirectedFrom=${encodeURIComponent(pathname)}`}
        className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-kireo-light transition-colors hover:border-kireo-light/50"
      >
        Condividi il tuo profilo con questo ente
      </Link>
    );
  }

  if (!maggiorenne) {
    return (
      <Button type="button" variant="outline" disabled>
        Disponibile dai 18 anni
      </Button>
    );
  }

  async function condividi() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("manifestazioni_interesse")
        .insert({ student_id: userId, istituzione_id: istituzioneId })
        .select("id")
        .single();
      if (error || !data) {
        setErrore("Non è stato possibile completare l'operazione. Riprova.");
        return;
      }
      setId(data.id);
      setMostraInfo(false);
    } finally {
      setCaricamento(false);
    }
  }

  async function revoca() {
    if (!id) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("manifestazioni_interesse").update({ revocata_il: new Date().toISOString() }).eq("id", id);
      if (error) {
        setErrore("Non è stato possibile revocare. Riprova.");
        return;
      }
      setId(null);
    } finally {
      setCaricamento(false);
    }
  }

  if (id) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" onClick={revoca} disabled={caricamento}>
          {caricamento ? "Un momento…" : "Profilo condiviso ✓ — Revoca"}
        </Button>
        {errore && <p className="text-xs text-red-400">{errore}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!mostraInfo ? (
        <Button type="button" variant="outline" onClick={() => setMostraInfo(true)}>
          Condividi il tuo profilo con questo ente
        </Button>
      ) : (
        <div className="max-w-sm space-y-3 rounded-xl border border-white/10 bg-kireo-dark/60 p-4 text-left">
          <p className="text-xs text-kireo-muted">
            L&apos;ente vedrà nome, cognome, la tua scuola e le aree di orientamento che hai scelto. Non condivide mai
            email o telefono: potrà scriverti solo tramite i messaggi di KIREO. Puoi revocare quando vuoi.
          </p>
          {errore && <p className="text-xs text-red-400">{errore}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="primary" onClick={condividi} disabled={caricamento}>
              {caricamento ? "Un momento…" : "Conferma"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setMostraInfo(false)} disabled={caricamento}>
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
