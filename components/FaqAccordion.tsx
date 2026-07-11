"use client";

import { useId, useState } from "react";

export type FaqItem = { domanda: string; risposta: string };

// Accordion accessibile: bottone con aria-expanded/aria-controls, un solo
// pannello aperto alla volta. Niente <details> perché serve il controllo
// esplicito dello stato per garantire l'esclusività tra le voci.
export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [aperta, setAperta] = useState<number | null>(null);
  const baseId = useId();

  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const isOpen = aperta === i;
        const triggerId = `${baseId}-trigger-${i}`;
        const panelId = `${baseId}-panel-${i}`;
        return (
          <div key={item.domanda} className="rounded-xl border border-white/5 bg-kireo-card">
            <h3>
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setAperta(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left font-heading text-base font-semibold leading-[1.25] text-kireo-light"
              >
                {item.domanda}
                <span
                  aria-hidden="true"
                  className={`text-kireo-orange transition-transform ${isOpen ? "rotate-45" : ""}`}
                >
                  +
                </span>
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!isOpen} className="px-5 pb-5">
              <p className="text-sm text-kireo-muted">{item.risposta}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
