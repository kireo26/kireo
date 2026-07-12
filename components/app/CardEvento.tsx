import { getAreaBySlug } from "@/data/aree";
import IscrivitiEventoButton from "./IscrivitiEventoButton";
import type { Evento } from "@/lib/app/eventi";

const ETICHETTA_TIPO: Record<Evento["tipo"], string> = {
  webinar: "Webinar",
  workshop: "Workshop",
  altro: "Evento",
};

export default function CardEvento({
  evento,
  areeSlugs,
  userId,
  iscritto,
}: {
  evento: Evento;
  areeSlugs: string[];
  userId: string | null;
  iscritto: boolean;
}) {
  return (
    <li className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-kireo-orange/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-orange">
              {ETICHETTA_TIPO[evento.tipo]}
            </span>
            {evento.ore_pcto > 0 && (
              <span className="rounded-full bg-kireo-green/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-green-light">
                {evento.ore_pcto}h PCTO
              </span>
            )}
            {areeSlugs.map((slug) => {
              const area = getAreaBySlug(slug);
              return area ? (
                <span key={slug} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-kireo-light/80">
                  {area.nome}
                </span>
              ) : null;
            })}
          </div>
          <h3 className="mt-2 font-heading text-base font-semibold text-kireo-light">{evento.titolo}</h3>
          <p className="mt-1 text-sm text-kireo-muted">
            {new Date(evento.data_inizio).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}
            {evento.sede ? ` · ${evento.sede}` : " · Online"}
          </p>
          {evento.descrizione && <p className="mt-2 text-sm text-kireo-muted">{evento.descrizione}</p>}
          {evento.cta_esterna_url && evento.cta_esterna_approvata && (
            <a
              href={evento.cta_esterna_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-kireo-orange underline underline-offset-2"
            >
              Vai al sito ufficiale ↗
            </a>
          )}
        </div>
        <IscrivitiEventoButton
          eventoId={evento.id}
          areaSlug={areeSlugs[0] ?? null}
          organizzatoreId={evento.organizzatore_id}
          userId={userId}
          iscrittoIniziale={iscritto}
        />
      </div>
    </li>
  );
}
