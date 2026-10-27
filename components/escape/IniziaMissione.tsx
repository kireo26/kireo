"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

// Crea un mission_attempt per lo studente e ricarica la pagina (che poi renderà
// il player). L'indice unico parziale in DB garantisce un solo tentativo attivo
// per (studente, missione).
export default function IniziaMissione({ missionSlug, etichetta = "Inizia la missione" }: { missionSlug: string; etichetta?: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function inizia() {
    setErrore(null);
    setInCorso(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErrore("Sessione scaduta. Ricarica la pagina.");
        return;
      }
      const { error } = await supabase.from("mission_attempt").insert({ student_id: user.id, mission_slug: missionSlug });
      if (error) {
        // Il tetto dei tentativi al giorno (20261104140000): un rifiuto che sa
        // cosa è dice quando tornare, invece di «Riprova».
        if (error.message?.includes("troppi_tentativi_missione_oggi")) {
          setErrore("Per oggi hai aperto tutte le missioni che si possono aprire in un giorno. Puoi tornare domani: quelle già iniziate restano aperte e le puoi finire.");
          return;
        }
        throw error;
      }
      router.refresh();
    } catch {
      setErrore("Non è stato possibile avviare la missione. Riprova.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={inizia} disabled={inCorso}>
        {inCorso ? "…" : etichetta}
      </Button>
      {errore && <p className="mt-2 text-sm text-red-400">{errore}</p>}
    </div>
  );
}
