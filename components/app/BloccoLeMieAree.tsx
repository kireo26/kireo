"use client";

import Link from "next/link";
import { registraAttivita } from "@/lib/app/activityLog";
import { isAreaAttiva } from "@/lib/assistente/config";

export type AreaInteresse = { slug: string; nome: string; icona: string };

// Estratto dal blocco già presente nella vecchia Home minima: stesso
// markup, ora riusabile (Home e pagina Aree), con azioni rapide per chip
// (Scarica la guida / Parla con l'assistente).
export default function BloccoLeMieAree({ aree }: { aree: AreaInteresse[] }) {
  function handleScaricaGuida(slug: string) {
    registraAttivita(slug, "download_guida");
    window.location.href = `/api/guida/${slug}`;
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Le mie aree</h2>
      {aree.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {aree.map((area) => (
            <li
              key={area.slug}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
            >
              <Link href={`/aree/${area.slug}`} className="flex items-center gap-2 text-sm text-kireo-light hover:text-kireo-orange">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-xs font-bold text-kireo-orange">
                  {area.icona}
                </span>
                {area.nome}
              </Link>
              <div className="flex flex-none flex-wrap gap-x-4 gap-y-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleScaricaGuida(area.slug)}
                  className="text-kireo-orange underline underline-offset-2"
                >
                  Scarica la guida
                </button>
                <Link
                  href={isAreaAttiva(area.slug) ? `/app/assistente/${area.slug}` : `/aree/${area.slug}#assistente-digitale`}
                  className="text-kireo-orange underline underline-offset-2"
                >
                  Assistente
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-kireo-muted">
          Non hai ancora scelto le aree che ti incuriosiscono.{" "}
          <Link href="/app/profilo" className="text-kireo-orange underline underline-offset-2">
            Scegline fino a 3
          </Link>
          .
        </p>
      )}
    </div>
  );
}
