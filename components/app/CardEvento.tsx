import { getAreaBySlug } from "@/data/aree";
import IscrivitiEventoButton from "./IscrivitiEventoButton";
import EntraDirettaLink from "@/components/EntraDirettaLink";
import type { Evento } from "@/lib/app/eventi";
import { formattaDataOra } from "@/lib/formato";
import { numeroOre } from "@/lib/eventi/orePcto";
import { faseIscrizione, fineEffettiva } from "@/lib/live";
import { hrefRivedi, registrazioneRivedibile, TESTI_RIVEDI } from "@/lib/eventi/registrazione";
import Link from "next/link";

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
  origineIscrizione = null,
  mostraOre = true,
}: {
  evento: Evento;
  areeSlugs: string[];
  userId: string | null;
  iscritto: boolean;
  // "scuola": iscrizione d'ufficio, non un segnale di interesse dello
  // studente — solo un'etichetta informativa, il bottone resta invariato.
  origineIscrizione?: "studente" | "scuola" | null;
  // Falso nell'ARCHIVIO della pagina di un ente (Mario, 26/10): su un evento
  // passato le ore della card possono essere state corrette dopo la chiusura,
  // mentre quelle di chi c'era sono quelle certificate allora. Una variante
  // della stessa card, non una seconda card: due card divergono.
  mostraOre?: boolean;
}) {
  // TRE STATI, NON DUE (decisione di Mario, 18/10 — vedi `faseIscrizione` in
  // lib/live.ts). Prima dell'inizio «Iscriviti»; a diretta IN CORSO «Iscriviti
  // ed entra», un gesto solo; a evento finito niente.
  //
  // La metà del 28/09 resta: `getEventiPerArea` non filtra per data — di
  // proposito, un'area mostra anche quello che è già stato — e un incontro
  // FINITO non deve chiedere a nessuno di prenotarsi. Quello che è cambiato è
  // l'evento in corso: lì iscriversi è la porta, e senza bottone la card era
  // muta per chi arrivava in ritardo.
  // ⚠️ «Entra» solo dove c'è una diretta in cui entrare: un webinar. Un
  // incontro in presenza già cominciato resta senza bottone, come prima.
  // La fine EFFETTIVA: una diretta chiusa in anticipo non offre più «Entra».
  const fine = fineEffettiva(evento.data_inizio, evento.data_fine, evento.diretta_chiusa_il);
  const fase = faseIscrizione(evento.data_inizio, fine);
  const hrefDiretta = `/app/eventi/${evento.id}/live`;
  const iscrizione =
    fase === "prima" ? (
      <IscrivitiEventoButton
        eventoId={evento.id}
        areaSlug={areeSlugs[0] ?? null}
        organizzatoreId={evento.organizzatore_id}
        userId={userId}
        iscrittoIniziale={iscritto}
      />
    ) : fase === "in_corso" && evento.tipo === "webinar" && !iscritto ? (
      <IscrivitiEventoButton
        eventoId={evento.id}
        areaSlug={areeSlugs[0] ?? null}
        organizzatoreId={evento.organizzatore_id}
        userId={userId}
        iscrittoIniziale={false}
        entraHref={hrefDiretta}
      />
    ) : null;

  return (
    <li className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {evento.in_evidenza && (
              <span className="rounded-full bg-kireo-orange px-2.5 py-0.5 text-xs font-semibold text-kireo-dark">★ In evidenza</span>
            )}
            <span className="rounded-full bg-kireo-orange/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-orange">
              {ETICHETTA_TIPO[evento.tipo]}
            </span>
            {mostraOre && evento.ore_pcto > 0 && (
              <span className="rounded-full bg-kireo-green/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-green-light">
                {numeroOre(evento.ore_pcto)}h PCTO
              </span>
            )}
            {/* «Avevi» è un passato: vero solo a evento FINITO. A diretta in
                corso il posto ce l'ha adesso, e il link per entrare è qui sotto. */}
            {iscritto && fase === "finita" && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-kireo-light/80">Avevi un posto</span>
            )}
            {iscritto && origineIscrizione === "scuola" && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-kireo-light/80">Ti ha iscritto la tua scuola</span>
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
            {formattaDataOra(evento.data_inizio, "full")}
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
          <EntraDirettaLink
            href={hrefDiretta}
            dataInizio={evento.data_inizio}
            dataFine={fine}
            youtubeVideoId={evento.youtube_video_id}
            iscritto={iscritto}
          />
          {/* RIVEDERE (31/10): aperto a tutti, iscritti o no, solo se la sonda
              ha visto la registrazione partire. E accanto, sempre, che non è
              una partecipazione: chi guarda due ore e poi non trova niente in
              «Le mie attività» deve averlo saputo prima. */}
          {registrazioneRivedibile(evento) && (
            <div className="mt-3">
              <Link
                href={hrefRivedi(evento.id)}
                className="inline-flex items-center rounded-full border border-kireo-orange/60 px-4 py-2 text-xs font-semibold text-kireo-orange transition-colors hover:bg-kireo-orange/10"
              >
                {TESTI_RIVEDI.bottone}
              </Link>
              <p className="mt-1.5 text-xs text-kireo-muted">{TESTI_RIVEDI.nonConta}</p>
            </div>
          )}
        </div>
        {iscrizione}
      </div>
    </li>
  );
}
