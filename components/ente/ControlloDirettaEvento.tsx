"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

type Domanda = { id: string; testo: string; stato: string; creata_il: string; nome_completo: string | null };

// Pannello di controllo diretta per l'organizzatore: SOLO aggregati
// (conteggio_presenti_live) e domande — mai una riga individuale di
// presenze_live, mai user_id (domande_live_organizzatore lo garantisce
// per costruzione lato server, vedi la migration). Le classi in modalità
// DAD non sono toccate: nessun heartbeat individuale, la certificazione
// resta manuale della scuola (nota esplicita in fondo).
export default function ControlloDirettaEvento({ eventoId }: { eventoId: string }) {
  const [presenti, setPresenti] = useState<number | null>(null);
  const [domande, setDomande] = useState<Domanda[]>([]);
  const [caricamento, setCaricamento] = useState(false);
  const [erroreChiusura, setErroreChiusura] = useState<string | null>(null);
  const [risultatoChiusura, setRisultatoChiusura] = useState<{ presenti: number; certificati: number } | null>(null);

  const aggiorna = useCallback(async () => {
    const supabase = createClient();
    const [{ data: n }, { data: d }] = await Promise.all([
      supabase.rpc("conteggio_presenti_live", { p_evento_id: eventoId }),
      supabase.rpc("domande_live_organizzatore", { p_evento_id: eventoId }),
    ]);
    if (typeof n === "number") setPresenti(n);
    if (d) setDomande(d as Domanda[]);
  }, [eventoId]);

  useEffect(() => {
    aggiorna();
    const intervallo = setInterval(aggiorna, 15000);
    return () => clearInterval(intervallo);
  }, [aggiorna]);

  async function segnaStato(domandaId: string, stato: string) {
    const supabase = createClient();
    await supabase.rpc("aggiorna_stato_domanda_live", { p_domanda_id: domandaId, p_stato: stato });
    aggiorna();
  }

  async function chiudiDiretta() {
    setCaricamento(true);
    setErroreChiusura(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("chiudi_diretta_evento", { p_evento_id: eventoId });
      const riga = Array.isArray(data) ? data[0] : data;
      if (error || !riga) {
        if (error?.message?.includes("evento_ancora_in_corso")) {
          setErroreChiusura("L'evento non è ancora terminato: puoi chiudere la diretta solo dopo l'orario di fine.");
        } else if (error?.message?.includes("evento_senza_data_fine")) {
          setErroreChiusura("Questo evento non ha una data di fine impostata: impossibile calcolare le presenze.");
        } else {
          setErroreChiusura("Non è stato possibile chiudere la diretta. Riprova.");
        }
        return;
      }
      setRisultatoChiusura(riga);
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
      <p className="text-sm text-kireo-light">
        Presenti ora: <strong>{presenti ?? "…"}</strong>
      </p>

      {domande.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Domande ({domande.length})</p>
          <ul className="space-y-2">
            {domande.map((d) => (
              <li key={d.id} className="rounded-lg border border-white/5 bg-kireo-dark p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {d.nome_completo && <p className="text-xs font-semibold text-kireo-orange">{d.nome_completo}</p>}
                    <p className="text-sm text-kireo-light/90">{d.testo}</p>
                  </div>
                  <div className="flex flex-none gap-3">
                    {d.stato === "nuova" && (
                      <button type="button" onClick={() => segnaStato(d.id, "letta")} className="text-xs text-kireo-orange underline underline-offset-2">
                        Segna letta
                      </button>
                    )}
                    {d.stato !== "risposta_live" && (
                      <button
                        type="button"
                        onClick={() => segnaStato(d.id, "risposta_live")}
                        className="text-xs text-kireo-green-light underline underline-offset-2"
                      >
                        Risposta data
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {risultatoChiusura ? (
        <p className="rounded-lg border border-kireo-green/40 bg-kireo-green/10 px-4 py-3 text-sm text-kireo-light">
          Diretta chiusa: {risultatoChiusura.presenti} presenti, {risultatoChiusura.certificati} nuove certificazioni automatiche.
        </p>
      ) : (
        <div>
          <Button type="button" variant="outline" onClick={chiudiDiretta} disabled={caricamento}>
            {caricamento ? "Chiusura…" : "Concludi diretta e certifica presenze"}
          </Button>
          {erroreChiusura && <p className="mt-2 text-xs text-red-400">{erroreChiusura}</p>}
        </div>
      )}

      <p className="text-xs text-kireo-muted">
        Le iscrizioni di classe in modalità DAD non sono coperte dall&apos;heartbeat: per quegli studenti la certificazione resta manuale, a cura della
        scuola.
      </p>
    </div>
  );
}
