"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { registraAttivita } from "@/lib/app/activityLog";

export default function IscrivitiEventoButton({
  eventoId,
  areaSlug,
  organizzatoreId,
  userId,
  iscrittoIniziale,
}: {
  eventoId: string;
  areaSlug: string | null;
  organizzatoreId?: string | null;
  userId: string | null;
  iscrittoIniziale: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [iscritto, setIscritto] = useState(iscrittoIniziale);
  const [caricamento, setCaricamento] = useState(false);

  // Visitatore non autenticato: non possiamo scrivere iscrizioni_eventi
  // (RLS richiede auth.uid()), lo mandiamo ad accedere prima.
  if (!userId) {
    return (
      <Link
        href={`/accedi?redirectedFrom=${encodeURIComponent(pathname)}`}
        className="inline-flex flex-none items-center justify-center rounded-full bg-kireo-green px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
      >
        Iscriviti
      </Link>
    );
  }

  async function handleClick() {
    setCaricamento(true);
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
        if (!error) {
          setIscritto(true);
          if (areaSlug) registraAttivita(areaSlug, "iscrizione_webinar");
          if (organizzatoreId) {
            await supabase
              .from("recinto_enti")
              .upsert(
                { student_id: userId, istituzione_id: organizzatoreId, origine: "evento" },
                { onConflict: "student_id,istituzione_id", ignoreDuplicates: true },
              );
          }
        }
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <Button type="button" variant={iscritto ? "outline" : "primary"} onClick={handleClick} disabled={caricamento} className="flex-none">
      {caricamento ? "Un momento…" : iscritto ? "Iscritto ✓" : "Iscriviti"}
    </Button>
  );
}
