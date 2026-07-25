"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function ToggleGestitaRichiesta({ id, gestita }: { id: string; gestita: boolean }) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);

  async function handleClick() {
    setCaricamento(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("richieste_contatto").update({ gestita: !gestita }).eq("id", id);
      if (!error) router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <Button type="button" variant={gestita ? "outline" : "primary"} onClick={handleClick} disabled={caricamento}>
      {caricamento ? "Un momento…" : gestita ? "Segna da gestire" : "Segna come gestita"}
    </Button>
  );
}
