"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { annullaIscrizione, iscriviAEvento } from "@/lib/app/iscrizioneEvento";
import { ETICHETTA_ISCRIVITI, ETICHETTA_ISCRIVITI_ED_ENTRA } from "@/lib/live";

// Stesso principio di IscrivitiEventoButton (area studente), ma senza
// activity_log/recinto_enti: quei concetti restano dello studente, il
// docente si iscrive e basta — iscrizioni_eventi riusa la stessa tabella
// (student_id è una FK verso profiles, non student_profiles, quindi
// funziona per qualunque ruolo).
export default function IscrivitiWebinarButton({
  eventoId,
  userId,
  iscrittoIniziale,
  entraHref,
}: {
  eventoId: string;
  userId: string;
  iscrittoIniziale: boolean;
  /** Webinar IN CORSO: «Iscriviti ed entra», un gesto solo (vedi `faseIscrizione`). */
  entraHref?: string;
}) {
  const router = useRouter();
  const [iscritto, setIscritto] = useState(iscrittoIniziale);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const etichetta = entraHref ? ETICHETTA_ISCRIVITI_ED_ENTRA : ETICHETTA_ISCRIVITI;

  async function handleClick() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      if (iscritto) {
        const esito = await annullaIscrizione(supabase, userId, eventoId);
        if (esito.annullata) setIscritto(false);
        else setErrore(esito.testo);
      } else {
        const esito = await iscriviAEvento(supabase, userId, eventoId);
        if (!esito.ok) {
          setErrore(esito.testo);
        } else {
          setIscritto(true);
          if (entraHref) {
            router.push(entraHref);
            return;
          }
        }
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="flex flex-none flex-col items-end gap-1">
      <Button type="button" variant={iscritto ? "outline" : "primary"} onClick={handleClick} disabled={caricamento} className="flex-none">
        {caricamento ? "Un momento…" : iscritto ? "Iscritto ✓" : etichetta}
      </Button>
      {errore && <p className="max-w-xs text-right text-xs text-red-400">{errore}</p>}
    </div>
  );
}
