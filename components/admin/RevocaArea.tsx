"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { TESTI_AVVISI } from "@/lib/admin/avvisiEnte";
import { erroreRevoca, TESTI_AREE_ADMIN } from "@/lib/admin/revocaArea";

// Togliere un'area a un ente, in due passi: il motivo, poi la conferma. La
// revoca e l'email all'ente le fa il server (/api/admin/revoca-area); se
// l'email non parte la pagina lo dice prima di rileggere, come la coda.
export default function RevocaArea({ istituzioneId, areaSlug }: { istituzioneId: string; areaSlug: string }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [conferma, setConferma] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [avvisoEmail, setAvvisoEmail] = useState<string | null>(null);

  function chiediConferma() {
    const manca = erroreRevoca(motivo);
    if (manca) {
      setErrore(manca);
      return;
    }
    setErrore(null);
    setConferma(true);
  }

  async function togli() {
    setInCorso(true);
    setErrore(null);
    try {
      const r = await fetch("/api/admin/revoca-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ istituzioneId, areaSlug, motivo: motivo.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { errore?: string; emailInviata?: boolean; esitoEmail?: string };
      if (!r.ok) {
        setErrore(j.errore ?? "Non è stato possibile togliere l'area. Riprova.");
        return;
      }
      if (!j.emailInviata) {
        setAvvisoEmail(TESTI_AVVISI.dopoDecisione(j.esitoEmail));
        return;
      }
      router.refresh();
    } finally {
      setInCorso(false);
    }
  }

  if (avvisoEmail) {
    return (
      <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
        <p>{avvisoEmail}</p>
        <button type="button" onClick={() => router.refresh()} className="mt-2 underline underline-offset-2">
          Ho letto, aggiorna
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={motivo}
        onChange={(e) => {
          setMotivo(e.target.value);
          setConferma(false);
        }}
        rows={2}
        placeholder="Motivo (obbligatorio per togliere l'area, lo legge l'ente)"
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
      />
      {errore && <p className="text-xs text-red-300">{errore}</p>}
      {conferma ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200">{TESTI_AREE_ADMIN.conferma}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" onClick={togli} disabled={inCorso}>
              {inCorso ? "Tolgo…" : "Sì, togli l'area"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConferma(false)} disabled={inCorso}>
              Annulla
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={chiediConferma}>
          Togli l&apos;area
        </Button>
      )}
    </div>
  );
}
