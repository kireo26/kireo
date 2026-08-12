"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTest } from "@/lib/test/config";
import { ordineOpzioni } from "@/lib/test/ordine";
import { Button } from "@/components/Button";

type Risposta = { opzioneId: string };
type RispostaSalvata = { item_id: string; payload: Risposta };

// Player del test: una domanda per schermata, barra sempre visibile,
// «Domanda X di N», opzioni grandi/verticali con ordine randomizzato ma stabile
// per tentativo, possibilità di tornare indietro, micro-schermata motivazionale
// a metà, nessun timer, riprendibile. Salva ogni risposta in test_response
// (upsert) e all'ultima chiama /api/test/finalizza. Stesso spirito di
// EscapePlayer, semplificato (solo scelte singole).
export default function TestPlayer({
  testSlug,
  attemptId,
  risposteIniziali,
}: {
  testSlug: string;
  attemptId: string;
  risposteIniziali: RispostaSalvata[];
}) {
  const router = useRouter();
  const test = useMemo(() => getTest(testSlug)!, [testSlug]);
  const items = test.items;

  const [risposte, setRisposte] = useState<Record<string, Risposta>>(() => {
    const r: Record<string, Risposta> = {};
    for (const x of risposteIniziali) r[x.item_id] = x.payload;
    return r;
  });

  const primoNonRisposto = items.findIndex((it) => !(it.id in risposte));
  const [indice, setIndice] = useState(primoNonRisposto === -1 ? items.length - 1 : primoNonRisposto);
  const [motivazionale, setMotivazionale] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const item = items[Math.min(indice, items.length - 1)];
  const [scelta, setScelta] = useState<string | null>(risposte[item.id]?.opzioneId ?? null);
  const ultimo = indice === items.length - 1;

  // Ordine delle opzioni: derivato da (attemptId, itemId) → stabile alla ripresa
  // e tornando indietro, ma diverso da item a item.
  const opzioniOrdinate = useMemo(() => ordineOpzioni(attemptId, item.id, item.opzioni), [attemptId, item]);

  function vaiA(prossimo: number, nuoveRisposte: Record<string, Risposta>) {
    const it = items[prossimo];
    setIndice(prossimo);
    setScelta(nuoveRisposte[it.id]?.opzioneId ?? null);
    setErrore(null);
  }

  async function avanti() {
    if (!scelta) return;
    setErrore(null);
    setSalvataggio(true);
    try {
      const supabase = createClient();
      const payload: Risposta = { opzioneId: scelta };
      const { error } = await supabase
        .from("test_response")
        .upsert({ attempt_id: attemptId, item_id: item.id, payload }, { onConflict: "attempt_id,item_id" });
      if (error) throw error;

      const nuoveRisposte = { ...risposte, [item.id]: payload };
      setRisposte(nuoveRisposte);
      await supabase.from("test_attempt").update({ item_corrente: item.numero, updated_at: new Date().toISOString() }).eq("id", attemptId);

      if (ultimo) {
        const res = await fetch("/api/test/finalizza", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrore(data.errore ?? "Non è stato possibile completare il test.");
          return;
        }
        router.refresh();
        return;
      }

      // micro-schermata motivazionale a metà (una volta sola), poi la domanda dopo
      if (item.numero === test.motivazionaleDopo && !motivazionale) {
        setMotivazionale(true);
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
    if (motivazionale) {
      setMotivazionale(false);
      return;
    }
    if (indice === 0) return;
    vaiA(indice - 1, risposte);
  }

  // Micro-schermata motivazionale.
  if (motivazionale) {
    return (
      <div className="space-y-6">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-kireo-green transition-all" style={{ width: `${(test.motivazionaleDopo / items.length) * 100}%` }} />
        </div>
        <div className="rounded-2xl border border-kireo-orange/20 bg-kireo-orange/5 p-6 sm:p-8">
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">{test.motivazionaleTitolo}</h2>
          <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">{test.motivazionaleTesto}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={indietro} className="text-sm text-kireo-muted hover:text-kireo-light">← Indietro</button>
          <Button type="button" onClick={() => { setMotivazionale(false); vaiA(indice + 1, risposte); }}>Continua</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-kireo-muted">
        <span>Domanda {item.numero} di {items.length}</span>
        <span>{test.durata} · nessun cronometro</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-kireo-green transition-all" style={{ width: `${((indice + 1) / items.length) * 100}%` }} />
      </div>

      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">{item.domanda}</h2>

        <div className="mt-5 space-y-3">
          {opzioniOrdinate.map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 text-sm text-kireo-light transition ${scelta === o.id ? "border-kireo-green bg-kireo-green/5" : "border-white/10 bg-kireo-dark hover:border-kireo-green/40"}`}
            >
              <input type="radio" name={item.id} checked={scelta === o.id} onChange={() => setScelta(o.id)} className="mt-0.5 accent-kireo-green" />
              <span>{o.label}</span>
            </label>
          ))}
        </div>

        {errore && <p className="mt-3 text-sm text-red-400">{errore}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={indietro} disabled={indice === 0 || salvataggio} className="text-sm text-kireo-muted hover:text-kireo-light disabled:opacity-30">← Indietro</button>
          <Button type="button" onClick={avanti} disabled={!scelta || salvataggio}>
            {salvataggio ? "…" : ultimo ? "Vedi il risultato" : "Avanti"}
          </Button>
        </div>
      </div>
    </div>
  );
}
