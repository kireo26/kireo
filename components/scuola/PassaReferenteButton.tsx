"use client";

// Il referente passa la scuola a un tutor attivo (02/11): è la condizione per
// andarsene (`delete_own_account` non lascia una scuola senza referente), e il
// prodotto la rende soddisfacibile da qui. Due clic: il primo dice cosa
// succede, il secondo lo fa.

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { sessioneAncoraViva } from "@/lib/rifiutiScrittura";
import { testoConfermaPassaggio, testoErrorePassaggio, TESTI_PASSAGGIO } from "@/lib/account/cancellazione";

export default function PassaReferenteButton({ staffId, nome }: { staffId: string; nome: string }) {
  const [conferma, setConferma] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

  async function passa() {
    setInCorso(true);
    setErrore(null);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("passa_referente", { p_staff_id: staffId });
      if (error) {
        console.error("passa_referente non riuscita", descriviErrore(error));
        setErrore(testoErrorePassaggio(error, await sessioneAncoraViva(supabase)));
        return;
      }
      setFatto(true);
    } catch (e) {
      console.error("passa_referente non arrivata", descriviErrore(e));
      setErrore(testoErrorePassaggio(null, true));
    } finally {
      setInCorso(false);
    }
  }

  // Dopo il passaggio questa pagina non è più sua (Staff è solo del
  // referente): non si rilegge, si dice dove andare.
  if (fatto) {
    return (
      <p className="mt-2 text-xs text-kireo-green">
        {TESTI_PASSAGGIO.fatto}{" "}
        <Link href="/account" className="underline underline-offset-2">
          Il mio account
        </Link>
        {" · "}
        <Link href="/scuola" className="underline underline-offset-2">
          Home
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-2 text-xs">
      {!conferma ? (
        <button type="button" onClick={() => setConferma(true)} className="text-kireo-orange underline underline-offset-2">
          Rendi referente
        </button>
      ) : (
        <span>
          <span className="text-kireo-light">{testoConfermaPassaggio(nome)}</span>{" "}
          <button type="button" onClick={passa} disabled={inCorso} className="font-semibold text-kireo-orange underline underline-offset-2">
            {inCorso ? "…" : "Sì, rendilo referente"}
          </button>{" "}
          <button type="button" onClick={() => setConferma(false)} disabled={inCorso} className="text-kireo-muted underline underline-offset-2">
            Annulla
          </button>
        </span>
      )}
      {errore ? <p className="mt-1 text-red-400">{errore}</p> : null}
    </div>
  );
}
