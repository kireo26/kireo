"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTest, T3_META } from "@/lib/test/config";
import type { ItemT2, ItemT3, TestItem } from "@/lib/test/config";
import { ordineOpzioni } from "@/lib/test/ordine";
import { Button } from "@/components/Button";

type Payload = { opzioneId?: string; ordine?: string[]; allocazioni?: Record<string, number>; valore?: number };
type RispostaSalvata = { item_id: string; payload: Payload };
type ItemQualsiasi = TestItem | ItemT2 | ItemT3;
type Giocabile = { slug: string; durata: string; motivazionaleDopo: number; motivazionaleTitolo: string; motivazionaleTesto: string; items: ItemQualsiasi[] };

// Player unificato T1/T2/T3: una domanda per schermata, barra sempre visibile,
// «Domanda X di N», opzioni grandi con ordine randomizzato ma stabile per
// tentativo, micro-schermata motivazionale a metà, nessun timer, riprendibile.
// Rende quattro forme d'item: scelta (radio), ordina (su/giù), alloca (ore),
// Likert (1-5). T1 e T3 usano solo la scelta; T3 riceve gli item già assemblati
// (a runtime dalle aree emerse), gli altri li legge dal config.
export default function TestPlayer({ testSlug, attemptId, risposteIniziali, itemsAssemblati }: { testSlug: string; attemptId: string; risposteIniziali: RispostaSalvata[]; itemsAssemblati?: ItemT3[] }) {
  const router = useRouter();
  const test = useMemo<Giocabile>(() => (itemsAssemblati ? { ...T3_META, items: itemsAssemblati } : (getTest(testSlug)! as unknown as Giocabile)), [testSlug, itemsAssemblati]);
  const items = test.items;

  const [risposte, setRisposte] = useState<Record<string, Payload>>(() => {
    const r: Record<string, Payload> = {};
    for (const x of risposteIniziali) r[x.item_id] = x.payload;
    return r;
  });

  const numero = (it: ItemQualsiasi) => it.numero;
  const forma = (it: ItemQualsiasi): "scelta" | "ordina" | "alloca" | "likert" => {
    if ("opzioni" in it) return "scelta";
    return (it as ItemT2).tipo as "ordina" | "alloca" | "likert";
  };

  const primoNonRisposto = items.findIndex((it) => !(it.id in risposte));
  const [indice, setIndice] = useState(primoNonRisposto === -1 ? items.length - 1 : primoNonRisposto);
  const [motivazionale, setMotivazionale] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const item = items[Math.min(indice, items.length - 1)];
  const [corrente, setCorrente] = useState<Payload>(risposte[item.id] ?? {});
  const ultimo = indice === items.length - 1;

  const valido = useMemo(() => {
    const f = forma(item);
    if (f === "scelta") return Boolean(corrente.opzioneId);
    if (f === "ordina") return Array.isArray(corrente.ordine) && corrente.ordine.length > 0;
    if (f === "likert") return typeof corrente.valore === "number" && corrente.valore >= 1;
    // alloca: distribuisci tutte le ore
    const it = item as Extract<ItemT2, { tipo: "alloca" }>;
    const somma = Object.values(corrente.allocazioni ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
    return somma === it.totale;
  }, [item, corrente]);

  function vaiA(prossimo: number, nuove: Record<string, Payload>) {
    const it = items[prossimo];
    setIndice(prossimo);
    setCorrente(nuove[it.id] ?? {});
    setErrore(null);
  }

  async function avanti() {
    if (!valido) return;
    setErrore(null);
    setSalvataggio(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("test_response").upsert({ attempt_id: attemptId, item_id: item.id, payload: corrente }, { onConflict: "attempt_id,item_id" });
      if (error) throw error;
      const nuove = { ...risposte, [item.id]: corrente };
      setRisposte(nuove);
      await supabase.from("test_attempt").update({ item_corrente: numero(item), updated_at: new Date().toISOString() }).eq("id", attemptId);

      if (ultimo) {
        const res = await fetch("/api/test/finalizza", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId }) });
        const data = await res.json();
        if (!res.ok) { setErrore(data.errore ?? "Non è stato possibile completare il test."); return; }
        router.refresh();
        return;
      }
      if (numero(item) === test.motivazionaleDopo && !motivazionale) { setMotivazionale(true); return; }
      vaiA(indice + 1, nuove);
    } catch {
      setErrore("Errore di salvataggio. Riprova.");
    } finally {
      setSalvataggio(false);
    }
  }

  function indietro() {
    if (motivazionale) { setMotivazionale(false); return; }
    if (indice === 0) return;
    vaiA(indice - 1, risposte);
  }

  if (motivazionale) {
    return (
      <div className="space-y-6">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-kireo-green" style={{ width: `${(test.motivazionaleDopo / items.length) * 100}%` }} /></div>
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
        <span>Domanda {numero(item)} di {items.length}</span>
        <span>{test.durata} · nessun cronometro</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-kireo-green transition-all" style={{ width: `${((indice + 1) / items.length) * 100}%` }} /></div>

      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">{item.domanda}</h2>
        <div className="mt-5">
          <ItemInput attemptId={attemptId} item={item} forma={forma(item)} valore={corrente} onChange={setCorrente} />
        </div>
        {errore && <p className="mt-3 text-sm text-red-400">{errore}</p>}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={indietro} disabled={indice === 0 || salvataggio} className="text-sm text-kireo-muted hover:text-kireo-light disabled:opacity-30">← Indietro</button>
          <Button type="button" onClick={avanti} disabled={!valido || salvataggio}>{salvataggio ? "…" : ultimo ? "Vedi il risultato" : "Avanti"}</Button>
        </div>
      </div>
    </div>
  );
}

function ItemInput({ attemptId, item, forma, valore, onChange }: { attemptId: string; item: ItemQualsiasi; forma: "scelta" | "ordina" | "alloca" | "likert"; valore: Payload; onChange: (p: Payload) => void }) {
  if (forma === "scelta") {
    const opzioni = ("opzioni" in item ? item.opzioni : []) as { id: string; label: string }[];
    const ordinate = ordineOpzioni(attemptId, item.id, opzioni);
    return (
      <div className="space-y-3">
        {ordinate.map((o) => (
          <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 text-sm text-kireo-light transition ${valore.opzioneId === o.id ? "border-kireo-green bg-kireo-green/5" : "border-white/10 bg-kireo-dark hover:border-kireo-green/40"}`}>
            <input type="radio" name={item.id} checked={valore.opzioneId === o.id} onChange={() => onChange({ opzioneId: o.id })} className="mt-0.5 accent-kireo-green" />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  }
  if (forma === "ordina") {
    const it = item as Extract<ItemT2, { tipo: "ordina" }>;
    const iniziale = ordineOpzioni(attemptId, item.id, it.elementi).map((e) => e.id);
    const ordine = valore.ordine ?? iniziale;
    const muovi = (i: number, d: number) => {
      const nuovo = [...ordine];
      const j = i + d;
      if (j < 0 || j >= nuovo.length) return;
      [nuovo[i], nuovo[j]] = [nuovo[j], nuovo[i]];
      onChange({ ordine: nuovo });
    };
    return (
      <div>
        <p className="mb-2 text-xs text-kireo-muted">Dalla cosa che faresti per prima (in alto) a quella per ultima.</p>
        <ol className="space-y-2">
          {ordine.map((id, i) => {
            const el = it.elementi.find((e) => e.id === id);
            return (
              <li key={id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-kireo-dark px-4 py-3 text-sm text-kireo-light">
                <span><span className="mr-2 text-kireo-muted">{i + 1}.</span>{el?.label}</span>
                <span className="flex flex-none gap-1">
                  <button type="button" onClick={() => muovi(i, -1)} disabled={i === 0} className="rounded px-2 py-0.5 text-kireo-muted hover:text-kireo-light disabled:opacity-30" aria-label="Su">▲</button>
                  <button type="button" onClick={() => muovi(i, 1)} disabled={i === ordine.length - 1} className="rounded px-2 py-0.5 text-kireo-muted hover:text-kireo-light disabled:opacity-30" aria-label="Giù">▼</button>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  if (forma === "alloca") {
    const it = item as Extract<ItemT2, { tipo: "alloca" }>;
    const alloc = valore.allocazioni ?? {};
    const somma = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
    const resta = it.totale - somma;
    const voci = ordineOpzioni(attemptId, item.id, it.voci);
    const set = (id: string, n: number) => onChange({ allocazioni: { ...alloc, [id]: Math.max(0, Math.round(n)) } });
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-kireo-card px-4 py-2 text-sm">
          <span className="text-kireo-muted">{it.totale} {it.unita} da distribuire</span>
          <span className={resta === 0 ? "text-kireo-green-light" : "text-kireo-light"}>Restano {resta} {it.unita}</span>
        </div>
        {voci.map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-kireo-dark px-4 py-3 text-sm text-kireo-light">
            <span>{v.label}</span>
            <input type="number" min={0} max={it.totale} value={alloc[v.id] ?? 0} onChange={(e) => set(v.id, Number(e.target.value))} className="w-24 flex-none rounded-lg border border-white/10 bg-kireo-card px-2 py-1 text-right text-sm text-kireo-light focus:border-kireo-green focus:outline-none" />
          </div>
        ))}
        {resta !== 0 && <p className="text-xs text-kireo-orange">Distribuisci esattamente {it.totale} {it.unita} (ne {resta > 0 ? "restano" : "hai messe troppe per"} {Math.abs(resta)}).</p>}
      </div>
    );
  }
  // likert
  const scelto = valore.valore;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange({ valore: n })} className={`flex h-12 flex-1 items-center justify-center rounded-xl border text-sm font-semibold ${scelto === n ? "border-kireo-green bg-kireo-green/10 text-kireo-light" : "border-white/15 text-kireo-muted hover:border-kireo-green/50"}`}>{n}</button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-kireo-muted"><span>Per niente</span><span>Del tutto</span></div>
    </div>
  );
}
