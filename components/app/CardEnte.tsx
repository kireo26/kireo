import Link from "next/link";
import { getAreaBySlug } from "@/data/aree";
import { etichettaTipoIstituzione } from "@/lib/app/istituzioni";
import type { EnteEsplora } from "@/lib/app/esplora";

// Riusata da /app/esplora, /scuola/esplora e dalla sezione "Enti di
// quest'area" su /aree/[slug]. azioneExtra lascia inserire un bottone
// specifico del contesto chiamante (Segui per lo studente, Proponi un
// incontro per la scuola) senza duplicare il resto della card.
export default function CardEnte({ ente, azioneExtra }: { ente: EnteEsplora; azioneExtra?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border bg-kireo-card p-5 ${ente.inEvidenza ? "border-kireo-orange/50" : "border-white/5"}`}>
      <div className="flex items-start gap-4">
        {ente.immagineCopertinaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ente.immagineCopertinaUrl} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-kireo-green/30 to-kireo-orange/20">
            <span className="font-heading text-xl font-bold text-kireo-light/50">{ente.nome.charAt(0)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {ente.inEvidenza && (
              <span className="rounded-full bg-kireo-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-kireo-dark">★ In evidenza</span>
            )}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-light/80">
              {etichettaTipoIstituzione(ente.tipo)}
            </span>
          </div>
          <Link href={`/istituzioni/${ente.slug}`} className="mt-1 block font-heading text-base font-semibold text-kireo-light hover:underline">
            {ente.nome}
          </Link>
          {ente.aree.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ente.aree.map((slug) => {
                const area = getAreaBySlug(slug);
                return area ? (
                  <span key={slug} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-kireo-light/70">
                    {area.nome}
                  </span>
                ) : null;
              })}
            </div>
          )}
          <p className="mt-2 text-xs text-kireo-muted">
            {ente.follower} follower · {ente.prossimiEventi} evento{ente.prossimiEventi === 1 ? "" : "i"} in programma
          </p>
        </div>
      </div>
      {azioneExtra && <div className="mt-4">{azioneExtra}</div>}
    </div>
  );
}
