"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function DisattivaStaffButton({ staffId, attivo }: { staffId: string; attivo: boolean }) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);

  async function handleClick() {
    setCaricamento(true);
    try {
      const supabase = createClient();
      await supabase.from("school_staff").update({ attivo: !attivo }).eq("id", staffId);
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={caricamento}>
      {caricamento ? "…" : attivo ? "Disattiva" : "Riattiva"}
    </Button>
  );
}
