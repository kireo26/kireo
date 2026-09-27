"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

// La domanda finale, posta DURANTE la diretta. È il momento in cui l'ente è lì e
// sa cosa è stato detto: una domanda decisa alla creazione dell'evento, settimane
// prima, sarebbe una consegna generica.
//
// E dopo la fine della diretta non si cambia più: la consegna è già aperta, e
// cambiare la domanda sotto a chi sta scrivendo è peggio che non averla posta. Il
// rifiuto arriva da `imposta_domanda_consegna` (fuori_finestra_diretta), qui si
// traduce.
export default function DomandaConsegnaForm({ eventoId, domandaAttuale }: { eventoId: string; domandaAttuale: string | null }) {
  const [testo, setTesto] = useState(domandaAttuale ?? "");
  const [salvata, setSalvata] = useState(Boolean(domandaAttuale));
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva() {
    setInvio(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("imposta_domanda_consegna", { p_evento_id: eventoId, p_domanda: testo.trim() });
      if (error) {
        const m = error.message ?? "";
        if (m.includes("fuori_finestra_diretta")) {
          setErrore("La domanda si pone mentre la diretta è aperta: adesso è troppo tardi (o troppo presto).");
        } else if (m.includes("evento_senza_aree")) {
          setErrore(
            "Questo evento non ha nessuna area di orientamento: senza almeno una, la risposta degli studenti non potrebbe portare niente nel loro profilo. Scrivi a KIREO per aggiungerla.",
          );
        } else if (m.includes("non_autorizzato")) {
          setErrore("Non puoi porre la domanda su questo evento.");
        } else {
          setErrore("Non è stato possibile salvare la domanda. Riprova.");
        }
        return;
      }
      setSalvata(true);
    } catch {
      setErrore("Non è stato possibile salvare la domanda. Controlla la connessione e riprova.");
    } finally {
      setInvio(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/5 bg-kireo-dark p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">La domanda finale</p>
      <p className="mt-2 text-xs text-kireo-muted">
        Una domanda aperta sul contenuto di oggi. Gli studenti iscritti che hanno seguito la diretta possono rispondere in KIREO nelle 48 ore
        successive: quello che scrivono resta loro, tu vedi solo che è arrivato.
      </p>

      <label htmlFor={`domanda-${eventoId}`} className="sr-only">
        La domanda finale
      </label>
      <textarea
        id={`domanda-${eventoId}`}
        value={testo}
        onChange={(e) => {
          setTesto(e.target.value.slice(0, 500));
          setSalvata(false);
        }}
        rows={3}
        className="mt-3 w-full rounded-lg border border-white/10 bg-kireo-card p-3 text-sm text-kireo-light outline-none focus:border-kireo-green"
        placeholder="Es. Nel tuo quartiere, quale di questi servizi manca di più, e cosa cambierebbe se ci fosse?"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        {salvata ? (
          <p className="text-xs text-kireo-green-light">Domanda salvata: gli studenti la vedono a diretta conclusa.</p>
        ) : (
          <p className="text-xs text-kireo-muted">{testo.trim().length} / 500 caratteri (minimo 10)</p>
        )}
        <Button type="button" variant="outline" onClick={salva} disabled={invio || testo.trim().length < 10 || salvata}>
          {invio ? "Salvataggio…" : domandaAttuale ? "Aggiorna la domanda" : "Poni la domanda"}
        </Button>
      </div>

      {errore && <p className="mt-2 text-xs text-red-400">{errore}</p>}
    </div>
  );
}
