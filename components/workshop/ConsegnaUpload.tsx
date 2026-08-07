"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { registraAttivita } from "@/lib/app/activityLog";

type FeedbackAI = {
  punti_forza: string[];
  aree_miglioramento: string[];
  domanda_stimolante: string;
};

type Consegna = {
  id: string;
  file_nome: string;
  file_dimensione: number;
  stato: "caricato" | "analizzato";
  feedback_ai: FeedbackAI | null;
  created_at: string;
  signedUrl: string | null;
};

const MAX_MB = 10;

function formattaDimensione(byte: number) {
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ConsegnaUpload({
  iscrizioneId,
  workshopTitolo,
  ruoloSlug,
  areaSlug,
  consegneEsistenti,
}: {
  iscrizioneId: string;
  workshopTitolo: string;
  ruoloSlug: string;
  areaSlug: string;
  consegneEsistenti: Consegna[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setErrore(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrore(`Il file supera i ${MAX_MB} MB consentiti.`);
      return;
    }
    setInviando(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("iscrizioneId", iscrizioneId);
      formData.append("ruoloSlug", ruoloSlug);
      formData.append("workshopTitolo", workshopTitolo);

      const res = await fetch("/api/workshop/consegna", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErrore(data.errore ?? "Non è stato possibile caricare il file.");
        return;
      }

      await registraAttivita(areaSlug, "workshop_pcto");
      setFile(null);
      router.refresh();
    } catch {
      setErrore("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setInviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Carica la tua consegna</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        Rispondi alla domanda del tuo kit materiali con un documento o un&apos;immagine (PDF, PNG, JPG, PPTX, DOCX — max {MAX_MB}{" "}
        MB). Ricevi un feedback automatico appena carichi il file.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.pptx,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 text-sm text-kireo-light file:mr-3 file:rounded-full file:border-0 file:bg-kireo-green file:px-4 file:py-2 file:text-sm file:font-semibold file:text-kireo-light"
        />
        <Button type="submit" disabled={!file || inviando} className="flex-none">
          {inviando ? "Caricamento…" : "Carica"}
        </Button>
      </form>
      {errore && <p className="mt-2 text-sm text-red-400">{errore}</p>}

      {consegneEsistenti.length > 0 && (
        <ul className="mt-6 space-y-4 border-t border-white/5 pt-5">
          {consegneEsistenti.map((consegna) => (
            <li key={consegna.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {consegna.signedUrl ? (
                  <a href={consegna.signedUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-kireo-orange underline underline-offset-2">
                    {consegna.file_nome}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-kireo-light">{consegna.file_nome}</span>
                )}
                <span className="text-xs text-kireo-muted">
                  {formattaDimensione(consegna.file_dimensione)} ·{" "}
                  {new Date(consegna.created_at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>

              {consegna.feedback_ai ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-kireo-green-light">Punti di forza</p>
                    <ul className="mt-1 list-inside list-disc text-kireo-light/90">
                      {consegna.feedback_ai.punti_forza.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">Da migliorare</p>
                    <ul className="mt-1 list-inside list-disc text-kireo-light/90">
                      {consegna.feedback_ai.aree_miglioramento.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="rounded-lg bg-white/5 px-3 py-2 text-kireo-light/90">{consegna.feedback_ai.domanda_stimolante}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-kireo-muted">Nessun feedback automatico disponibile per questo file.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
