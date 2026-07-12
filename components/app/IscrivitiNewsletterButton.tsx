"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function IscrivitiNewsletterButton({
  istituzioneId,
  userId,
  iscrittoIniziale,
}: {
  istituzioneId: string;
  userId: string | null;
  iscrittoIniziale: boolean;
}) {
  const pathname = usePathname();
  const [iscritto, setIscritto] = useState(iscrittoIniziale);
  const [caricamento, setCaricamento] = useState(false);

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

  async function handleClick() {
    if (iscritto) return;
    setCaricamento(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("newsletter_iscrizioni")
        .insert({ student_id: userId, istituzione_id: istituzioneId });

      if (!error || error.code === "23505") {
        setIscritto(true);
        await supabase
          .from("recinto_enti")
          .upsert(
            { student_id: userId, istituzione_id: istituzioneId, origine: "newsletter" },
            { onConflict: "student_id,istituzione_id", ignoreDuplicates: true },
          );
      }
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <Button type="button" variant={iscritto ? "outline" : "primary"} onClick={handleClick} disabled={caricamento || iscritto}>
      {iscritto ? "Iscritto ✓" : caricamento ? "Un momento…" : "Iscriviti alla newsletter"}
    </Button>
  );
}
