"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { erroreRimozione, messaggioTogliPost, testoConfermaRimozione } from "@/lib/admin/rimozionePost";

// Togliere un post dal feed, in due passi: la motivazione, poi la conferma con
// il numero delle notifiche già partite. Il perché sta in lib/admin/rimozionePost.ts.
export default function TogliPost({ id, notifiche }: { id: string; notifiche: number | null }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [conferma, setConferma] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function chiediConferma() {
    // La motivazione prima di tutto: una conferma su un gesto che poi fallirebbe
    // per la motivazione mancante è una domanda inutile.
    const manca = erroreRimozione(motivo);
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
      const supabase = createClient();
      const { error } = await supabase.rpc("togli_post", { p_post: id, p_motivo: motivo.trim() });
      if (error) {
        console.error("[admin] togli_post:", descriviErrore(error));
        setErrore(messaggioTogliPost(error.message ?? ""));
        return;
      }
      router.refresh();
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={motivo}
        onChange={(e) => {
          setMotivo(e.target.value);
          setConferma(false);
        }}
        rows={2}
        placeholder="Motivo (obbligatorio per togliere il post, lo legge l'ente)"
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
      />
      {errore && <p className="text-xs text-red-300">{errore}</p>}
      {conferma ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200">{testoConfermaRimozione(notifiche)}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" onClick={togli} disabled={inCorso}>
              {inCorso ? "Tolgo…" : "Sì, togli il post"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConferma(false)} disabled={inCorso}>
              Annulla
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={chiediConferma}>
          Togli dal feed
        </Button>
      )}
    </div>
  );
}
