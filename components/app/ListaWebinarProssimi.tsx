"use client";

import { useState } from "react";
import { AREE, getAreaBySlug } from "@/data/aree";
import PrenotaWebinarButton from "./PrenotaWebinarButton";
import type { Webinar } from "@/lib/app/agenda";

export default function ListaWebinarProssimi({
  webinars,
  prenotati,
  userId,
}: {
  webinars: Webinar[];
  prenotati: string[];
  userId: string;
}) {
  const [filtro, setFiltro] = useState("");
  const prenotatiSet = new Set(prenotati);

  const areeDisponibili = AREE.filter((a) => webinars.some((w) => w.area_slug === a.slug));
  const webinarsFiltrati = filtro ? webinars.filter((w) => w.area_slug === filtro) : webinars;

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
        {webinarsFiltrati.map((w) => {
          const area = w.area_slug ? getAreaBySlug(w.area_slug) : undefined;
          return (
            <li key={w.id} className="rounded-2xl border border-white/5 bg-kireo-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  {area && (
                    <span className="mb-2 inline-block rounded-full bg-kireo-orange/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-orange">
                      {area.nome}
                    </span>
                  )}
                  <h3 className="font-heading text-base font-semibold text-kireo-light">{w.titolo}</h3>
                  <p className="mt-1 text-sm text-kireo-muted">
                    {new Date(w.data_ora).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })} · {w.durata_min} min
                  </p>
                  {w.descrizione && <p className="mt-2 text-sm text-kireo-muted">{w.descrizione}</p>}
                </div>
                <PrenotaWebinarButton webinarId={w.id} userId={userId} prenotatoIniziale={prenotatiSet.has(w.id)} />
              </div>
            </li>
          );
        })}
        {webinarsFiltrati.length === 0 && <p className="text-sm text-kireo-muted">Nessun webinar per questa area al momento.</p>}
      </ul>
    </div>
  );
}
