"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { segnaNelRecinto } from "@/lib/app/recinto";
import { registraAttivita } from "@/lib/app/activityLog";
import { ETICHETTA_ISCRIVITI, ETICHETTA_ISCRIVITI_ED_ENTRA } from "@/lib/live";

export default function IscrivitiEventoButton({
  eventoId,
  areaSlug,
  organizzatoreId,
  userId,
  iscrittoIniziale,
  entraHref,
}: {
  eventoId: string;
  areaSlug: string | null;
  organizzatoreId?: string | null;
  userId: string | null;
  iscrittoIniziale: boolean;
  /** Diretta IN CORSO: il bottone dice «Iscriviti ed entra» e, iscritti, porta
   *  qui in un gesto solo (decisione di Mario, vedi `faseIscrizione` in lib/live.ts). */
  entraHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [iscritto, setIscritto] = useState(iscrittoIniziale);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState(false);
  const etichetta = entraHref ? ETICHETTA_ISCRIVITI_ED_ENTRA : ETICHETTA_ISCRIVITI;

  // Visitatore non autenticato: non possiamo scrivere iscrizioni_eventi
  // (RLS richiede auth.uid()), lo mandiamo ad accedere prima.
  if (!userId) {
    return (
      <Link
        href={`/accedi?redirectedFrom=${encodeURIComponent(pathname)}`}
        className="inline-flex flex-none items-center justify-center rounded-full bg-kireo-green px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
      >
        {etichetta}
      </Link>
    );
  }

  async function handleClick() {
    setCaricamento(true);
    setErrore(false);
    try {
      const supabase = createClient();
      if (iscritto) {
        const { error } = await supabase
          .from("iscrizioni_eventi")
          .delete()
          .eq("student_id", userId as string)
          .eq("evento_id", eventoId);
        if (!error) setIscritto(false);
      } else {
        const { error } = await supabase
          .from("iscrizioni_eventi")
          .insert({ student_id: userId, evento_id: eventoId });
        if (error) {
          // Un'iscrizione che non riesce non resta muta: per un ritardatario
          // a diretta cominciata il silenzio è di nuovo una card che non dice
          // niente.
          console.error("IscrivitiEventoButton: iscrizione non riuscita", error);
          setErrore(true);
        } else {
          setIscritto(true);
          if (areaSlug) registraAttivita(areaSlug, "iscrizione_webinar");
          if (userId && organizzatoreId) {
            await segnaNelRecinto(supabase, userId, organizzatoreId, "evento");
          }
          // Un gesto solo: iscritti, si entra.
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
      {errore && <p className="text-xs text-red-400">Non siamo riusciti a iscriverti. Riprova fra un momento.</p>}
    </div>
  );
}
