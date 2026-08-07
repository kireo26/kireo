"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

type Ruolo = {
  id: string;
  slug: string;
  titolo: string;
  area_slug: string;
  descrizione: string | null;
};

// Un solo studente attivo per ruolo (indice unico parziale lato DB): qui ci
// si limita a nascondere/disabilitare i ruoli già occupati e a intercettare
// la violazione dell'indice come "occupato nel frattempo", non un errore.
export default function IscrizioneRuolo({
  workshopId,
  studentId,
  ruoli,
  ruoliOccupati,
}: {
  workshopId: string;
  studentId: string;
  ruoli: Ruolo[];
  ruoliOccupati: string[];
}) {
  const router = useRouter();
  const [ruoloScelto, setRuoloScelto] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function iscriviti() {
    if (!ruoloScelto) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("workshop_iscrizioni").insert({
        workshop_id: workshopId,
        student_id: studentId,
        ruolo_id: ruoloScelto,
      });
      if (error) {
        if (error.code === "23505") {
          setErrore("Questo ruolo è stato appena preso da un altro studente, oppure sei già iscritto a questo workshop.");
        } else {
          setErrore("Non è stato possibile completare l'iscrizione. Riprova.");
        }
        return;
      }
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Scegli il tuo ruolo</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        Ogni ruolo copre un&apos;area diversa del progetto. Lavori in autonomia ma puoi confrontarti con chi copre le altre
        aree.
      </p>

      <div className="mt-5 space-y-2">
        {ruoli.map((ruolo) => {
          const occupato = ruoliOccupati.includes(ruolo.id);
          const selezionato = ruoloScelto === ruolo.id;
          return (
            <button
              key={ruolo.id}
              type="button"
              onClick={() => !occupato && setRuoloScelto(ruolo.id)}
              disabled={occupato}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                selezionato ? "border-kireo-green bg-kireo-green/10" : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-heading text-sm font-semibold text-kireo-light">{ruolo.titolo}</p>
                  {ruolo.descrizione && <p className="mt-0.5 text-xs text-kireo-muted">{ruolo.descrizione}</p>}
                </div>
                {occupato && (
                  <span className="flex-none rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-kireo-muted">
                    Occupato
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {errore && <p className="mt-4 text-sm text-red-400">{errore}</p>}

      <Button type="button" onClick={iscriviti} disabled={!ruoloScelto || caricamento} className="mt-5 w-full">
        {caricamento ? "Iscrizione in corso…" : "Conferma e inizia il workshop"}
      </Button>
    </div>
  );
}
