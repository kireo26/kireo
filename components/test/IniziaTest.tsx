"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";

// Crea un test_attempt per lo studente e ricarica la pagina (che poi renderà il
// player). L'indice unico parziale in DB garantisce un solo tentativo attivo per
// (studente, test). Gemello di IniziaMissione.
export default function IniziaTest({ testSlug, etichetta = "Inizia il test" }: { testSlug: string; etichetta?: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function inizia() {
    setErrore(null);
    setInCorso(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErrore("Sessione scaduta. Ricarica la pagina.");
        return;
      }
      const { error } = await supabase.from("test_attempt").insert({ student_id: user.id, test_slug: testSlug });
      if (error) throw error;
      router.refresh();
    } catch {
      setErrore("Non è stato possibile avviare il test. Riprova.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={inizia} disabled={inCorso}>
        {inCorso ? "…" : etichetta}
      </Button>
      {errore && <p className="mt-2 text-sm text-red-400">{errore}</p>}
    </div>
  );
}
