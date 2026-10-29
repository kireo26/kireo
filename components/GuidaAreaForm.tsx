"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ScaricaGuidaForm from "./ScaricaGuidaForm";
import { createClient } from "@/lib/supabase/client";
import { isAreaAttiva } from "@/lib/assistente/config";
import { testoEsitoGuida } from "@/lib/guide/testiScaricamento";

// La Panoramica di un'area. Lo scaricamento passa da
// `/api/scarica-guida/area/[areaSlug]`, che scrive la riga in `activity_log`
// PRIMA di mandare il file (29/10): fino ad allora la scrittura stava qui, dopo
// `window.location.href`, e arrivava o no secondo quanto durava la lettura
// della sessione (vedi `lib/guide/scaricamento.ts`). Il file lo decide la route
// con `percorsoGuidaUno`: qui non c'è nessun percorso.
//
// La pagina dell'area è statica, quindi chi ha fatto l'accesso lo si sa solo
// qui, nel browser. Finché non lo sappiamo si mostra il form con l'email: per
// chi ha fatto l'accesso il server usa comunque l'indirizzo dell'account.
export default function GuidaAreaForm({ areaNome, areaSlug }: { areaNome: string; areaSlug: string }) {
  const [emailAccount, setEmailAccount] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // L'esito di un rifiuto della route torna in `?guida=`: la pagina è
    // statica, quindi lo si legge qui, insieme alla sessione.
    const daUrl = testoEsitoGuida(new URLSearchParams(window.location.search).get("guida") ?? undefined);
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (vivo) setEsito(daUrl);
        if (vivo && data.session?.user) setEmailAccount(data.session.user.email ?? "");
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <ScaricaGuidaForm
      azione={`/api/scarica-guida/area/${areaSlug}`}
      emailAccount={emailAccount}
      esito={esito}
      sotto={<p className="text-center text-xs text-kireo-muted">Guida di orientamento — {areaNome}</p>}
      conferma={
        isAreaAttiva(areaSlug) && (
          <p className="mt-4 text-sm">
            <Link href={`/app/assistente/${areaSlug}`} className="text-kireo-orange underline underline-offset-2">
              Hai altre domande? Parla con l&apos;assistente digitale →
            </Link>
          </p>
        )
      }
    />
  );
}
