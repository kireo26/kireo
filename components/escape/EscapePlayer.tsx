"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMissione } from "@/lib/escape/config";
import type { LeggiRisposta, Payload, Step } from "@/lib/escape/tipi";
import { Button } from "@/components/Button";
import StepInput from "./StepInput";

type RispostaSalvata = { step_id: string; payload: Payload };

// Uno step è "facoltativo" se si può proseguire senza rispondere: l'esplorazione
// dei materiali (1.1) e la riflessione breve sul non-approfondire (2.2). Per
// questi il player considera valido lo stato anche vuoto, e salva un payload di
// default all'avanzamento.
function facoltativo(s: Step): boolean {
  return s.tipo === "esplora_libero" || (s.tipo === "decisione_scritta" && Boolean(s.facoltativo));
}
function defaultPayload(s: Step): Payload {
  if (s.tipo === "esplora_libero") return { letti: [] };
  return { testo: "" };
}

// Player delle 5 stanze: uno step alla volta, contenuto RISOLTO dalle risposte
// già date (le scelte aprono e chiudono porte). Salva ogni risposta in
// step_response (upsert, riprendibile), avanza stanza_corrente e all'ultimo
// step chiama /api/escape/finalizza. Nessun cronometro, nessuna sconfitta.
export default function EscapePlayer({
  missionSlug,
  attemptId,
  risposteIniziali,
}: {
  missionSlug: string;
  attemptId: string;
  risposteIniziali: RispostaSalvata[];
}) {
  const router = useRouter();

  const [risposte, setRisposte] = useState<Record<string, Payload>>(() => {
    const r: Record<string, Payload> = {};
    for (const x of risposteIniziali) r[x.step_id] = x.payload;
    return r;
  });

  // Missione risolta dalle risposte correnti: gli step dinamici (dossier della
  // Stanza 2, voci/totale del budget, testo del vincolo, avvisi dello scarto)
  // riflettono il mandato scelto e i materiali letti. La SEQUENZA e gli id
  // restano fissi: cambia solo il contenuto, quindi l'indice resta valido.
  const get: LeggiRisposta = useMemo(() => (id) => risposte[id], [risposte]);
  const mission = useMemo(() => getMissione(missionSlug, get)!, [missionSlug, get]);
  const steps: Step[] = useMemo(() => mission.stanze.flatMap((s) => s.step), [mission]);

  const primoNonRisposto = steps.findIndex((s) => !(s.id in risposte) && !facoltativo(s));
  const [indice, setIndice] = useState(primoNonRisposto === -1 ? steps.length - 1 : primoNonRisposto);

  const step = steps[Math.min(indice, steps.length - 1)];
  const [corrente, setCorrente] = useState<Payload | null>(risposte[step.id] ?? null);
  const [valido, setValido] = useState((step.id in risposte) || facoltativo(step));
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const stanza = mission.stanze.find((s) => s.step.some((x) => x.id === step.id))!;
  const primoDellaStanza = steps.findIndex((x) => x.stanza === step.stanza) === indice;
  const ultimo = indice === steps.length - 1;

  function aggiorna(v: Payload, v2: boolean) {
    setCorrente(v);
    setValido(v2);
  }

  function vaiA(prossimo: number, nuoveRisposte: Record<string, Payload>) {
    const s = steps[prossimo];
    setIndice(prossimo);
    setCorrente(nuoveRisposte[s.id] ?? null);
    setValido(s.id in nuoveRisposte || facoltativo(s));
    setErrore(null);
  }

  async function avanti() {
    if (!valido) return;
    const payload = corrente ?? (facoltativo(step) ? defaultPayload(step) : null);
    if (!payload) return;
    setErrore(null);
    setSalvataggio(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("step_response")
        .upsert({ attempt_id: attemptId, stanza: step.stanza, step_id: step.id, tipo: step.tipo, payload }, { onConflict: "attempt_id,step_id" });
      if (error) throw error;

      const nuoveRisposte = { ...risposte, [step.id]: payload };
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

      vaiA(indice + 1, nuoveRisposte);
    } catch {
      setErrore("Errore di salvataggio. Riprova.");
    } finally {
      setSalvataggio(false);
    }
  }

  function indietro() {
    if (indice === 0) return;
    vaiA(indice - 1, risposte);
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

      {primoDellaStanza && (
        <div className="rounded-2xl border border-kireo-orange/20 bg-kireo-orange/5 p-5 text-sm leading-relaxed text-kireo-light/90 whitespace-pre-line">
          {stanza.intro}
        </div>
      )}

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
