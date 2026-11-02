"use client";

// «Copia il link» sulla riga di un invito in attesa (dal giro del 28/10): prima
// il link stava solo nel riquadro verde subito dopo la creazione, e dopo andava
// ricostruito a mano dal codice. La forma è la stessa di `InvitaTutorForm`.

import { useState } from "react";
import { linkInvitoTutor } from "@/lib/scuola/linkInvito";

export default function CopiaLinkInvito({ codice }: { codice: string }) {
  const [esito, setEsito] = useState<"copiato" | "non_copiato" | null>(null);
  const link = typeof window === "undefined" ? "" : linkInvitoTutor(window.location.origin, codice);

  async function copia() {
    try {
      await navigator.clipboard.writeText(linkInvitoTutor(window.location.origin, codice));
      setEsito("copiato");
    } catch {
      // Il browser può negare gli appunti: il link resta da selezionare a mano.
      setEsito("non_copiato");
    }
  }

  return (
    <span className="mt-1 block text-xs">
      <button type="button" onClick={copia} className="text-kireo-orange underline underline-offset-2">
        Copia il link dell&apos;invito
      </button>
      {esito === "copiato" ? <span className="ml-2 text-kireo-green">Copiato.</span> : null}
      {esito === "non_copiato" ? <span className="ml-2 break-all font-mono text-kireo-muted">Copialo da qui: {link}</span> : null}
    </span>
  );
}
