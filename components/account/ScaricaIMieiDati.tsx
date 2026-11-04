"use client";

// «Scarica i miei dati», spostato dal profilo dello studente alla pagina
// dell'account (02/11): lo studente ci arriva dal suo profilo, non ne ha una
// seconda copia. Oggi esiste solo per lo studente: per gli altri ruoli il file
// non è costruito, e la pagina lo dice (`TESTI_ACCOUNT.esportaNonDisponibile`).

import { useState } from "react";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { SEZIONI_EXPORT, assemblaEsportazione, TESTO_NESSUN_FILE, type EsitoSezione } from "@/lib/app/esportaDati";
import { descriviErrore } from "@/lib/erroreSupabase";

export default function ScaricaIMieiDati({ userId }: { userId: string }) {
  const [esportando, setEsportando] = useState(false);
  const [erroreEsportazione, setErroreEsportazione] = useState<string | null>(null);

  // Le sezioni vengono da `SEZIONI_EXPORT` e il file lo compone
  // `assemblaEsportazione`: qui resta solo il giro di rete e lo scaricamento.
  // Vedi `lib/app/esportaDati.ts` per la forma del file e per il difetto che
  // l'ha fatta scrivere — un `?? []` che affermava «zero prenotazioni» per
  // una tabella che non esiste da luglio.
  async function handleScaricaDati() {
    setEsportando(true);
    setErroreEsportazione(null);
    try {
      const supabase = createClient();
      const risposte = await Promise.all(
        SEZIONI_EXPORT.map(async (s): Promise<EsitoSezione> => {
          const query = supabase.from(s.tabella).select(s.select).eq(s.colonna, userId);
          const { data, error } = s.singola ? await query.maybeSingle() : await query;
          if (error) {
            // Il browser non può registrare un guasto (`registra_guasto` è
            // solo service-role), quindi questa riga è l'unica traccia che
            // resta: senza, una query morta vive tre mesi.
            console.error(`Export dati, sezione ${s.chiave} (${s.tabella}):`, descriviErrore(error));
            return { ottenuta: false, motivo: error.code ?? "errore" };
          }
          return { ottenuta: true, dati: data };
        }),
      );

      // L'indirizzo sta in auth, non in `profiles`: lo legge il server dalla
      // sessione (getUser), non il browser dalla sua copia locale.
      const { data: utente } = await supabase.auth.getUser();
      const esito = assemblaEsportazione(risposte, utente?.user?.email ?? null);
      if (esito.file === null) {
        setErroreEsportazione(TESTO_NESSUN_FILE);
        return;
      }

      const blob = new Blob([esito.file], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kireo-i-miei-dati.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (errore) {
      console.error("Export dati, non è stato possibile preparare il file:", errore);
      setErroreEsportazione(TESTO_NESSUN_FILE);
    } finally {
      setEsportando(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="outline" onClick={handleScaricaDati} disabled={esportando}>
        {esportando ? "Preparazione…" : "Scarica i miei dati"}
      </Button>
      {erroreEsportazione ? (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{erroreEsportazione}</p>
      ) : null}
    </div>
  );
}
