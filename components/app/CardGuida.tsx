"use client";

import type { Guida } from "@/lib/guide/config";
import ApriGuidaButton from "./ApriGuidaButton";

// Card di una singola guida. Due stati ORTOGONALI:
//  - disponibilità del PDF: la guida è già scritta? (dichiarata in GUIDE_PRONTE,
//    passata come prop). Se no → «In preparazione»: non c'è niente da sbloccare.
//  - sblocco: l'area è abbastanza avanzata, e l'ordine è stato rispettato?
//    Dal 2026-09-26 `gateAttivo` è VERO, quindi una guida non sbloccata non si
//    apre: il bottone non c'è. Prima era solo informativo.
//
// QUESTA CARD È LA STRADA, NON LA RETE. Il cancello vero sta nella rotta che
// serve i PDF riservati (app/api/guide/...): qui si evita solo di offrire una
// porta che poi si chiude in faccia. Un rifiuto della rotta atterrerebbe in una
// scheda nuova, ed è la peggior forma di un no — per questo la card non ci fa
// nemmeno arrivare.
//
// L'apertura traccia `download_guida` in activity_log CON IL LIVELLO: non è
// telemetria, è il fatto che la sequenza legge («la 2 si apre dopo la 1») — e sta
// in `ApriGuidaButton`, insieme all'apertura, perché anche la riga di azioni in
// fondo alla pagina apre una guida e un secondo gesto che registra divergerebbe.
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

      {/* Il motivo è SEMPRE visibile, sbloccata o no: una guida chiusa senza il
          passo che manca è un no che non si può usare. */}
      <p className={`mt-3 text-xs ${sbloccata ? "text-kireo-green-light" : "text-kireo-muted"}`}>{motivo}</p>

      <div className="mt-4">
        {apribile ? (
          <ApriGuidaButton areaSlug={guida.areaSlug} livello={guida.livello} pdf={guida.pdf} etichetta="Apri la guida →" />
        ) : !disponibile ? (
          <span className="inline-block rounded-full border border-white/10 px-4 py-1.5 text-sm text-kireo-muted">In preparazione</span>
        ) : (
          <span className="inline-block rounded-full border border-white/10 px-4 py-1.5 text-sm text-kireo-muted">Bloccata per ora</span>
        )}
      </div>
    </div>
  );
}
