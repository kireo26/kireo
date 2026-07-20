"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function IscriviTuttiVerificatiButton({ eventoId, studentIds }: { eventoId: string; studentIds: string[] }) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);
  const [fatto, setFatto] = useState(false);

  async function handleClick() {
    if (studentIds.length === 0) return;
    setCaricamento(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("iscrivi_studenti_evento", { p_evento_id: eventoId, p_student_ids: studentIds });
      if (!error) setFatto(true);
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  if (studentIds.length === 0) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      <Button type="button" variant="ghost" onClick={handleClick} disabled={caricamento}>
        {caricamento ? "…" : `Iscrivi tutti i verificati (${studentIds.length})`}
      </Button>
      {fatto && <span className="text-sm text-kireo-green-light">Fatto ✓</span>}
    </div>
  );
}
