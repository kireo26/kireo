import { getFiloneBySlug } from "@/data/filoniDocenti";
import IscrivitiWebinarButton from "./IscrivitiWebinarButton";
import EntraDirettaLink from "@/components/EntraDirettaLink";
import type { WebinarDocente } from "@/lib/docente/eventi";
import { formattaDataOra } from "@/lib/formato";
import { faseIscrizione } from "@/lib/live";

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
  // Gli stessi tre stati dell'area studente (vedi `faseIscrizione` in
  // lib/live.ts): prima «Iscriviti», a webinar in corso «Iscriviti ed entra»
  // per chi non è iscritto, a webinar finito niente — fino al 18/10 qui
  // «Iscriviti» compariva anche su un webinar finito, e «Iscritto ✓» lasciava
  // disdire un'iscrizione a un incontro già tenuto.
  const fase = faseIscrizione(webinar.data_inizio, webinar.data_fine);
  const hrefDiretta = `/docente/webinar/${webinar.id}/live`;

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
            {formattaDataOra(webinar.data_inizio, "full")}
          </p>
          {webinar.descrizione && <p className="mt-2 text-sm text-kireo-muted">{webinar.descrizione}</p>}
          <p className="mt-2 text-xs text-kireo-muted">Organizzato da {webinar.organizzatore_nome ?? "KIREO"}</p>
          <EntraDirettaLink
            href={hrefDiretta}
            dataInizio={webinar.data_inizio}
            dataFine={webinar.data_fine}
            youtubeVideoId={webinar.youtube_video_id}
            iscritto={Boolean(stato)}
          />
        </div>
        {stato !== "partecipato" && fase === "prima" && (
          <IscrivitiWebinarButton eventoId={webinar.id} userId={userId} iscrittoIniziale={Boolean(stato)} />
        )}
        {fase === "in_corso" && !stato && (
          <IscrivitiWebinarButton eventoId={webinar.id} userId={userId} iscrittoIniziale={false} entraHref={hrefDiretta} />
        )}
      </div>
    </li>
  );
}
