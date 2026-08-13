"use client";

import { registraAttivita } from "@/lib/app/activityLog";
import type { Guida } from "@/lib/guide/config";

// Card di una singola guida. Due stati ORTOGONALI:
//  - disponibilità del PDF: il file esiste in public/guide/? (calcolata
//    server-side, passata come prop). Se no → «In preparazione».
//  - sblocco: l'area è abbastanza avanzata? In fase di test il gate è OFF
//    (gateAttivo=false): la guida resta apribile comunque, con SOLO
//    l'indicazione dello stato. Quando il gate sarà attivo, una guida non
//    sbloccata non sarà apribile.
//
// L'apertura traccia `download_guida` in activity_log (peso 5), stesso helper
// del resto del sito, poi apre il PDF in una nuova scheda.
export default function CardGuida({
  guida,
  disponibile,
  sbloccata,
  motivo,
  gateAttivo,
}: {
  guida: Guida;
  disponibile: boolean;
  sbloccata: boolean;
  motivo: string;
  gateAttivo: boolean;
}) {
  const bloccata = gateAttivo && !sbloccata;
  const apribile = disponibile && !bloccata;

  function apri() {
    if (!apribile) return;
    registraAttivita(guida.areaSlug, "download_guida", guida.livello);
    window.open(guida.pdf, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={`rounded-2xl border p-5 ${apribile ? "border-white/10 bg-kireo-card" : "border-white/5 bg-kireo-card/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-kireo-muted">Guida {guida.livello}</span>
          <h3 className="mt-0.5 font-heading text-base font-semibold text-kireo-light">{guida.titolo}</h3>
          <p className="mt-1 text-sm text-kireo-muted">{guida.sottotitolo}</p>
        </div>
        <span className="flex-none text-lg" aria-hidden>
          {bloccata ? "🔒" : disponibile ? "📄" : "✎"}
        </span>
      </div>

      {/* Indicazione di stato (sempre visibile). In test il lucchetto è solo
          informativo: la guida resta apribile se il PDF esiste. */}
      <p className={`mt-3 text-xs ${sbloccata ? "text-kireo-green-light" : "text-kireo-muted"}`}>{motivo}</p>

      <div className="mt-4">
        {apribile ? (
          <button type="button" onClick={apri} className="inline-block rounded-full bg-kireo-green px-4 py-1.5 text-sm font-semibold text-white hover:bg-kireo-green-light">
            Apri la guida →
          </button>
        ) : !disponibile ? (
          <span className="inline-block rounded-full border border-white/10 px-4 py-1.5 text-sm text-kireo-muted">In preparazione</span>
        ) : (
          <span className="inline-block rounded-full border border-white/10 px-4 py-1.5 text-sm text-kireo-muted">Bloccata per ora</span>
        )}
      </div>
    </div>
  );
}
