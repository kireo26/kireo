"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { segnaNelRecinto } from "@/lib/app/recinto";
import type { StatoEta } from "@/lib/eta";
import { descriviErrore } from "@/lib/erroreSupabase";

export default function IscrivitiNewsletterButton({
  istituzioneId,
  userId,
  iscrittoIniziale,
  eta,
}: {
  istituzioneId: string;
  userId: string | null;
  iscrittoIniziale: boolean;
  // Letto dalla pagina sul profilo di chi guarda, in tre stati (lib/eta.ts).
  // Obbligatorio apposta: un default farebbe ricomparire il bottone a chi non
  // riceverà niente.
  eta: StatoEta;
}) {
  const pathname = usePathname();
  const [iscritto, setIscritto] = useState(iscrittoIniziale);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState(false);

  if (!userId) {
    return (
      <Link
        href={`/accedi?redirectedFrom=${encodeURIComponent(pathname)}`}
        className="inline-flex items-center justify-center rounded-full bg-kireo-green px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
      >
        Iscriviti alla newsletter
      </Link>
    );
  }

  // Dove l'età non basta, o non la sappiamo, il bottone non compare, e la
  // pagina dice perché SOTTO la fila dei tre gesti, PRIMA del clic (Mario,
  // 28/10: una fila di tre bottoni va disegnata sapendo che per molti uno dei
  // tre non è un bottone). Un'iscrizione da minorenne non vale nemmeno a 18
  // anni, perché il consenso si chiede allora e non si eredita
  // (consenso_dato_da_maggiorenne, 20261107110000). Il cancello vero sta
  // sull'invio; questo è solo non invitare a un gesto che non porta niente.
  // Ma chi è GIÀ iscritto vede l'uscita: un'uscita non si nasconde mai dietro
  // una regola sull'entrata.
  if (eta !== "maggiorenne" && !iscritto) return null;

  // Dove si entra con un clic si esce con un clic (Mario, 28/10): «Iscritto ✓»
  // era un bottone spento, e l'uscita stava solo nel profilo.
  async function handleClick() {
    setCaricamento(true);
    setErrore(false);
    try {
      const supabase = createClient();
      if (iscritto) {
        // .select(): zero righe tolte è un rifiuto, non un'uscita (il modo 11).
        const { data, error } = await supabase
          .from("newsletter_iscrizioni")
          .delete()
          .eq("student_id", userId as string)
          .eq("istituzione_id", istituzioneId)
          .select("id");
        if (error || !data || data.length === 0) {
          if (error) console.error("Uscita dalla newsletter:", descriviErrore(error));
          setErrore(true);
          return;
        }
        setIscritto(false);
        return;
      }
      const { error } = await supabase
        .from("newsletter_iscrizioni")
        .insert({ student_id: userId, istituzione_id: istituzioneId });

      if (!error || error.code === "23505") {
        setIscritto(true);
        if (userId) await segnaNelRecinto(supabase, userId, istituzioneId, "newsletter");
      } else {
        console.error("Iscrizione alla newsletter:", descriviErrore(error));
        setErrore(true);
      }
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant={iscritto ? "outline" : "primary"} onClick={handleClick} disabled={caricamento}>
        {caricamento ? "Un momento…" : iscritto ? "Iscritto alla newsletter ✓ — Esci" : "Iscriviti alla newsletter"}
      </Button>
      {errore && (
        <p className="text-xs text-red-400">
          {iscritto ? "Non siamo riusciti a toglierti dalla newsletter: riprova." : "Non siamo riusciti a iscriverti: riprova."}
        </p>
      )}
    </div>
  );
}
