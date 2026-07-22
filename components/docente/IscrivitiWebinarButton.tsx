"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Stesso principio di IscrivitiEventoButton (area studente), ma senza
// activity_log/recinto_enti: quei concetti restano dello studente, il
// docente si iscrive e basta — iscrizioni_eventi riusa la stessa tabella
// (student_id è una FK verso profiles, non student_profiles, quindi
// funziona per qualunque ruolo).
export default function IscrivitiWebinarButton({
  eventoId,
  userId,
  iscrittoIniziale,
}: {
  eventoId: string;
  userId: string;
  iscrittoIniziale: boolean;
}) {
  const router = useRouter();
  const [iscritto, setIscritto] = useState(iscrittoIniziale);
  const [caricamento, setCaricamento] = useState(false);

  async function handleClick() {
    setCaricamento(true);
    try {
      const supabase = createClient();
      if (iscritto) {
        const { error } = await supabase.from("iscrizioni_eventi").delete().eq("student_id", userId).eq("evento_id", eventoId);
        if (!error) setIscritto(false);
      } else {
        const { error } = await supabase.from("iscrizioni_eventi").insert({ student_id: userId, evento_id: eventoId });
        if (!error) setIscritto(true);
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
