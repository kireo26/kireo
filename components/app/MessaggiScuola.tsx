"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type MessaggioRicevuto = {
  id: string;
  oggetto: string;
  corpo: string;
  createdAt: string;
  lettoIl: string | null;
};

// "Campanella" dei messaggi ricevuti dalla scuola: comunicazioni interne
// (mai revisionate da KIREO, la scuola le invia direttamente ai propri
// studenti). Segnare come letto aggiorna solo la propria riga.
export default function MessaggiScuola({ messaggiIniziali }: { messaggiIniziali: MessaggioRicevuto[] }) {
  const [messaggi, setMessaggi] = useState(messaggiIniziali);
  const [aperto, setAperto] = useState<string | null>(null);

  async function segnaLetto(id: string) {
    setMessaggi((prev) => prev.map((m) => (m.id === id ? { ...m, lettoIl: m.lettoIl ?? new Date().toISOString() } : m)));
    const supabase = createClient();
    await supabase.from("messaggi_scuola_destinatari").update({ letto_il: new Date().toISOString() }).eq("messaggio_id", id);
  }

  if (messaggi.length === 0) return null;

  const nonLetti = messaggi.filter((m) => !m.lettoIl).length;

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Messaggi dalla tua scuola</h2>
        {nonLetti > 0 && (
          <span className="rounded-full bg-kireo-orange/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-orange">{nonLetti} da leggere</span>
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {messaggi.map((m) => (
          <li key={m.id} className="rounded-xl border border-white/5 bg-kireo-dark/40 p-3">
            <button
              type="button"
              onClick={() => {
                setAperto(aperto === m.id ? null : m.id);
                if (!m.lettoIl) segnaLetto(m.id);
              }}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2">
                {!m.lettoIl && <span className="h-2 w-2 flex-none rounded-full bg-kireo-orange" aria-hidden="true" />}
                <span className="font-heading text-sm font-semibold text-kireo-light">{m.oggetto}</span>
              </span>
              <span className="flex-none text-xs text-kireo-muted">{new Date(m.createdAt).toLocaleDateString("it-IT", { dateStyle: "medium" })}</span>
            </button>
            {aperto === m.id && <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/80">{m.corpo}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
