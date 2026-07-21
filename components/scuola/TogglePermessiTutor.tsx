"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Permesso = "puo_verificare_studenti" | "puo_gestire_classi" | "puo_certificare_presenze" | "puo_inviare_comunicazioni";

const ETICHETTE: { chiave: Permesso; label: string }[] = [
  { chiave: "puo_verificare_studenti", label: "Verificare studenti" },
  { chiave: "puo_gestire_classi", label: "Gestire classi" },
  { chiave: "puo_certificare_presenze", label: "Certificare presenze" },
  { chiave: "puo_inviare_comunicazioni", label: "Inviare comunicazioni" },
];

// Toggle immediato dei 4 permessi delegabili al tutor (governati lato DB da
// current_ha_permesso_staff, vedi 20260715110000): un cambio qui prende
// effetto subito, anche per un invito non ancora riscattato (i permessi
// restano sulla riga school_staff e valgono dal primo accesso del tutor).
// Mai gestione staff né stato scuola: non delegabili per costruzione,
// nessun toggle per quelli esiste in questo componente.
export default function TogglePermessiTutor({
  staffId,
  permessiIniziali,
}: {
  staffId: string;
  permessiIniziali: Record<Permesso, boolean>;
}) {
  const router = useRouter();
  const [permessi, setPermessi] = useState(permessiIniziali);
  const [caricamento, setCaricamento] = useState<Permesso | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function toggle(chiave: Permesso) {
    const nuovoValore = !permessi[chiave];
    setCaricamento(chiave);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("school_staff")
        .update({ [chiave]: nuovoValore })
        .eq("id", staffId);
      if (error) {
        setErrore("Non è stato possibile aggiornare il permesso.");
        return;
      }
      setPermessi((prev) => ({ ...prev, [chiave]: nuovoValore }));
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
      {ETICHETTE.map(({ chiave, label }) => (
        <label key={chiave} className="flex items-center gap-1.5 text-xs text-kireo-light/90">
          <input
            type="checkbox"
            checked={permessi[chiave]}
            onChange={() => toggle(chiave)}
            disabled={caricamento !== null}
            className="h-3.5 w-3.5 rounded border-white/20 bg-kireo-dark accent-kireo-green"
          />
          {label}
        </label>
      ))}
      {errore && <p className="mt-1 w-full text-xs text-red-400">{errore}</p>}
    </div>
  );
}
