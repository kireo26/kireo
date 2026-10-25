"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { causaRifiutoDomanda, ETICHETTA_RIFAI_ACCESSO, TESTO_RIFIUTO_DOMANDA, type CausaRifiutoDomanda } from "@/lib/live/presenza";
import { statoDiretta } from "@/lib/live";

// La bozza sopravvive al rientro (25/10): «il testo resta qui» dev'essere vero
// anche dopo il giro su /accedi. sessionStorage, per scheda, e ogni accesso in
// un try: in incognito o con lo storage bloccato si perde la comodità, non la
// pagina.
const chiaveBozza = (eventoId: string) => `kireo:bozza-domanda:${eventoId}`;
function leggiBozza(eventoId: string): string {
  try {
    return sessionStorage.getItem(chiaveBozza(eventoId)) ?? "";
  } catch {
    return "";
  }
}
function scriviBozza(eventoId: string, testo: string | null) {
  try {
    if (testo) sessionStorage.setItem(chiaveBozza(eventoId), testo);
    else sessionStorage.removeItem(chiaveBozza(eventoId));
  } catch {
    // Storage non disponibile: la bozza resta solo nel campo.
  }
}

export type Domanda = { id: string; testo: string; stato: string; creata_il: string };

const ETICHETTA_STATO: Record<string, string> = {
  nuova: "In attesa",
  letta: "Letta dall'organizzatore",
  risposta_live: "Risposta in diretta",
};

// Solo studente/docente -> organizzatore, nessuna chat: qui si vedono solo
// le proprie domande (domande_live_select_own), mai quelle di altri. Il
// rate limit (1/minuto, 10/evento) è un trigger DB reale: gli errori
// specifici vengono tradotti in un messaggio comprensibile.
export default function BoxDomandeLive({
  eventoId,
  userId,
  domandeIniziali,
  dataInizio,
  dataFine,
  hrefRitorno,
}: {
  eventoId: string;
  userId: string;
  domandeIniziali: Domanda[];
  dataInizio: string;
  dataFine: string | null;
  hrefRitorno: string;
}) {
  const [domande, setDomande] = useState<Domanda[]>(domandeIniziali);
  const [testo, setTesto] = useState("");
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [causa, setCausa] = useState<CausaRifiutoDomanda | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const bozza = leggiBozza(eventoId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lo storage non esiste nel render del server
    if (bozza) setTesto(bozza);
  }, [eventoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testo.trim() || invio) return;
    setInvio(true);
    setErrore(null);
    setCausa(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("domande_live")
        .insert({ evento_id: eventoId, user_id: userId, testo: testo.trim() })
        .select("id, testo, stato, creata_il")
        .single();

      if (error || !data) {
        if (error?.message?.includes("troppo_frequente")) {
          setErrore("Puoi inviare una domanda al minuto: aspetta un attimo e riprova.");
        } else if (error?.message?.includes("troppe_domande_evento")) {
          setErrore("Hai raggiunto il numero massimo di domande per questo evento.");
        } else {
          // Tre cause, tre rimedi (25/10): la sessione si chiede al server,
          // perché è proprio la cosa che il client può aver perso.
          // Se la diretta è aperta lo decide l'orologio del momento del rifiuto,
          // non quello del caricamento: è finita mentre scriveva.
          console.error("BoxDomandeLive: domanda non inviata", error);
          const { data: utente } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
          const c = causaRifiutoDomanda({
            codice: error?.code ?? null,
            sessioneViva: Boolean(utente.user),
            direttaAperta: statoDiretta(dataInizio, dataFine, new Date()) === "in_corso",
          });
          if (c === "sessione_persa") scriviBozza(eventoId, testo.trim());
          setCausa(c);
          setErrore(TESTO_RIFIUTO_DOMANDA[c]);
        }
        return;
      }

      setDomande((prev) => [data, ...prev]);
      setTesto("");
      scriviBozza(eventoId, null);
    } finally {
      setInvio(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
      <p className="font-heading text-sm font-semibold text-kireo-light">Fai una domanda</p>
      <p className="mt-1 text-xs text-kireo-muted">Solo tu vedi le tue domande: l&apos;organizzatore le riceve, non è una chat pubblica.</p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          maxLength={500}
          placeholder="Scrivi la tua domanda..."
          className="flex-1 rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted focus:outline-none focus:border-kireo-green"
        />
        <button
          type="submit"
          disabled={invio || !testo.trim()}
          className="rounded-lg bg-kireo-green px-4 py-2 text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {invio ? "Invio…" : "Invia"}
        </button>
      </form>
      {errore && (
        <p className="mt-2 text-xs text-red-400">
          {errore}
          {causa === "sessione_persa" && (
            <>
              {" "}
              <Link
                href={`/accedi?redirectedFrom=${encodeURIComponent(pathname ?? hrefRitorno)}`}
                className="text-kireo-orange underline underline-offset-2"
              >
                {ETICHETTA_RIFAI_ACCESSO}
              </Link>
            </>
          )}
        </p>
      )}

      {domande.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-white/5 pt-4">
          {domande.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-kireo-light/90">{d.testo}</span>
              <span className="flex-none rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-light/70">
                {ETICHETTA_STATO[d.stato] ?? d.stato}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
