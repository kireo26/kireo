"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { esitoDelega, PERMESSI, TESTI_DELEGA, testoConfermaDelega, type Permesso } from "@/lib/scuola/delega";

// Toggle immediato dei 4 permessi delegabili al tutor (governati lato DB da
// current_ha_permesso_staff, vedi 20260715110000): un cambio qui prende
// effetto subito, anche per un invito non ancora riscattato (i permessi
// restano sulla riga school_staff e valgono dal primo accesso del tutor).
// Mai gestione staff né stato scuola: non delegabili per costruzione,
// nessun toggle per quelli esiste in questo componente.
//
// 01/11: la casella si gira solo sul valore riletto, e sotto una riga dice cosa
// è cambiato (lib/scuola/delega.ts).
export default function TogglePermessiTutor({
  staffId,
  nome,
  permessiIniziali,
}: {
  staffId: string;
  nome: string | null;
  permessiIniziali: Record<Permesso, boolean>;
}) {
  const router = useRouter();
  const [permessi, setPermessi] = useState(permessiIniziali);
  const [caricamento, setCaricamento] = useState<Permesso | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [conferma, setConferma] = useState<string | null>(null);

  async function toggle(chiave: Permesso) {
    const nuovoValore = !permessi[chiave];
    setCaricamento(chiave);
    setErrore(null);
    setConferma(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("school_staff")
        .update({ [chiave]: nuovoValore })
        .eq("id", staffId)
        .select(chiave);
      if (error) {
        console.error("[scuola] delega:", descriviErrore(error));
        setErrore(TESTI_DELEGA.errore);
        return;
      }
      const esito = esitoDelega(data, chiave, nuovoValore);
      if (esito.esito !== "salvato") {
        console.error("[scuola] delega non atterrata:", esito.esito, staffId, chiave);
        setErrore(TESTI_DELEGA.nonToccato);
        return;
      }
      setPermessi((prev) => ({ ...prev, [chiave]: esito.valore }));
      setConferma(testoConfermaDelega(nome, chiave, esito.valore));
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
      {PERMESSI.map(({ chiave, label }) => (
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
      {conferma && (
        <p role="status" className="mt-1 w-full text-xs text-kireo-green-light">
          {conferma}
        </p>
      )}
      {errore && <p className="mt-1 w-full text-xs text-red-400">{errore}</p>}
    </div>
  );
}
