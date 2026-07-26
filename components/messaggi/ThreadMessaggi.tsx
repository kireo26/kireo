"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

type Messaggio = { id: string; mittente: "studente" | "ente"; corpo: string; created_at: string; letta: boolean };

// Condiviso studente/ente (stesso thread, stessa RPC invia_messaggio_ente
// che decide da sola chi sta scrivendo in base a auth.uid()). La nota
// "conversazioni registrate e verificabili da KIREO" è sempre visibile a
// entrambe le parti.
export default function ThreadMessaggi({
  conversazioneId,
  ruolo,
  messaggiIniziali,
  stato,
  puoScrivere,
  notaNonScrivibile,
}: {
  conversazioneId: string;
  ruolo: "studente" | "ente";
  messaggiIniziali: Messaggio[];
  stato: "aperta" | "bloccata_da_studente" | "chiusa_da_admin";
  puoScrivere: boolean;
  notaNonScrivibile: string | null;
}) {
  const router = useRouter();
  const [messaggi, setMessaggi] = useState(messaggiIniziali);
  const [testo, setTesto] = useState("");
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [bloccando, setBloccando] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    for (const m of messaggiIniziali) {
      const nonMio = ruolo === "studente" ? m.mittente === "ente" : m.mittente === "studente";
      if (nonMio && !m.letta) {
        supabase.rpc("segna_messaggio_letto", { p_messaggio_id: m.id });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testo.trim() || invio) return;
    setInvio(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("invia_messaggio_ente", { p_conversazione_id: conversazioneId, p_corpo: testo.trim() });
      if (error) {
        if (error.message?.includes("troppi_messaggi_oggi")) setErrore("Hai raggiunto il numero massimo di messaggi per oggi in questa conversazione.");
        else if (error.message?.includes("piano_non_abilitato")) setErrore("Il tuo piano attuale non include i messaggi: passa a un piano superiore per rispondere.");
        else if (error.message?.includes("conversazione_non_scrivibile")) setErrore("Questa conversazione non è più scrivibile.");
        else setErrore("Non è stato possibile inviare il messaggio. Riprova.");
        return;
      }
      setMessaggi((prev) => [...prev, { id: `temp-${Date.now()}`, mittente: ruolo, corpo: testo.trim(), created_at: new Date().toISOString(), letta: false }]);
      setTesto("");
      router.refresh();
    } finally {
      setInvio(false);
    }
  }

  async function bloccaESegnala() {
    if (!confirm("Vuoi bloccare questa conversazione e segnalarla a KIREO? L'ente non potrà più scriverti.")) return;
    setBloccando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("blocca_conversazione_studente", { p_conversazione_id: conversazioneId });
      if (!error) router.refresh();
    } finally {
      setBloccando(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-white/5 bg-kireo-card">
      <div className="border-b border-white/5 px-4 py-3">
        <p className="text-xs text-kireo-muted">Le conversazioni sono registrate e verificabili da KIREO.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messaggi.map((m) => {
          const mio = m.mittente === ruolo;
          return (
            <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mio ? "bg-kireo-green text-kireo-light" : "bg-kireo-dark text-kireo-light/90"}`}>
                <p className="whitespace-pre-wrap">{m.corpo}</p>
                <p className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/5 p-4">
        {puoScrivere ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              maxLength={2000}
              placeholder="Scrivi un messaggio..."
              className="flex-1 rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted focus:outline-none focus:border-kireo-green"
            />
            <button
              type="submit"
              disabled={invio || !testo.trim()}
              className="rounded-lg bg-kireo-green px-4 py-2 text-sm font-semibold text-kireo-light hover:bg-kireo-green-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {invio ? "…" : "Invia"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-kireo-muted">{notaNonScrivibile ?? "Questa conversazione non è più scrivibile."}</p>
        )}
        {errore && <p className="mt-2 text-xs text-red-400">{errore}</p>}
        {ruolo === "studente" && stato === "aperta" && (
          <button type="button" onClick={bloccaESegnala} disabled={bloccando} className="mt-3 text-xs text-red-300 underline underline-offset-2">
            {bloccando ? "…" : "Blocca e segnala"}
          </button>
        )}
      </div>
    </div>
  );
}
