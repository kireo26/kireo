"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Bottone "Richiedi l'upgrade" su un piano superiore: si espande in un
// piccolo form con una nota facoltativa invece di aprire una pagina a sé,
// coerente con la leggerezza delle altre azioni self-service dell'area
// ente. Nessun pagamento: crea solo una richiesta in_attesa che KIREO
// approva manualmente (vedi /admin).
export default function RichiediUpgradeButton({
  istituzioneId,
  pianoId,
  pianoNomeLabel,
}: {
  istituzioneId: string;
  pianoId: string;
  pianoNomeLabel: string;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [nota, setNota] = useState("");
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleInvia() {
    setInviando(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("richieste_upgrade").insert({
        istituzione_id: istituzioneId,
        piano_richiesto_id: pianoId,
        note: nota.trim() || null,
        stato: "in_attesa",
      });

      if (error) {
        // Vincolo "una sola richiesta in_attesa per istituzione": può
        // succedere con due tab aperte in contemporanea.
        if (error.code === "23505") {
          setErrore("Hai già una richiesta di upgrade in corso.");
        } else {
          setErrore("Non è stato possibile inviare la richiesta. Riprova più tardi.");
        }
        return;
      }

      router.refresh();
    } catch {
      setErrore("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setInviando(false);
    }
  }

  if (!aperto) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={() => setAperto(true)}>
        Richiedi l&apos;upgrade a {pianoNomeLabel}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        placeholder="Qualcosa da segnalare a KIREO? (facoltativo)"
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      {errore && <p className="text-sm text-red-400">{errore}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="primary" className="flex-1" onClick={handleInvia} disabled={inviando}>
          {inviando ? "Invio…" : "Conferma richiesta"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAperto(false)} disabled={inviando}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
