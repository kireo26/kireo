"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Aperto a tutti gli studenti, anche minorenni: seguire un ente non
// condivide alcun dato individuale (vedi CLAUDE.md/migration seguiti).
export default function SeguiButton({
  istituzioneId,
  userId,
  seguitoIniziale,
}: {
  istituzioneId: string;
  userId: string | null;
  seguitoIniziale: boolean;
}) {
  const pathname = usePathname();
  const [seguito, setSeguito] = useState(seguitoIniziale);
  const [caricamento, setCaricamento] = useState(false);

  if (!userId) {
    return (
      <Link
        href={`/accedi?redirectedFrom=${encodeURIComponent(pathname)}`}
        className="inline-flex items-center justify-center rounded-full bg-kireo-green px-5 py-2.5 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
      >
        Segui
      </Link>
    );
  }

  async function handleClick() {
    setCaricamento(true);
    try {
      const supabase = createClient();
      if (seguito) {
        const { error } = await supabase.from("seguiti").delete().eq("student_id", userId as string).eq("istituzione_id", istituzioneId);
        if (!error) setSeguito(false);
      } else {
        const { error } = await supabase.from("seguiti").insert({ student_id: userId, istituzione_id: istituzioneId });
        if (!error) setSeguito(true);
      }
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <Button type="button" variant={seguito ? "outline" : "primary"} onClick={handleClick} disabled={caricamento}>
      {caricamento ? "Un momento…" : seguito ? "Seguito ✓" : "Segui"}
    </Button>
  );
}
