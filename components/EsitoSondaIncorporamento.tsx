"use client";

import { type EsitoSonda, testoSonda } from "@/lib/sondaYoutube";

const CLASSI_TONO: Record<"ok" | "errore" | "incerto", string> = {
  ok: "border-kireo-green/40 bg-kireo-green/10 text-kireo-light",
  errore: "border-red-500/40 bg-red-500/10 text-red-200",
  incerto: "border-kireo-orange/40 bg-kireo-orange/10 text-kireo-light",
};

// Il referto della sonda, uguale nel pannello dell'ente e in quello
// dell'admin: una misura che si racconta in due modi diversi nei due posti
// sarebbe una misura di cui non si sa più cosa dice.
export default function EsitoSondaIncorporamento({ esito, inCorso }: { esito: EsitoSonda | null; inCorso: boolean }) {
  if (inCorso) {
    return <p className="mt-2 text-xs text-kireo-muted">Stiamo provando il video…</p>;
  }
  if (!esito) return null;
  const testo = testoSonda(esito);
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${CLASSI_TONO[testo.tono]}`}>
      <p className="font-semibold">{testo.titolo}</p>
      <p className="mt-0.5 opacity-90">{testo.dettaglio}</p>
    </div>
  );
}
