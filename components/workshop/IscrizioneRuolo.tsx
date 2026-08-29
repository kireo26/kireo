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

// UN RUOLO LO POSSONO FARE PIÙ STUDENTI INSIEME. Fino al 2026-08-30 no: un
// indice unico su (ruolo_id) lo rendeva esclusivo, e qui c'erano un badge
// «Occupato» e dei bottoni disabilitati. Quel vincolo nessuno l'aveva deciso —
// il commento che lo accompagnava diceva di voler chiudere la corsa fra due
// clic della stessa persona, che è un'altra cosa — e teneva l'intera
// piattaforma a venticinque studenti. Ogni studente arrivato a questo punto
// del percorso deve poter cominciare, indipendentemente da cosa fanno gli
// altri.
//
// L'unico vincolo rimasto è una sola iscrizione ATTIVA per studente e
// workshop: non è un impedimento da mostrare in anticipo (chi è già iscritto
// non vede nemmeno questa schermata), è la rete contro la doppia richiesta.
export default function IscrizioneRuolo({
  workshopId,
  studentId,
  ruoli,
}: {
  workshopId: string;
  studentId: string;
  ruoli: Ruolo[];
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
          // Rimasto un solo significato: sei già iscritto a questo workshop.
          setErrore("Risulti già iscritto a questo workshop. Ricarica la pagina per vedere il tuo ruolo.");
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
        Ogni ruolo copre un&apos;area diversa del progetto. Lavori in autonomia, e puoi confrontarti con chi sta facendo il
        workshop insieme a te — anche con chi ha scelto il tuo stesso ruolo.
      </p>

      <div className="mt-5 space-y-2">
        {ruoli.map((ruolo) => {
          const selezionato = ruoloScelto === ruolo.id;
          return (
            <button
              key={ruolo.id}
              type="button"
              onClick={() => setRuoloScelto(ruolo.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                selezionato ? "border-kireo-green bg-kireo-green/10" : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-heading text-sm font-semibold text-kireo-light">{ruolo.titolo}</p>
                  {ruolo.descrizione && <p className="mt-0.5 text-xs text-kireo-muted">{ruolo.descrizione}</p>}
                </div>
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
