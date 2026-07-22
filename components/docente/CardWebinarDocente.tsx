import { getFiloneBySlug } from "@/data/filoniDocenti";
import IscrivitiWebinarButton from "./IscrivitiWebinarButton";
import type { WebinarDocente } from "@/lib/docente/eventi";

export default function CardWebinarDocente({
  webinar,
  userId,
  stato,
}: {
  webinar: WebinarDocente;
  userId: string;
  stato: string | undefined;
}) {
  const filone = getFiloneBySlug(webinar.filone);

  return (
    <li className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {filone && (
              <span className="rounded-full bg-kireo-orange/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-orange">{filone.nome}</span>
            )}
            {stato === "partecipato" && (
              <span className="rounded-full bg-kireo-green/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-green-light">
                Partecipazione certificata
              </span>
            )}
          </div>
          <h3 className="mt-2 font-heading text-base font-semibold text-kireo-light">{webinar.titolo}</h3>
          <p className="mt-1 text-sm text-kireo-muted">
            {new Date(webinar.data_inizio).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}
          </p>
          {webinar.descrizione && <p className="mt-2 text-sm text-kireo-muted">{webinar.descrizione}</p>}
          <p className="mt-2 text-xs text-kireo-muted">Organizzato da {webinar.organizzatore_nome ?? "KIREO"}</p>
        </div>
        {stato !== "partecipato" && <IscrivitiWebinarButton eventoId={webinar.id} userId={userId} iscrittoIniziale={Boolean(stato)} />}
      </div>
    </li>
  );
}
