"use client";

import { registraAttivita } from "@/lib/app/activityLog";
import type { LivelloGuida } from "@/lib/guide/config";

// Aprire una guida è UN gesto, e vive qui perché ha due punti di montaggio: la
// card (`CardGuida`) e la riga di azioni in fondo alla pagina dell'area, quando
// il passo che manca è la sequenza.
//
// PERCHÉ NON UN LINK. Il fatto che fa avanzare la sequenza è la riga in
// `activity_log` con il `livello`: `statoSblocco` guarda `giaAperte`, non il
// filesystem. Un `<a href={pdf}>` in fondo alla pagina aprirebbe il PDF **senza
// registrare niente**, quindi la Guida 2 resterebbe chiusa e la pagina
// continuerebbe a chiedere di aprire la Panoramica a chi l'ha appena aperta: un
// giro chiuso, e il tipo di difetto che nessuna prova automatica prende perché il
// PDF si scarica davvero.
//
// PERCHÉ UN COMPONENTE E NON DUE COPIE DELLE TRE RIGHE. Sono tre righe, ed è
// proprio la taglia che invita a ricopiarle — e una copia del gesto che registra
// è una copia che un giorno si dimentica il `livello`, cioè torna al difetto di
// sopra per un'altra strada. `npm run test:guide` pretende che l'apertura di una
// guida passi solo da qui.
export default function ApriGuidaButton({
  areaSlug,
  livello,
  pdf,
  etichetta,
}: {
  areaSlug: string;
  livello: LivelloGuida;
  pdf: string;
  etichetta: string;
}) {
  function apri() {
    registraAttivita(areaSlug, "download_guida", livello);
    window.open(pdf, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={apri}
      className="inline-block rounded-full bg-kireo-green px-4 py-1.5 text-sm font-semibold text-white hover:bg-kireo-green-light"
    >
      {etichetta}
    </button>
  );
}
