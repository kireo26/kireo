"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generaCsvSezioni } from "@/lib/csv";
import { sezioniReportEnte } from "@/lib/eventi/exportPresenze";

// Report aggregato per l'organizzatore: MAI un nome, MAI un id. Le due RPC
// (report_evento_aggregato/report_evento_distribuzione) fanno già tutto il
// lavoro di aggregazione e soppressione k=5 lato DB — qui si genera solo
// il CSV dal risultato, interamente client-side (nessun dato individuale
// transita mai, quindi nessun bisogno di una route server dedicata).
export default function ReportEventoButton({
  eventoId,
  titolo,
  dataInizio,
  dataFine,
}: {
  eventoId: string;
  titolo: string;
  dataInizio: string | null;
  dataFine: string | null;
}) {
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function scaricaReport() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const [{ data: aggregato, error: erroreAggregato }, { data: distribuzione, error: erroreDistribuzione }] = await Promise.all([
        supabase.rpc("report_evento_aggregato", { p_evento_id: eventoId }),
        supabase.rpc("report_evento_distribuzione", { p_evento_id: eventoId }),
      ]);

      if (erroreAggregato || erroreDistribuzione || !aggregato) {
        setErrore("Non è stato possibile generare il report. Riprova.");
        return;
      }

      const riga = Array.isArray(aggregato) ? aggregato[0] : aggregato;

      const csv = generaCsvSezioni(
        sezioniReportEnte({ titolo, data_inizio: dataInizio, data_fine: dataFine }, riga, distribuzione ?? []),
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-evento-${eventoId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={scaricaReport} disabled={caricamento} className="text-xs text-kireo-orange underline underline-offset-2">
        {caricamento ? "Generazione…" : "Scarica report aggregato (CSV)"}
      </button>
      {errore && <p className="mt-1 text-xs text-red-400">{errore}</p>}
    </div>
  );
}
