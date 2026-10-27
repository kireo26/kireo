"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { testoEsitoIscrizione } from "@/lib/scuola/esitoIscrizione";

export default function IscriviTuttiVerificatiButton({ eventoId, studentIds }: { eventoId: string; studentIds: string[] }) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);
  const [esito, setEsito] = useState<{ testo: string; avviso: boolean } | null>(null);

  async function handleClick() {
    if (studentIds.length === 0) return;
    setCaricamento(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("iscrivi_studenti_evento", { p_evento_id: eventoId, p_student_ids: studentIds });
      // Prima un errore non diceva niente: il bottone tornava com'era.
      if (error) {
        console.error("[scuola] iscrivi_studenti_evento:", descriviErrore(error));
        setEsito({ testo: "Non è stato possibile iscrivere gli studenti. Riprova.", avviso: true });
        return;
      }
      setEsito(testoEsitoIscrizione(data));
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  if (studentIds.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button type="button" variant="ghost" onClick={handleClick} disabled={caricamento}>
        {caricamento ? "…" : `Iscrivi tutti i verificati (${studentIds.length})`}
      </Button>
      {esito && <span className={`text-sm ${esito.avviso ? "text-kireo-orange" : "text-kireo-green-light"}`}>{esito.testo}</span>}
    </div>
  );
}
