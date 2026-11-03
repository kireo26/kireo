"use client";

// La cancellazione dell'account, per tutti i ruoli. Cosa dice e se il bottone
// c'è lo decide `presentaCancellazione` dallo stato che il database ha letto
// (`stato_cancellazione_mio_account`): la regola è una sola, nel database.
// Al clic si manda quello che la persona ha letto (`resta_il_nome`): se nel
// frattempo è cambiato, il database rifiuta. E dopo si dice cosa è successo
// davvero, dall'esito restituito, invece di tornare alla home in silenzio.

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { sessioneAncoraViva } from "@/lib/rifiutiScrittura";
import { USCITA_SOLO_QUI } from "@/lib/supabase/uscita";
import {
  presentaCancellazione,
  testoDopoLaCancellazione,
  testoErroreCancellazione,
  TESTI_ACCOUNT,
  type StatoCancellazione,
} from "@/lib/account/cancellazione";

export default function CancellaAccount({ stato, email }: { stato: StatoCancellazione | null; email: string }) {
  const [confermaRichiesta, setConfermaRichiesta] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [erroreEliminazione, setErroreEliminazione] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);
  const vista = presentaCancellazione(stato, email);

  async function handleEliminaDefinitivo() {
    if (!stato || !stato.puo) return;
    setEliminando(true);
    setErroreEliminazione(null);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("delete_own_account", { p_resta_il_nome_visto: stato.resta_il_nome });
      if (error) {
        console.error("delete_own_account non riuscita", descriviErrore(error));
        setErroreEliminazione(testoErroreCancellazione(error, await sessioneAncoraViva(supabase)));
        setEliminando(false);
        return;
      }
      setEsito(testoDopoLaCancellazione((data as { esito?: unknown } | null)?.esito, email));
      // Niente refresh: /account è protetta, e rileggerla senza sessione porterebbe
      // all'accesso prima che la persona abbia letto cosa è successo.
      await supabase.auth.signOut({ scope: USCITA_SOLO_QUI });
    } catch (e) {
      console.error("delete_own_account non arrivata", descriviErrore(e));
      setErroreEliminazione(testoErroreCancellazione(null, true));
      setEliminando(false);
    }
  }

  if (esito) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-6">
        <p className="text-sm text-kireo-light">{esito}</p>
        <Link href="/" className="mt-3 inline-block text-sm text-kireo-orange underline underline-offset-2">
          Torna alla home
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/30 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Elimina il mio account</h2>
      <p className="mt-1 text-sm text-kireo-muted">{vista.testo}</p>

      {!vista.bottone ? (
        vista.linkStaff ? (
          <Link href="/scuola/staff" className="mt-3 inline-block text-sm text-kireo-orange underline underline-offset-2">
            Vai a Staff
          </Link>
        ) : null
      ) : !confermaRichiesta ? (
        <button
          type="button"
          onClick={() => setConfermaRichiesta(true)}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-red-500/50 px-6 py-3 font-sans text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
        >
          Elimina il mio account
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm text-red-300">{TESTI_ACCOUNT.domanda}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleEliminaDefinitivo}
              disabled={eliminando}
              className="inline-flex items-center justify-center rounded-full bg-red-500 px-6 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {eliminando ? "Eliminazione…" : "Sì, elimina definitivamente"}
            </button>
            <Button type="button" variant="ghost" onClick={() => setConfermaRichiesta(false)} disabled={eliminando}>
              Annulla
            </Button>
          </div>
          {erroreEliminazione && <p className="mt-3 text-sm text-red-400">{erroreEliminazione}</p>}
        </div>
      )}
    </div>
  );
}
