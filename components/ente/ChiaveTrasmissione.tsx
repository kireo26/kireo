"use client";

import { useState } from "react";
import { type StatoChiave, testoChiaveTrasmissione } from "@/lib/eventi/chiaveTrasmissione";

const CLASSI_TONO: Record<"ok" | "attesa" | "errore", string> = {
  ok: "border-kireo-green/40 bg-kireo-green/10",
  attesa: "border-kireo-orange/40 bg-kireo-orange/10",
  errore: "border-red-500/40 bg-red-500/10",
};

// NASCOSTA DI DEFAULT, e non è prudenza generica: un ente che sta per andare
// in diretta a volte condivide lo schermo, e chi vede la chiave trasmette sul
// canale di KIREO. Mostrarla è un gesto, non lo stato normale della pagina.
export default function ChiaveTrasmissione({
  stato,
  chiave,
  aggiornataIl,
}: {
  stato: StatoChiave;
  chiave: string | null;
  aggiornataIl: string | null;
}) {
  const [visibile, setVisibile] = useState(false);
  const [copiata, setCopiata] = useState(false);
  const testo = testoChiaveTrasmissione(stato, aggiornataIl);

  async function copia() {
    if (!chiave) return;
    try {
      await navigator.clipboard.writeText(chiave);
      setCopiata(true);
      setTimeout(() => setCopiata(false), 2000);
    } catch {
      // Se la clipboard non è disponibile resta il bottone «Mostra»: la
      // chiave si copia a mano. Un fallimento qui non deve togliere l'unica
      // strada che c'è.
      setVisibile(true);
    }
  }

  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${CLASSI_TONO[testo.tono]}`}>
      <p className="font-semibold text-kireo-light">{testo.titolo}</p>
      <p className="mt-0.5 text-kireo-muted">{testo.dettaglio}</p>
      {stato === "pronta" && chiave && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded bg-kireo-dark px-2 py-1 font-mono text-[11px] text-kireo-light">
            {visibile ? chiave : "••••••••••••••••"}
          </code>
          <button type="button" onClick={() => setVisibile((v) => !v)} className="text-kireo-orange underline underline-offset-2">
            {visibile ? "Nascondi" : "Mostra"}
          </button>
          <button type="button" onClick={copia} className="text-kireo-orange underline underline-offset-2">
            {copiata ? "Copiata" : "Copia"}
          </button>
        </div>
      )}
    </div>
  );
}
