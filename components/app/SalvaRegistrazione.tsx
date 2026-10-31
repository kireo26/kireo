"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { TESTI_REGISTRAZIONI_SALVATE as T } from "@/lib/app/registrazioniSalvate";
import { HREF_LE_MIE_COSE } from "@/lib/app/leMieCose";

// «Salva» per una registrazione (31/10). La copia la scrive il database
// (`salva_registrazione`), e togliere cancella la propria riga contando quante
// ne ha tolte (zero è un rifiuto, il modo 11).
//
// Chi non ha fatto l'accesso legge che serve l'accesso, con il link che lo
// riporta qui: non un bottone che poi fallisce. `stato` null = niente da
// mostrare (chi non è uno studente, o una lettura fallita: non si afferma
// niente).
export default function SalvaRegistrazione({
  eventoId,
  stato,
}: {
  eventoId: string;
  stato: "accedi" | "salva" | "salvata" | null;
}) {
  // Dopo l'accesso si torna dove si era: la pagina dell'ente, dell'area o la registrazione.
  const ritorno = usePathname() || "/";
  const [salvata, setSalvata] = useState(stato === "salvata");
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  if (stato === null) return null;
  if (stato === "accedi") {
    return (
      <p className="mt-1.5 text-xs text-kireo-muted">
        {T.accedi}{" "}
        <Link href={`/accedi?redirectedFrom=${encodeURIComponent(ritorno)}`} className="text-kireo-orange underline underline-offset-2">
          {T.accediLink}
        </Link>
      </p>
    );
  }

  async function cambia() {
    setLavoro(true);
    setErrore(null);
    try {
      const supabase = createClient();
      if (!salvata) {
        const { data, error } = await supabase.rpc("salva_registrazione", { p_evento: eventoId });
        const esito = (data as { stato?: string } | null)?.stato;
        if (error || (esito !== "salvata" && esito !== "gia_salvata")) {
          if (error) console.error("[registrazioni] salva_registrazione:", descriviErrore(error));
          setErrore(esito === "non_rivedibile" ? T.nonRivedibile : T.nonRiuscito);
          return;
        }
        setSalvata(true);
      } else {
        const { data, error } = await supabase.from("registrazioni_salvate").delete().eq("evento_id", eventoId).select("id");
        if (error || !data || data.length === 0) {
          if (error) console.error("[registrazioni] togli un salvataggio:", descriviErrore(error));
          setErrore(T.togliNonRiuscito);
          return;
        }
        setSalvata(false);
      }
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div className="mt-1.5">
      <button type="button" onClick={cambia} disabled={lavoro} className="text-xs font-medium text-kireo-orange underline underline-offset-2 disabled:opacity-50">
        {salvata ? T.salvata : T.salva}
      </button>
      {salvata && (
        <p className="mt-1 text-xs text-kireo-muted">
          <Link href={`${HREF_LE_MIE_COSE}?tipo=registrazioni`} className="hover:underline">{T.salvataDove}</Link>
        </p>
      )}
      {errore && <p className="mt-1 text-xs text-red-400">{errore}</p>}
    </div>
  );
}
