"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { statoDiretta } from "@/lib/live";
import { useHeartbeatDiretta } from "@/lib/useHeartbeatDiretta";
import BoxDomandeLive, { type Domanda } from "./BoxDomandeLive";

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

  useEffect(() => {
    const intervallo = setInterval(() => setOra(new Date()), 30000);
    return () => clearInterval(intervallo);
  }, []);

  const stato = statoDiretta(dataInizio, dataFine, ora);
  useHeartbeatDiretta(eventoId, stato === "in_corso");

  if (stato === "non_ancora") {
    return (
      <div className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center">
        <p className="font-heading text-lg font-semibold text-kireo-light">La diretta non è ancora iniziata</p>
        <p className="mt-2 text-sm text-kireo-muted">
          Inizia il {new Date(dataInizio).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}. Questa pagina si aggiorna da sola, torna
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
        <p className="mt-1 flex items-center gap-2 text-xs text-kireo-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> In diretta · presenza in rilevamento
        </p>
      </div>

      {youtubeVideoId ? (
        <div className="aspect-video overflow-hidden rounded-2xl border border-white/5">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
            title={titolo}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
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
