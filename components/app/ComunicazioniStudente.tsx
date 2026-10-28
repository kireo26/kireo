"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import {
  impostaComunicazioniKireo,
  testoStatoConsenso,
  TESTO_A_COSA_SERVE,
  TESTO_SOLO_MAGGIORENNI,
  type ConsensoKireo,
} from "@/lib/app/comunicazioniKireo";

export type IscrizioneNewsletter = { id: string; istituzioneNome: string; istituzioneSlug: string; creataIl: string };

// Le comunicazioni che uno studente può ricevere, e l'uscita da ognuna.
//
// ⚠️ L'USCITA ESISTE PRIMA DELL'INVIO, ed è un divieto scritto nei punti aperti
// di CLAUDE.md: la newsletter di un ente non si spedisce finché uno studente
// non può smettere di riceverla. Qui c'è la prima metà (il bottone); la
// seconda è il link in ogni email, e nasce con l'invio.
//
// `undefined` vuol dire «non letto» e la sezione lo dice: un elenco vuoto
// direbbe «non sei iscritto a niente», che non sappiamo.
export default function ComunicazioniStudente({
  consensoIniziale,
  maggiorenne,
  iscrizioniIniziali,
  origine = "profilo",
}: {
  consensoIniziale: ConsensoKireo | undefined;
  maggiorenne: boolean;
  iscrizioniIniziali: IscrizioneNewsletter[] | undefined;
  origine?: "profilo" | "disiscrizione";
}) {
  const [consenso, setConsenso] = useState(consensoIniziale);
  const [salvando, setSalvando] = useState(false);
  const [erroreConsenso, setErroreConsenso] = useState(false);
  const [iscrizioni, setIscrizioni] = useState(iscrizioniIniziali);
  const [uscendoDa, setUscendoDa] = useState<string | null>(null);
  const [erroreUscita, setErroreUscita] = useState<string | null>(null);

  async function scegli(valore: boolean) {
    setSalvando(true);
    setErroreConsenso(false);
    try {
      const riletto = await impostaComunicazioniKireo(createClient(), valore, origine);
      if (riletto === undefined || riletto !== valore) setErroreConsenso(true);
      else setConsenso(riletto);
    } finally {
      setSalvando(false);
    }
  }

  async function esci(id: string) {
    setUscendoDa(id);
    setErroreUscita(null);
    try {
      // .select(): sotto RLS una cancellazione che non tocca niente non dà
      // errore (il modo 11). Zero righe è un rifiuto, non un'uscita.
      const { data, error } = await createClient().from("newsletter_iscrizioni").delete().eq("id", id).select("id");
      if (error || !data || data.length === 0) {
        if (error) console.error("Uscita dalla newsletter:", descriviErrore(error));
        setErroreUscita(id);
        return;
      }
      setIscrizioni((prima) => prima?.filter((i) => i.id !== id));
    } finally {
      setUscendoDa(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-base font-semibold text-kireo-light">Le comunicazioni di KIREO</h3>
        <p className="mt-1 text-sm text-kireo-muted">{TESTO_A_COSA_SERVE}</p>
        {consenso === undefined ? (
          <p className="mt-3 text-sm text-kireo-muted">Non siamo riusciti a leggere la tua scelta: ricarica la pagina.</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-kireo-light">{testoStatoConsenso(consenso)}</p>
            {!maggiorenne && <p className="mt-1 text-sm text-kireo-muted">{TESTO_SOLO_MAGGIORENNI}</p>}
            <div className="mt-3 flex flex-wrap gap-3">
              {consenso !== true && (
                <button
                  type="button"
                  onClick={() => scegli(true)}
                  disabled={salvando}
                  className="rounded-full border border-kireo-green px-4 py-2 text-sm text-kireo-light hover:bg-kireo-green/20"
                >
                  {salvando ? "Un momento…" : "Sì, voglio riceverle"}
                </button>
              )}
              {consenso !== false && (
                <button
                  type="button"
                  onClick={() => scegli(false)}
                  disabled={salvando}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-kireo-light hover:bg-white/5"
                >
                  {salvando ? "Un momento…" : "No, non voglio riceverle"}
                </button>
              )}
            </div>
            {erroreConsenso && (
              <p className="mt-2 text-sm text-red-400">Non siamo riusciti a salvare la tua scelta: riprova.</p>
            )}
          </>
        )}
      </div>

      <div>
        <h3 className="font-heading text-base font-semibold text-kireo-light">Le newsletter degli enti</h3>
        {iscrizioni === undefined ? (
          <p className="mt-1 text-sm text-kireo-muted">Non siamo riusciti a leggere le tue iscrizioni: ricarica la pagina.</p>
        ) : iscrizioni.length === 0 ? (
          <p className="mt-1 text-sm text-kireo-muted">Nessuna iscrizione alla newsletter di un ente.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {iscrizioni.map((i) => (
              <li key={i.id} className="rounded-lg border border-white/5 bg-kireo-dark p-3">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/istituzioni/${i.istituzioneSlug}`} className="text-sm text-kireo-light hover:underline">
                    {i.istituzioneNome}
                  </Link>
                  <button
                    type="button"
                    onClick={() => esci(i.id)}
                    disabled={uscendoDa === i.id}
                    className="text-xs text-red-300 underline underline-offset-2"
                  >
                    {uscendoDa === i.id ? "…" : "Non voglio più riceverla"}
                  </button>
                </div>
                {erroreUscita === i.id && (
                  <p className="mt-2 text-xs text-red-400">Non siamo riusciti a toglierti da questa newsletter: riprova.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
