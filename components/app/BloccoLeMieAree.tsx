"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAreaAttiva } from "@/lib/assistente/config";
import { CAMPO_RITORNO } from "@/lib/guide/scaricamento";

export type AreaInteresse = { slug: string; nome: string; icona: string };

// Estratto dal blocco già presente nella vecchia Home minima: stesso
// markup, ora riusabile (Home e pagina Aree), con azioni rapide per chip
// (Scarica la guida / Parla con l'assistente).
//
// «Scarica la guida» è una POST alla route dell'area (29/10), come il form
// della pagina pubblica: la riga in `activity_log` la scrive il server PRIMA di
// rimandare al file. Prima qui c'erano `registraAttivita` senza aspettarla e
// `window.location.assign` subito dopo: la stessa gara del form, che il 29/10
// perdeva la riga secondo quanto durava la lettura della sessione (vedi
// `lib/guide/scaricamento.ts`). Il percorso del PDF lo decide la route con
// `percorsoGuidaUno`. Nessuna email: il chip non la chiede (`manda_link`).
export default function BloccoLeMieAree({ aree }: { aree: AreaInteresse[] }) {
  const percorso = usePathname();

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Le mie aree</h2>
      {/* La terza delle tre lenti, dichiarata: dette (qui) / dedotte (affinità) /
          dove sei passato (esplorazione). Serve a capire perché i tre elenchi
          non coincidono. */}
      <p className="mt-1 text-xs text-kireo-muted">Le aree che hai scelto al momento dell&apos;iscrizione.</p>
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
                <form method="post" action={`/api/scarica-guida/area/${area.slug}`}>
                  <input type="hidden" name={CAMPO_RITORNO} value={percorso ?? "/app"} />
                  <button type="submit" className="text-kireo-orange underline underline-offset-2">
                    Scarica la guida
                  </button>
                </form>
                {/* L'ASSISTENTE C'È PER UN'AREA SU DICIOTTO, e la scorciatoia
                    compare solo per quella. Fino al 27/09 compariva per tutte:
                    per le altre diciassette portava su `/aree/[slug]
                    #assistente-digitale`, dove il bottone «Parla con
                    l'assistente digitale» dice «Non è ancora attivo» SOLO AL
                    CLIC. Non era un link rotto — era peggio: due clic per
                    scoprire che la cosa non esiste, e con la stessa etichetta
                    di quella che esiste.

                    Non è la regola della barra («mostra l'ordine, non il
                    permesso»): là la voce c'è e chi ci arriva legge cosa manca.
                    Qui non manca un passo, manca la cosa — non c'è niente da
                    nominare, quindi non c'è niente da invitare. */}
                {isAreaAttiva(area.slug) && (
                  <Link href={`/app/assistente/${area.slug}`} className="text-kireo-orange underline underline-offset-2">
                    Assistente
                  </Link>
                )}
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
