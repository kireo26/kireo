"use client";

import { APERTURA_SENZA_LINK, type EsitoSonda, testoSonda } from "@/lib/sondaYoutube";

const CLASSI_TONO: Record<"ok" | "errore" | "incerto", string> = {
  ok: "border-kireo-green/40 bg-kireo-green/10 text-kireo-light",
  errore: "border-red-500/40 bg-red-500/10 text-red-200",
  incerto: "border-kireo-orange/40 bg-kireo-orange/10 text-kireo-light",
};

// Il referto della sonda, uguale nel pannello dell'ente e in quello
// dell'admin: una misura che si racconta in due modi diversi nei due posti
// sarebbe una misura di cui non si sa più cosa dice.
export default function EsitoSondaIncorporamento({
  esito,
  inCorso,
  idVideo = null,
}: {
  esito: EsitoSonda | null;
  inCorso: boolean;
  idVideo?: string | null;
}) {
  if (inCorso) {
    return <p className="mt-2 text-xs text-kireo-muted">Stiamo provando il video…</p>;
  }
  if (!esito) return null;
  const testo = testoSonda(esito, idVideo);
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${CLASSI_TONO[testo.tono]}`}>
      <p className="font-semibold">{testo.titolo}</p>
      <p className="mt-0.5 opacity-90">{testo.dettaglio}</p>
      {testo.azione ? (
        <p className="mt-1 opacity-90">
          <a href={testo.azione.href} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
            {testo.azione.etichetta}
          </a>
          {testo.percorso ? ` → ${testo.percorso}` : " →"}
        </p>
      ) : (
        testo.percorso && (
          <p className="mt-1 opacity-90">
            {APERTURA_SENZA_LINK} → {testo.percorso}
          </p>
        )
      )}
    </div>
  );
}
