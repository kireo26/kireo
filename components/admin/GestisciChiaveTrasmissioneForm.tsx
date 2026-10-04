"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formattaDataOra } from "@/lib/formato";

const MOTIVI: Record<string, string> = {
  non_autorizzato: "Serve un profilo admin per impostare la chiave.",
  chiave_vuota: "La chiave non può essere vuota.",
  evento_non_trovato: "Questo evento non esiste più.",
  hosting_non_kireo: "Questo evento lo trasmette l'ente dal proprio canale: non serve una chiave di KIREO.",
};

function motivo(messaggio: string): string {
  for (const chiave of Object.keys(MOTIVI)) {
    if (messaggio.includes(chiave)) return MOTIVI[chiave];
  }
  return "Non è stato possibile salvare la chiave. Riprova.";
}

// ACCANTO AL VIDEO, come chiesto: è lo stesso momento in cui l'admin prepara
// la diretta, quindi è l'unico posto in cui non è un gesto in più da
// ricordare. La chiave la scrive qui e da qui RAGGIUNGE l'ente — la funzione
// avvisa nella stessa transazione, non c'è un secondo passaggio che qualcuno
// possa dimenticare.
//
// Il valore già impostato NON si ri-legge in questo campo: ricaricarlo a
// schermo a ogni apertura della coda admin lo esporrebbe senza che nessuno
// l'abbia chiesto. Si vede che c'è e quando è stata preparata; per cambiarla
// si scrive la nuova.
export default function GestisciChiaveTrasmissioneForm({
  eventoId,
  aggiornataIl,
}: {
  eventoId: string;
  aggiornataIl: string | null;
}) {
  const router = useRouter();
  const [chiave, setChiave] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva() {
    if (!chiave.trim()) {
      setErrore("Incolla la chiave di trasmissione.");
      return;
    }
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("imposta_chiave_trasmissione", { p_evento_id: eventoId, p_chiave: chiave.trim() });
      if (error) {
        setErrore(motivo(error.message ?? ""));
        return;
      }
      setChiave("");
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-kireo-muted">
        Chiave di trasmissione:{" "}
        {aggiornataIl ? (
          <span className="text-kireo-green-light">preparata il {formattaDataOra(aggiornataIl, "long")}</span>
        ) : (
          <span className="text-kireo-orange">non preparata — l&apos;ente lo vede, e sta aspettando</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={chiave}
          onChange={(e) => setChiave(e.target.value)}
          placeholder={aggiornataIl ? "Nuova chiave (sostituisce quella attuale)" : "Chiave di trasmissione del canale KIREO"}
          autoComplete="off"
          className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 font-mono text-xs text-kireo-light placeholder:font-sans placeholder:text-kireo-muted focus:border-kireo-green focus:outline-none"
        />
        <button
          type="button"
          onClick={salva}
          disabled={caricamento}
          className="rounded-lg bg-kireo-green px-3 py-2 text-xs font-semibold text-kireo-light hover:bg-kireo-green-light disabled:opacity-50"
        >
          {caricamento ? "Salvataggio…" : aggiornataIl ? "Sostituisci" : "Prepara"}
        </button>
      </div>
      <p className="text-xs text-kireo-muted">
        L&apos;ente riceve una notifica appena la salvi — e una diversa se la sostituisci, così non prova con quella vecchia.
      </p>
      {errore && <p className="text-xs text-red-400">{errore}</p>}
    </div>
  );
}
