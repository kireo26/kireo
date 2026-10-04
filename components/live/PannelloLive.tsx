"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { statoDiretta } from "@/lib/live";
import { useHeartbeatDiretta } from "@/lib/useHeartbeatDiretta";
import BoxDomandeLive, { type Domanda } from "./BoxDomandeLive";
import { formattaDataOra } from "@/lib/formato";
import PlayerDiretta from "./PlayerDiretta";
import { type EsitoSonda, TESTO_DIRETTA_ROTTA, presenzaDaContare, sondaBlocca } from "@/lib/sondaYoutube";

// Pannello condiviso studenti/docenti (stessa meccanica, l'unica differenza
// — nome visibile o meno all'organizzatore nelle domande — è decisa lato
// server da domande_live_organizzatore, non qui). Ricalcola lo stato ogni
// 30s così la pagina passa da sola da "non ancora iniziata" a "in diretta"
// a "conclusa" senza bisogno di un refresh manuale.
export default function PannelloLive({
  eventoId,
  userId,
  titolo,
  dataInizio,
  dataFine,
  youtubeVideoId,
  domandeIniziali,
  hrefRitorno,
}: {
  eventoId: string;
  userId: string;
  titolo: string;
  dataInizio: string;
  dataFine: string | null;
  youtubeVideoId: string | null;
  domandeIniziali: Domanda[];
  hrefRitorno: string;
}) {
  const [ora, setOra] = useState(() => new Date());
  const [esitoPlayer, setEsitoPlayer] = useState<EsitoSonda | null>(null);

  useEffect(() => {
    const intervallo = setInterval(() => setOra(new Date()), 30000);
    return () => clearInterval(intervallo);
  }, []);

  const stato = statoDiretta(dataInizio, dataFine, ora);
  // SE IL VIDEO NON SI VEDE, SI SMETTE DI CONTARE. Tenere qualcuno su una
  // pagina vuota e registrargli una presenza è un falso che scriviamo noi:
  // quei ping dicono «era qui a seguire», e da quei ping escono le ore PCTO.
  // La regola sta in `presenzaDaContare`, con il perché e con il motivo per
  // cui i ping già registrati non si scontano.
  const contaLaPresenza = presenzaDaContare(esitoPlayer);
  useHeartbeatDiretta(eventoId, stato === "in_corso" && contaLaPresenza);
  const videoRotto = esitoPlayer !== null && sondaBlocca(esitoPlayer);
  const segnalaErrorePlayer = useCallback((esito: EsitoSonda) => setEsitoPlayer(esito), []);

  if (stato === "non_ancora") {
    return (
      <div className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center">
        <p className="font-heading text-lg font-semibold text-kireo-light">La diretta non è ancora iniziata</p>
        <p className="mt-2 text-sm text-kireo-muted">
          Inizia il {formattaDataOra(dataInizio, "full")}. Questa pagina si aggiorna da sola, torna
          a trovarci qualche minuto prima.
        </p>
        <Link href={hrefRitorno} className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
          ← Torna indietro
        </Link>
      </div>
    );
  }

  if (stato === "conclusa") {
    return (
      <div className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center">
        <p className="font-heading text-lg font-semibold text-kireo-light">La diretta è terminata</p>
        <p className="mt-2 text-sm text-kireo-muted">Grazie per aver partecipato.</p>
        <Link href={hrefRitorno} className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
          ← Torna indietro
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">{titolo}</h1>
        {/* La riga non dichiara un rilevamento che abbiamo appena fermato:
            quando il video non si vede smettiamo di contare, e dirlo
            comunque sarebbe la stessa bugia un piano più in su. */}
        <p className="mt-1 flex items-center gap-2 text-xs text-kireo-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> In diretta
          {contaLaPresenza ? " · presenza in rilevamento" : ""}
        </p>
      </div>

      {youtubeVideoId && !videoRotto ? (
        <div className="aspect-video overflow-hidden rounded-2xl border border-white/5">
          <PlayerDiretta videoId={youtubeVideoId} titolo={titolo} onErrore={segnalaErrorePlayer} />
        </div>
      ) : youtubeVideoId && videoRotto ? (
        /*
          IL VIDEO C'È E NON SI RIPRODUCE. La pagina RESTA APERTA e non
          dichiara l'evento non seguibile: le domande qui sotto e la consegna
          finale funzionano lo stesso, e da questo momento sono le sole cose
          che possono ancora produrre qualcosa — chiudere la pagina
          toglierebbe allo studente anche il modo di dire qualcosa.
          ⚠️ Il testo è di servizio e va riletto (voce): vedi
          TESTO_DIRETTA_ROTTA in lib/sondaYoutube.ts.
        */
        <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/5 px-6 text-center">
          <p className="font-heading text-lg font-semibold text-kireo-light">{TESTO_DIRETTA_ROTTA.titolo}</p>
          <p className="mt-2 max-w-md text-sm text-kireo-muted">{TESTO_DIRETTA_ROTTA.dettaglio}</p>
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-white/5 bg-kireo-card text-center">
          <p className="font-heading text-lg font-semibold text-kireo-light">Diretta non disponibile</p>
          <p className="mt-2 max-w-sm text-sm text-kireo-muted">
            Riprova tra qualche minuto: se il problema persiste, contatta l&apos;organizzatore.
          </p>
        </div>
      )}

      <BoxDomandeLive eventoId={eventoId} userId={userId} domandeIniziali={domandeIniziali} />
    </div>
  );
}
