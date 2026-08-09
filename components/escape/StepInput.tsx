"use client";

import type {
  Payload,
  PayloadAlloca,
  PayloadOrdina,
  PayloadPrevisione,
  PayloadScarta,
  PayloadSceltaSingola,
  PayloadSeleziona,
  PayloadTesto,
  Step,
} from "@/lib/escape/tipi";

const CARD = "rounded-xl border border-white/10 bg-kireo-dark px-4 py-3 text-sm text-kireo-light";

// Rende l'input adatto al tipo di step e comunica il payload + la validità.
export default function StepInput({ step, valore, onChange }: { step: Step; valore: Payload | null; onChange: (v: Payload, valido: boolean) => void }) {
  switch (step.tipo) {
    case "scelta_singola": {
      const v = valore as PayloadSceltaSingola | null;
      return (
        <div className="space-y-2">
          {step.opzioni.map((o) => (
            <label key={o.id} className={`flex cursor-pointer items-center gap-3 ${CARD} ${v?.opzioneId === o.id ? "border-kireo-green" : ""}`}>
              <input type="radio" name={step.id} checked={v?.opzioneId === o.id} onChange={() => onChange({ opzioneId: o.id }, true)} className="accent-kireo-green" />
              {o.label}
            </label>
          ))}
        </div>
      );
    }

    case "ordina_priorita": {
      const v = valore as PayloadOrdina | null;
      const ordine = v?.ordine ?? step.elementi.map((e) => e.id);
      const muovi = (i: number, delta: number) => {
        const nuovo = [...ordine];
        const j = i + delta;
        if (j < 0 || j >= nuovo.length) return;
        [nuovo[i], nuovo[j]] = [nuovo[j], nuovo[i]];
        onChange({ ordine: nuovo }, true);
      };
      return (
        <ol className="space-y-2">
          {ordine.map((id, i) => {
            const el = step.elementi.find((e) => e.id === id);
            return (
              <li key={id} className={`flex items-center justify-between gap-3 ${CARD}`}>
                <span>
                  <span className="mr-2 text-kireo-muted">{i + 1}.</span>
                  {el?.label}
                </span>
                <span className="flex flex-none gap-1">
                  <button type="button" onClick={() => muovi(i, -1)} disabled={i === 0} className="rounded px-2 py-0.5 text-kireo-muted hover:text-kireo-light disabled:opacity-30" aria-label="Sposta su">▲</button>
                  <button type="button" onClick={() => muovi(i, 1)} disabled={i === ordine.length - 1} className="rounded px-2 py-0.5 text-kireo-muted hover:text-kireo-light disabled:opacity-30" aria-label="Sposta giù">▼</button>
                </span>
              </li>
            );
          })}
        </ol>
      );
    }

    case "seleziona_informazioni": {
      const v = valore as PayloadSeleziona | null;
      const selezionati = v?.selezionati ?? [];
      const toggle = (id: string) => {
        const has = selezionati.includes(id);
        const nuovo = has ? selezionati.filter((x) => x !== id) : selezionati.length < step.budget ? [...selezionati, id] : selezionati;
        onChange({ selezionati: nuovo }, nuovo.length > 0);
      };
      return (
        <div className="space-y-2">
          <p className="text-xs text-kireo-muted">Aperti {selezionati.length}/{step.budget}</p>
          {step.dossier.map((d) => {
            const on = selezionati.includes(d.id);
            const pieno = !on && selezionati.length >= step.budget;
            return (
              <label key={d.id} className={`flex cursor-pointer items-center gap-3 ${CARD} ${on ? "border-kireo-green" : ""} ${pieno ? "opacity-40" : ""}`}>
                <input type="checkbox" checked={on} disabled={pieno} onChange={() => toggle(d.id)} className="accent-kireo-green" />
                {d.label}
              </label>
            );
          })}
        </div>
      );
    }

    case "alloca_budget": {
      const v = valore as PayloadAlloca | null;
      const alloc = v?.allocazioni ?? {};
      const speso = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
      const set = (id: string, n: number) => {
        const nuovo = { ...alloc, [id]: Math.max(0, n) };
        const tot = Object.values(nuovo).reduce((a, b) => a + (Number(b) || 0), 0);
        onChange({ allocazioni: nuovo }, tot > 0 && tot <= step.totale);
      };
      return (
        <div className="space-y-2">
          <p className={`text-xs ${speso <= step.totale ? "text-kireo-muted" : "text-red-400"}`}>Usati {speso}/{step.totale} punti{speso > step.totale ? " — hai superato il budget" : ""}</p>
          {step.voci.map((voce) => (
            <div key={voce.id} className={`flex items-center justify-between gap-3 ${CARD}`}>
              <span>{voce.label}</span>
              <input type="number" min={0} max={step.totale} value={alloc[voce.id] ?? 0} onChange={(e) => set(voce.id, Number(e.target.value))} className="w-20 flex-none rounded-lg border border-white/10 bg-kireo-card px-2 py-1 text-right text-sm text-kireo-light focus:border-kireo-green focus:outline-none" />
            </div>
          ))}
        </div>
      );
    }

    case "scarta_opzione": {
      const v = valore as PayloadScarta | null;
      const scartati = v?.scartati ?? [];
      const toggle = (id: string) => {
        const has = scartati.includes(id);
        const nuovo = has ? scartati.filter((x) => x !== id) : scartati.length < step.daScartare ? [...scartati, id] : scartati;
        onChange({ scartati: nuovo, motivazione: v?.motivazione }, nuovo.length === step.daScartare);
      };
      return (
        <div className="space-y-2">
          <p className="text-xs text-kireo-muted">Da eliminare {scartati.length}/{step.daScartare}</p>
          {step.opzioni.map((o) => {
            const on = scartati.includes(o.id);
            const pieno = !on && scartati.length >= step.daScartare;
            return (
              <label key={o.id} className={`flex cursor-pointer items-center gap-3 ${CARD} ${on ? "border-red-400/50 line-through opacity-70" : ""} ${pieno ? "opacity-40" : ""}`}>
                <input type="checkbox" checked={on} disabled={pieno} onChange={() => toggle(o.id)} className="accent-red-400" />
                {o.label}
              </label>
            );
          })}
        </div>
      );
    }

    case "previsione_poi_esito": {
      const v = valore as PayloadPrevisione | null;
      const fiducia = v?.fiducia ?? 50;
      return (
        <div className={CARD}>
          <p className="mb-2">{step.domanda}</p>
          <input type="range" min={0} max={100} value={fiducia} onChange={(e) => onChange({ fiducia: Number(e.target.value) }, true)} className="w-full accent-kireo-green" />
          <p className="mt-1 text-center text-sm text-kireo-light">{fiducia}/100</p>
        </div>
      );
    }

    case "decisione_scritta":
    case "riflessione": {
      const v = valore as PayloadTesto | null;
      const testo = v?.testo ?? "";
      return (
        <div>
          <textarea
            value={testo}
            onChange={(e) => onChange({ testo: e.target.value }, e.target.value.trim().length >= step.minCaratteri)}
            rows={step.tipo === "decisione_scritta" ? 8 : 5}
            placeholder="Scrivi qui…"
            className="w-full resize-y rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted focus:border-kireo-green focus:outline-none"
          />
          <p className={`mt-1 text-xs ${testo.trim().length >= step.minCaratteri ? "text-kireo-muted" : "text-kireo-orange"}`}>{testo.trim().length}/{step.minCaratteri} caratteri minimi</p>
        </div>
      );
    }
  }
}
