"use client";

import { useState } from "react";
import { valutaPiano } from "@/lib/escape/config";
import type {
  Materiale,
  Payload,
  PayloadAlloca,
  PayloadAssegna,
  PayloadEsplora,
  PayloadLavori,
  PayloadOrdina,
  PayloadPianifica,
  PayloadPrevisione,
  PayloadScarta,
  PayloadSceltaSingola,
  PayloadSeleziona,
  PayloadTesto,
  Step,
  StepAllocaBudget,
  StepAssegnaRuoli,
  StepDecisioneScritta,
  StepEsploraLibero,
  StepOrdinaPriorita,
  StepPianificaLavori,
  StepPianificaPassi,
  StepRiflessione,
  StepScartaOpzione,
  StepSceltaSingola,
  StepSelezionaInformazioni,
} from "@/lib/escape/tipi";

const CARD = "rounded-xl border border-white/10 bg-kireo-dark px-4 py-3 text-sm text-kireo-light";
const fmtBudget = (n: number, unita: string) => `${n.toLocaleString("it-IT")} ${unita}`;

type OnChange = (v: Payload, valido: boolean) => void;

// Contenuto di un materiale (numeri + eventuali estratti del verbale).
function ContenutoMateriale({ m }: { m: Materiale }) {
  return (
    <div className="mt-2 space-y-2 border-t border-white/10 pt-2 text-xs text-kireo-light/90">
      <p>{m.contenuto}</p>
      {m.estratti && (
        <ul className="space-y-1.5">
          {m.estratti.map((e, i) => (
            <li key={i} className="border-l-2 border-kireo-orange/40 pl-2">
              <span className="text-kireo-muted">{e.chi}:</span> «{e.testo}»
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────── esplora_libero (1.1)
function EsploraInput({ step, valore, onChange }: { step: StepEsploraLibero; valore: PayloadEsplora | null; onChange: OnChange }) {
  const letti = valore?.letti ?? [];
  // apri = leggi (irreversibile nello spirito: la traccia resta). Consentito
  // proseguire anche senza aprire nulla (la gestione del "facoltativo" è nel
  // player); qui ogni interazione conferma comunque la validità.
  const [aperti, setAperti] = useState<Set<string>>(new Set(letti));
  const apri = (id: string) => {
    const nuovoAperti = new Set(aperti);
    nuovoAperti.add(id);
    setAperti(nuovoAperti);
    const nuoviLetti = Array.from(new Set([...letti, id]));
    onChange({ letti: nuoviLetti }, true);
  };
  return (
    <div className="space-y-2">
      {step.materiali.map((m) => {
        const aperto = aperti.has(m.id);
        return (
          <div key={m.id} className={`${CARD} ${aperto ? "border-kireo-green/40" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{m.titolo}</span>
              {aperto ? (
                <span className="flex-none text-[11px] text-kireo-green-light">Letto ✓</span>
              ) : (
                <button type="button" onClick={() => apri(m.id)} className="flex-none rounded-full border border-white/15 px-3 py-1 text-xs text-kireo-light hover:border-kireo-green">
                  Leggi
                </button>
              )}
            </div>
            {aperto && <ContenutoMateriale m={m} />}
          </div>
        );
      })}
      <p className="text-[11px] text-kireo-muted">Aperti {aperti.size} di {step.materiali.length} — puoi proseguire quando vuoi.</p>
    </div>
  );
}

// ─────────────────────────────────────────── scelta_singola (mandato 1.3)
function SceltaSingolaInput({ step, valore, onChange }: { step: StepSceltaSingola; valore: PayloadSceltaSingola | null; onChange: OnChange }) {
  return (
    <div className="space-y-2">
      {step.opzioni.map((o) => (
        <label key={o.id} className={`flex cursor-pointer items-start gap-3 ${CARD} ${valore?.opzioneId === o.id ? "border-kireo-green" : ""}`}>
          <input type="radio" name={step.id} checked={valore?.opzioneId === o.id} onChange={() => onChange({ opzioneId: o.id }, true)} className="mt-0.5 accent-kireo-green" />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────── ordina_priorita (1.2)
function OrdinaInput({ step, valore, onChange }: { step: StepOrdinaPriorita; valore: PayloadOrdina | null; onChange: OnChange }) {
  const ordine = valore?.ordine ?? step.elementi.map((e) => e.id);
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

// ─────────────────────────────────────────── seleziona_informazioni (2.1)
function SelezionaInput({ step, valore, onChange }: { step: StepSelezionaInformazioni; valore: PayloadSeleziona | null; onChange: OnChange }) {
  const selezionati = valore?.selezionati ?? [];
  const toggle = (id: string) => {
    const has = selezionati.includes(id);
    const nuovo = has ? selezionati.filter((x) => x !== id) : selezionati.length < step.budget ? [...selezionati, id] : selezionati;
    onChange({ selezionati: nuovo }, nuovo.length > 0);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-kireo-muted">Gettoni spesi {selezionati.length}/{step.budget}</p>
      {step.dossier.map((d) => {
        const on = selezionati.includes(d.id);
        const pieno = !on && selezionati.length >= step.budget;
        return (
          <div key={d.id} className={`${CARD} ${on ? "border-kireo-green/40" : ""} ${pieno ? "opacity-40" : ""}`}>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={on} disabled={pieno} onChange={() => toggle(d.id)} className="accent-kireo-green" />
              <span className="font-semibold">{d.titolo}</span>
            </label>
            {on && <ContenutoMateriale m={d} />}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────── alloca_budget (3.1)
function AllocaInput({ step, valore, onChange }: { step: StepAllocaBudget; valore: PayloadAlloca | null; onChange: OnChange }) {
  const alloc = valore?.allocazioni ?? {};
  const speso = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
  const residuo = step.totale - speso;
  const set = (id: string, n: number) => {
    const nuovo = { ...alloc, [id]: Math.max(0, Math.round(n)) };
    const tot = Object.values(nuovo).reduce((a, b) => a + (Number(b) || 0), 0);
    onChange({ allocazioni: nuovo }, tot > 0 && tot <= step.totale);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-kireo-card px-4 py-2 text-sm">
        <span className="text-kireo-muted">Budget disponibile: {fmtBudget(step.totale, step.unita)}</span>
        <span className={residuo >= 0 ? "text-kireo-light" : "text-red-400"}>Resta {fmtBudget(residuo, step.unita)}</span>
      </div>
      {step.voci.map((voce) => (
        <div key={voce.id} className={`${CARD}`}>
          <div className="flex items-center justify-between gap-3">
            <span>
              {voce.label}
              {voce.costoIndicativo ? <span className="ml-1 text-[11px] text-kireo-muted">(indicativo ≈ {fmtBudget(voce.costoIndicativo, step.unita)})</span> : null}
            </span>
            <input
              type="number"
              min={0}
              max={step.totale}
              step={step.passo}
              value={alloc[voce.id] ?? 0}
              onChange={(e) => set(voce.id, Number(e.target.value))}
              className="w-28 flex-none rounded-lg border border-white/10 bg-kireo-card px-2 py-1 text-right text-sm text-kireo-light focus:border-kireo-green focus:outline-none"
            />
          </div>
        </div>
      ))}
      {residuo < 0 && <p className="text-xs text-red-400">Hai superato il budget: togli qualcosa.</p>}
    </div>
  );
}

// ─────────────────────────────────────────── pianifica_lavori (3.1, Missione 04)
function LavoriInput({ step, valore, onChange }: { step: StepPianificaLavori; valore: PayloadLavori | null; onChange: OnChange }) {
  const sel = valore?.selezionati ?? [];
  const toggle = (id: string) => {
    const nuovo = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    onChange({ selezionati: nuovo }, nuovo.length > 0);
  };
  const { soldi, giorni, dipendenzeMancanti, secondaSquadra } = valutaPiano(step, sel);
  const overSoldi = soldi > step.budgetSoldi;
  const doppio = step.budgetGiorni !== undefined; // Missione 04 = soldi + giorni; Missione 06 = solo soldi
  const overGiorni = doppio && giorni > (step.budgetGiorni ?? 0);
  const u = step.unitaSoldi;
  const labelDi = (id: string) => step.lavori.find((l) => l.id === id)?.label ?? id;
  return (
    <div className="space-y-2">
      <div className={`grid ${doppio ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
        <div className="rounded-xl border border-white/10 bg-kireo-card px-3 py-2 text-sm">
          <p className="text-[11px] text-kireo-muted">Speso</p>
          <p className={overSoldi ? "text-red-400" : "text-kireo-light"}>{soldi.toLocaleString("it-IT")} / {step.budgetSoldi.toLocaleString("it-IT")} {u}</p>
        </div>
        {doppio && (
          <div className="rounded-xl border border-white/10 bg-kireo-card px-3 py-2 text-sm">
            <p className="text-[11px] text-kireo-muted">Giorni {secondaSquadra ? "(due squadre)" : ""}</p>
            <p className={overGiorni ? "text-red-400" : "text-kireo-light"}>{giorni} / {step.budgetGiorni}</p>
          </div>
        )}
      </div>
      {(overSoldi || overGiorni) && (
        <p className="text-xs text-red-400">Il piano sfora {overSoldi ? "il budget" : ""}{overSoldi && overGiorni ? " e " : ""}{overGiorni ? "i giorni" : ""}: togli qualcosa o cambia scelta.</p>
      )}
      {dipendenzeMancanti.map((d) => (
        <p key={d.lavoro} className="text-xs text-kireo-orange">«{labelDi(d.lavoro)}» va fatto dopo: {d.mancanti.map(labelDi).join(", ")}. Manca nel piano.</p>
      ))}
      {step.lavori.map((l) => {
        const on = sel.includes(l.id);
        const risparmio = l.costo < 0;
        return (
          <label key={l.id} className={`flex cursor-pointer items-center gap-3 ${CARD} ${on ? "border-kireo-green" : ""}`}>
            <input type="checkbox" checked={on} onChange={() => toggle(l.id)} className="accent-kireo-green" />
            <span className="flex-1">{l.label}</span>
            <span className={`flex-none text-[11px] ${risparmio ? "text-kireo-green-light" : "text-kireo-muted"}`}>
              {risparmio ? `−${Math.abs(l.costo).toLocaleString("it-IT")} ${u} (risparmio)` : `${l.costo.toLocaleString("it-IT")} ${u}`}{l.giorni > 0 ? ` · ${l.giorni} gg` : ""}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────── scarta_opzione (3.2)
function ScartaInput({ step, valore, onChange }: { step: StepScartaOpzione; valore: PayloadScarta | null; onChange: OnChange }) {
  const scartati = valore?.scartati ?? [];
  const toggle = (id: string) => {
    const has = scartati.includes(id);
    const nuovo = has ? scartati.filter((x) => x !== id) : scartati.length < step.daScartare ? [...scartati, id] : scartati;
    onChange({ scartati: nuovo, motivazione: valore?.motivazione }, nuovo.length === step.daScartare);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-kireo-muted">Da tagliare {scartati.length}/{step.daScartare}</p>
      {step.opzioni.map((o) => {
        const on = scartati.includes(o.id);
        const pieno = !on && scartati.length >= step.daScartare;
        return (
          <div key={o.id} className={`${CARD} ${on ? "border-red-400/50 opacity-70" : ""} ${pieno ? "opacity-40" : ""}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={on} disabled={pieno} onChange={() => toggle(o.id)} className="mt-0.5 accent-red-400" />
              <span className={on ? "line-through" : ""}>{o.label}</span>
            </label>
            {o.avviso && <p className="mt-1 border-l-2 border-kireo-orange/50 pl-2 text-[11px] text-kireo-orange">{o.avviso}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────── previsione_poi_esito (4.1)
const LIVELLI_FIDUCIA = [
  { label: "Molto incerta", fiducia: 15 },
  { label: "Incerta", fiducia: 35 },
  { label: "Così così", fiducia: 50 },
  { label: "Abbastanza solida", fiducia: 70 },
  { label: "Molto solida", fiducia: 90 },
];
function PrevisioneInput({ valore, onChange, domanda }: { valore: PayloadPrevisione | null; onChange: OnChange; domanda: string }) {
  const scelto = valore?.fiducia;
  return (
    <div className={CARD}>
      <p className="mb-3">{domanda}</p>
      <div className="flex flex-wrap gap-2">
        {LIVELLI_FIDUCIA.map((l) => (
          <button
            key={l.fiducia}
            type="button"
            onClick={() => onChange({ fiducia: l.fiducia }, true)}
            className={`rounded-full border px-3 py-1.5 text-xs ${scelto === l.fiducia ? "border-kireo-green bg-kireo-green/10 text-kireo-light" : "border-white/15 text-kireo-muted hover:border-kireo-green/50"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── assegna_ruoli (4.3)
function AssegnaInput({ step, valore, onChange }: { step: StepAssegnaRuoli; valore: PayloadAssegna | null; onChange: OnChange }) {
  const ass = valore?.assegnazioni ?? {};
  const set = (id: string, chi: "io" | "altri") => {
    const nuovo = { ...ass, [id]: chi };
    onChange({ assegnazioni: nuovo }, step.ruoli.every((r) => nuovo[r.id]));
  };
  return (
    <div className="space-y-2">
      {step.ruoli.map((r) => (
        <div key={r.id} className={`flex flex-col gap-2 ${CARD} sm:flex-row sm:items-center sm:justify-between`}>
          <span>{r.label}</span>
          <span className="flex flex-none gap-2">
            <button type="button" onClick={() => set(r.id, "io")} className={`rounded-full border px-3 py-1 text-xs ${ass[r.id] === "io" ? "border-kireo-green bg-kireo-green/10 text-kireo-light" : "border-white/15 text-kireo-muted hover:border-kireo-green/50"}`}>
              Me ne occupo io
            </button>
            <button type="button" onClick={() => set(r.id, "altri")} className={`rounded-full border px-3 py-1 text-xs ${ass[r.id] === "altri" ? "border-white/40 bg-white/5 text-kireo-light" : "border-white/15 text-kireo-muted hover:border-white/40"}`}>
              Lo fa un altro
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────── pianifica_passi (5.2)
function PianificaInput({ step, valore, onChange }: { step: StepPianificaPassi; valore: PayloadPianifica | null; onChange: OnChange }) {
  const scelti = valore?.passi ?? [];
  const clic = (id: string) => {
    let nuovo: string[];
    if (scelti.includes(id)) nuovo = scelti.filter((x) => x !== id);
    else if (scelti.length < step.quanti) nuovo = [...scelti, id];
    else nuovo = scelti;
    onChange({ passi: nuovo }, nuovo.length === step.quanti);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-kireo-muted">Scelti {scelti.length}/{step.quanti} — l&apos;ordine in cui li tocchi è l&apos;ordine dei passi.</p>
      {step.passi.map((p) => {
        const pos = scelti.indexOf(p.id);
        const on = pos >= 0;
        const pieno = !on && scelti.length >= step.quanti;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => clic(p.id)}
            disabled={pieno}
            className={`flex w-full items-center gap-3 text-left ${CARD} ${on ? "border-kireo-green" : ""} ${pieno ? "opacity-40" : ""}`}
          >
            <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs ${on ? "bg-kireo-green text-kireo-dark" : "border border-white/20 text-kireo-muted"}`}>
              {on ? pos + 1 : ""}
            </span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────── decisione_scritta / riflessione
function TestoInput({ step, valore, onChange }: { step: StepDecisioneScritta | StepRiflessione; valore: PayloadTesto | null; onChange: OnChange }) {
  const testo = valore?.testo ?? "";
  const facoltativo = step.tipo === "decisione_scritta" && step.facoltativo;
  const righe = step.tipo === "decisione_scritta" && !facoltativo ? 8 : facoltativo ? 3 : 5;
  return (
    <div>
      <textarea
        value={testo}
        onChange={(e) => onChange({ testo: e.target.value }, e.target.value.trim().length >= step.minCaratteri)}
        rows={righe}
        placeholder={facoltativo ? "Scrivi qui, oppure lascia vuoto…" : "Scrivi qui…"}
        className="w-full resize-y rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted focus:border-kireo-green focus:outline-none"
      />
      {step.minCaratteri > 0 ? (
        <p className={`mt-1 text-xs ${testo.trim().length >= step.minCaratteri ? "text-kireo-muted" : "text-kireo-orange"}`}>{testo.trim().length}/{step.minCaratteri} caratteri minimi</p>
      ) : (
        <p className="mt-1 text-xs text-kireo-muted">Facoltativo</p>
      )}
    </div>
  );
}

// Dispatcher: rende l'input adatto al tipo di step.
export default function StepInput({ step, valore, onChange }: { step: Step; valore: Payload | null; onChange: OnChange }) {
  switch (step.tipo) {
    case "esplora_libero":
      return <EsploraInput step={step} valore={valore as PayloadEsplora | null} onChange={onChange} />;
    case "scelta_singola":
      return <SceltaSingolaInput step={step} valore={valore as PayloadSceltaSingola | null} onChange={onChange} />;
    case "ordina_priorita":
      return <OrdinaInput step={step} valore={valore as PayloadOrdina | null} onChange={onChange} />;
    case "seleziona_informazioni":
      return <SelezionaInput step={step} valore={valore as PayloadSeleziona | null} onChange={onChange} />;
    case "alloca_budget":
      return <AllocaInput step={step} valore={valore as PayloadAlloca | null} onChange={onChange} />;
    case "pianifica_lavori":
      return <LavoriInput step={step} valore={valore as PayloadLavori | null} onChange={onChange} />;
    case "scarta_opzione":
      return <ScartaInput step={step} valore={valore as PayloadScarta | null} onChange={onChange} />;
    case "previsione_poi_esito":
      return <PrevisioneInput valore={valore as PayloadPrevisione | null} onChange={onChange} domanda={step.domanda} />;
    case "assegna_ruoli":
      return <AssegnaInput step={step} valore={valore as PayloadAssegna | null} onChange={onChange} />;
    case "pianifica_passi":
      return <PianificaInput step={step} valore={valore as PayloadPianifica | null} onChange={onChange} />;
    case "decisione_scritta":
    case "riflessione":
      return <TestoInput step={step} valore={valore as PayloadTesto | null} onChange={onChange} />;
  }
}
