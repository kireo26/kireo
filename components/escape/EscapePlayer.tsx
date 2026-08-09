"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EscapeMission, Payload, Step } from "@/lib/escape/tipi";
import { Button } from "@/components/Button";
import StepInput from "./StepInput";

type RispostaSalvata = { step_id: string; payload: Payload };

// Player delle 5 stanze: uno step alla volta, salva ogni risposta in
// step_response (upsert, riprendibile), avanza stanza_corrente, e all'ultimo
// step chiama /api/escape/finalizza. Nessun cronometro, nessuna sconfitta.
export default function EscapePlayer({
  mission,
  attemptId,
  risposteIniziali,
}: {
  mission: EscapeMission;
  attemptId: string;
  risposteIniziali: RispostaSalvata[];
}) {
  const router = useRouter();
  const steps: Step[] = useMemo(() => mission.stanze.flatMap((s) => s.step), [mission]);

  const [risposte, setRisposte] = useState<Record<string, Payload>>(() => {
    const r: Record<string, Payload> = {};
    for (const x of risposteIniziali) r[x.step_id] = x.payload;
    return r;
  });

  const primoNonRisposto = steps.findIndex((s) => !(s.id in risposte));
  const [indice, setIndice] = useState(primoNonRisposto === -1 ? steps.length - 1 : primoNonRisposto);
  const [corrente, setCorrente] = useState<Payload | null>(risposte[steps[Math.max(0, indice)]?.id] ?? null);
  const [valido, setValido] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const step = steps[indice];
  const stanza = mission.stanze.find((s) => s.step.some((x) => x.id === step.id))!;
  const ultimo = indice === steps.length - 1;

  function aggiorna(v: Payload, v2: boolean) {
    setCorrente(v);
    setValido(v2);
  }

  async function avanti() {
    if (!corrente || !valido) return;
    setErrore(null);
    setSalvataggio(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("step_response")
        .upsert({ attempt_id: attemptId, stanza: step.stanza, step_id: step.id, tipo: step.tipo, payload: corrente }, { onConflict: "attempt_id,step_id" });
      if (error) throw error;

      const nuoveRisposte = { ...risposte, [step.id]: corrente };
      setRisposte(nuoveRisposte);

      // aggiorna la stanza corrente sull'attempt (best effort)
      await supabase.from("mission_attempt").update({ stanza_corrente: step.stanza, updated_at: new Date().toISOString() }).eq("id", attemptId);

      if (ultimo) {
        const res = await fetch("/api/escape/finalizza", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrore(data.errore ?? "Non è stato possibile completare la missione.");
          return;
        }
        router.refresh();
        return;
      }

      const prossimo = indice + 1;
      setIndice(prossimo);
      setCorrente(nuoveRisposte[steps[prossimo].id] ?? null);
      setValido(steps[prossimo].id in nuoveRisposte);
    } catch {
      setErrore("Errore di salvataggio. Riprova.");
    } finally {
      setSalvataggio(false);
    }
  }

  function indietro() {
    if (indice === 0) return;
    const prec = indice - 1;
    setIndice(prec);
    setCorrente(risposte[steps[prec].id] ?? null);
    setValido(steps[prec].id in risposte);
    setErrore(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-kireo-muted">
        <span>Stanza {stanza.numero}/5 · {stanza.titolo}</span>
        <span>Passo {indice + 1} di {steps.length}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-kireo-green transition-all" style={{ width: `${((indice + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
        <p className="text-xs uppercase tracking-wide text-kireo-orange">{stanza.titolo}</p>
        <h2 className="mt-1 py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">{step.titolo}</h2>
        <p className="mt-2 text-sm text-kireo-light/90">{step.prompt}</p>
        {step.hint && <p className="mt-1 text-xs text-kireo-muted">{step.hint}</p>}

        <div className="mt-5">
          <StepInput step={step} valore={corrente} onChange={aggiorna} />
        </div>

        {errore && <p className="mt-3 text-sm text-red-400">{errore}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={indietro} disabled={indice === 0 || salvataggio} className="text-sm text-kireo-muted hover:text-kireo-light disabled:opacity-30">
            ← Indietro
          </button>
          <Button type="button" onClick={avanti} disabled={!valido || salvataggio}>
            {salvataggio ? "…" : ultimo ? "Concludi la missione" : "Avanti"}
          </Button>
        </div>
      </div>
    </div>
  );
}
