"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function PrenotaWebinarButton({
  webinarId,
  userId,
  prenotatoIniziale,
}: {
  webinarId: string;
  userId: string;
  prenotatoIniziale: boolean;
}) {
  const router = useRouter();
  const [prenotato, setPrenotato] = useState(prenotatoIniziale);
  const [caricamento, setCaricamento] = useState(false);

  async function handleClick() {
    setCaricamento(true);
    try {
      const supabase = createClient();
      if (prenotato) {
        const { error } = await supabase
          .from("webinar_registrations")
          .delete()
          .eq("user_id", userId)
          .eq("webinar_id", webinarId);
        if (!error) setPrenotato(false);
      } else {
        const { error } = await supabase.from("webinar_registrations").insert({ user_id: userId, webinar_id: webinarId });
        if (!error) setPrenotato(true);
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <Button type="button" variant={prenotato ? "outline" : "primary"} onClick={handleClick} disabled={caricamento} className="flex-none">
      {caricamento ? "Un momento…" : prenotato ? "Prenotato ✓" : "Prenota il posto"}
    </Button>
  );
}
