"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { TESTI_ATTIVA_ENTE as T, esitoAttivazione } from "@/lib/admin/attivaEnte";

// ATTIVARE UN ENTE (dalla sua pagina e, dal 01/11, dalla riga dell'elenco).
// Attivare è una decisione, non una spunta: un ente attivato per sbaglio vede
// gli studenti, pubblica, manda newsletter. Il bottone sulla pagina obbligava a
// guardare chi si stava attivando; nell'elenco quel pregio non c'è, quindi c'è
// una conferma che NOMINA l'ente («Attivare Musica Academy?»), non «Confermi?»:
// una conferma che non dice cosa sta per succedere è un secondo clic.
// «Fatto» si dice solo se il database rilegge la riga attiva: sotto RLS un
// update che non tocca niente risponde senza errore (il modo 11), e la riga
// esce dall'elenco solo con la rilettura della pagina, non perché il browser
// ha deciso che è andata.
export default function AttivaIstituzioneButton({ istituzioneId, nome }: { istituzioneId: string; nome: string }) {
  const router = useRouter();
  const [chiedi, setChiedi] = useState(false);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function attiva() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("istituzioni").update({ stato: "attiva" }).eq("id", istituzioneId).select("stato");
      if (error) console.error("[admin] attivazione ente:", descriviErrore(error));
      const esito = esitoAttivazione(error ? null : data);
      if (esito !== "attivato") {
        setErrore(esito === "non_toccato" ? T.nonToccato : T.errore);
        return;
      }
      setChiedi(false);
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  if (!chiedi) {
    return (
      <div>
        <Button type="button" variant="primary" onClick={() => setChiedi(true)}>
          {T.bottone}
        </Button>
        {errore && <p className="mt-1.5 text-sm text-red-400">{errore}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <p className="text-sm font-semibold text-kireo-light">{T.domanda(nome)}</p>
      <p className="text-xs text-kireo-muted">{T.conseguenza}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" onClick={attiva} disabled={caricamento}>
          {caricamento ? T.inCorso : T.conferma}
        </Button>
        <Button type="button" variant="outline" onClick={() => setChiedi(false)} disabled={caricamento}>
          {T.annulla}
        </Button>
      </div>
      {errore && <p className="text-sm text-red-400">{errore}</p>}
    </div>
  );
}
