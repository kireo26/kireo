"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { istanteDaOrarioItaliano, orarioItalianoDaIstante } from "@/lib/formato";
import { messaggioSpostaFinestra } from "@/lib/eventi/spostaFinestra";

// SPOSTARE LA FINESTRA DI UNA DIRETTA, dal prodotto (18/10). Quella sera la
// finestra è stata spostata due volte in SQL perché non esisteva nessun'altra
// strada: un ente vero, nella stessa situazione, sarebbe rimasto fermo. Tocca
// SOLO inizio e fine, e lo fa passando da `sposta_finestra_evento` (ente
// organizzatore o admin, mai a diretta chiusa).
//
// Gli orari si leggono e si scrivono IN ORA ITALIANA: un orario di scuola, non
// un orario del browser di chi compila (vedi `istanteDaOrarioItaliano`).
export default function SpostaFinestraForm({
  eventoId,
  dataInizio,
  dataFine,
}: {
  eventoId: string;
  dataInizio: string;
  dataFine: string | null;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inizio, setInizio] = useState(() => orarioItalianoDaIstante(dataInizio));
  const [fine, setFine] = useState(() => (dataFine ? orarioItalianoDaIstante(dataFine) : ""));
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setMessaggio(null);
    const isoInizio = istanteDaOrarioItaliano(inizio);
    const isoFine = istanteDaOrarioItaliano(fine);
    if (!isoInizio || !isoFine) {
      setMessaggio({ ok: false, testo: messaggioSpostaFinestra("date_mancanti") });
      return;
    }
    if (new Date(isoFine).getTime() <= new Date(isoInizio).getTime()) {
      setMessaggio({ ok: false, testo: messaggioSpostaFinestra("fine_prima_di_inizio") });
      return;
    }
    setSalvataggio(true);
    try {
      const { error } = await createClient().rpc("sposta_finestra_evento", {
        p_evento_id: eventoId,
        p_data_inizio: isoInizio,
        p_data_fine: isoFine,
      });
      if (error) {
        console.error("SpostaFinestraForm:", error);
        setMessaggio({ ok: false, testo: messaggioSpostaFinestra(error.message) });
        return;
      }
      setMessaggio({ ok: true, testo: messaggioSpostaFinestra(null) });
      // Il resto della pagina (la console, l'intestazione) legge le date dal
      // server: si ricarica, invece di tenere due copie della finestra.
      router.refresh();
    } catch (err) {
      console.error("SpostaFinestraForm:", err);
      setMessaggio({ ok: false, testo: messaggioSpostaFinestra("eccezione") });
    } finally {
      setSalvataggio(false);
    }
  }

  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className="text-sm text-kireo-orange underline underline-offset-2">
        Sposta l&apos;orario della diretta
      </button>
    );
  }

  return (
    <form onSubmit={salva} className="space-y-3">
      <p className="text-sm font-semibold text-kireo-light">Sposta l&apos;orario della diretta</p>
      <div className="flex flex-wrap gap-4">
        <label className="text-xs text-kireo-muted">
          Inizio (ora italiana)
          <input
            type="datetime-local"
            value={inizio}
            onChange={(e) => setInizio(e.target.value)}
            className="mt-1 block rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
          />
        </label>
        <label className="text-xs text-kireo-muted">
          Fine (ora italiana)
          <input
            type="datetime-local"
            value={fine}
            onChange={(e) => setFine(e.target.value)}
            className="mt-1 block rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
          />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" variant="outline" disabled={salvataggio}>
          {salvataggio ? "Salvataggio…" : "Salva il nuovo orario"}
        </Button>
        <button type="button" onClick={() => setAperto(false)} className="text-xs text-kireo-muted underline underline-offset-2">
          Annulla
        </button>
      </div>
      {messaggio && <p className={`text-xs ${messaggio.ok ? "text-kireo-green-light" : "text-red-400"}`}>{messaggio.testo}</p>}
    </form>
  );
}
