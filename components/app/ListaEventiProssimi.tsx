"use client";

import { useState } from "react";
import { AREE } from "@/data/aree";
import CardEvento from "./CardEvento";
import type { Evento } from "@/lib/app/eventi";

export default function ListaEventiProssimi({
  eventi,
  areeDegliEventi,
  iscrizioni,
  userId,
}: {
  eventi: Evento[];
  areeDegliEventi: Record<string, string[]>;
  iscrizioni: string[];
  userId: string;
}) {
  const [filtro, setFiltro] = useState("");
  const iscrizioniSet = new Set(iscrizioni);

  const slugPresenti = new Set(Object.values(areeDegliEventi).flat());
  const areeDisponibili = AREE.filter((a) => slugPresenti.has(a.slug));
  const eventiFiltrati = filtro ? eventi.filter((e) => (areeDegliEventi[e.id] ?? []).includes(filtro)) : eventi;

  return (
    <div>
      {areeDisponibili.length > 0 && (
        <div className="mb-4">
          <label htmlFor="filtro-area" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Filtra per area
          </label>
          <select
            id="filtro-area"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-white/10 bg-kireo-dark px-4 py-2.5 text-sm text-kireo-light"
          >
            <option value="">Tutte le aree</option>
            {areeDisponibili.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <ul className="space-y-4">
        {eventiFiltrati.map((evento) => (
          <CardEvento
            key={evento.id}
            evento={evento}
            areeSlugs={areeDegliEventi[evento.id] ?? []}
            userId={userId}
            iscritto={iscrizioniSet.has(evento.id)}
          />
        ))}
        {eventiFiltrati.length === 0 && <p className="text-sm text-kireo-muted">Nessun evento per questa area al momento.</p>}
      </ul>
    </div>
  );
}
