"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { motivoRifiutoDomanda, statoDomandaConsegna, testoRifiutoDomanda } from "@/lib/eventi/domandaConsegna";

// La domanda finale. Si scrive da quando l'evento è APPROVATO e si cambia fino
// alla FINE DELLA DIRETTA — le due metà hanno ragioni opposte, e stanno per
// esteso in supabase/migrations/20260929120000_finestra_domanda_consegna.sql.
//
// Fino al 29/09 si poneva solo durante la diretta: per un evento di un quarto
// d'ora erano trenta minuti, quindici dei quali l'ente li passa in onda a
// parlare. Il pezzo che regge tutto il formato dipendeva da un gesto fatto nel
// momento in cui una persona è più occupata.
//
// L'OROLOGIO SI RICALCOLA OGNI 30s, stesso idioma di PannelloLive: l'ente può
// essere su questa pagina mentre la diretta finisce, e il campo deve chiudersi
// da sé invece di accettare un testo che poi verrebbe rifiutato.
export default function DomandaConsegnaForm({
  eventoId,
  domandaAttuale,
  dataInizio,
  dataFine,
}: {
  eventoId: string;
  domandaAttuale: string | null;
  dataInizio: string;
  dataFine: string | null;
}) {
  const [testo, setTesto] = useState(domandaAttuale ?? "");
  const [domandaPosta, setDomandaPosta] = useState(domandaAttuale);
  const [salvata, setSalvata] = useState(Boolean(domandaAttuale));
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [ora, setOra] = useState(() => new Date());

  useEffect(() => {
    const intervallo = setInterval(() => setOra(new Date()), 30000);
    return () => clearInterval(intervallo);
  }, []);

  const pannello = statoDomandaConsegna({ data_inizio: dataInizio, data_fine: dataFine, domanda_consegna: domandaPosta }, ora);

  async function salva() {
    setInvio(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("imposta_domanda_consegna", { p_evento_id: eventoId, p_domanda: testo.trim() });
      if (error) {
        setErrore(testoRifiutoDomanda(motivoRifiutoDomanda(error.message ?? ""), pannello.fine));
        return;
      }
      setDomandaPosta(testo.trim());
      setSalvata(true);
    } catch {
      setErrore("Non è stato possibile salvare la domanda. Controlla la connessione e riprova.");
    } finally {
      setInvio(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/5 bg-kireo-dark p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">La domanda finale</p>
      <p className="mt-2 text-xs text-kireo-muted">
        Una domanda aperta sul contenuto dell&apos;incontro. Gli studenti iscritti che si sono collegati possono rispondere in KIREO nelle
        48 ore successive: quello che scrivono resta loro, tu vedi solo che è arrivato.
      </p>

      {/*
        LA RIGA SOPRA IL CAMPO VALE PIÙ DEL PLACEHOLDER, perché il placeholder si
        legge una volta e questa resta. La consegna è l'unica misura di ATTENZIONE
        che abbiamo — è quello che distingue «la scheda era aperta» da «ha
        seguito» — e una domanda a cui si può rispondere senza aver guardato la
        rende finta: il numero sale e non misura più niente.
      */}
      {pannello.modificabile && (
        <p className="mt-3 text-xs text-kireo-light">
          La domanda migliore è quella a cui non si può rispondere bene restando generici.
        </p>
      )}

      {pannello.modificabile ? (
        <>
          <label htmlFor={`domanda-${eventoId}`} className="sr-only">
            La domanda finale
          </label>
          <textarea
            id={`domanda-${eventoId}`}
            value={testo}
            onChange={(e) => {
              setTesto(e.target.value.slice(0, 500));
              setSalvata(false);
            }}
            rows={3}
            className="mt-3 w-full rounded-lg border border-white/10 bg-kireo-card p-3 text-sm text-kireo-light outline-none focus:border-kireo-green"
            placeholder="Es. Abbiamo 40.000 € e due cose da fare: rifare il tetto o assumere una persona in più. Cosa scegliereste, e chi ci rimette?"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className={salvata ? "text-xs text-kireo-green-light" : "text-xs text-kireo-muted"}>
              {salvata ? pannello.testo : `${testo.trim().length} / 500 caratteri (minimo 10)`}
            </p>
            <Button type="button" variant="outline" onClick={salva} disabled={invio || testo.trim().length < 10 || salvata}>
              {invio ? "Salvataggio…" : domandaPosta ? "Aggiorna la domanda" : "Poni la domanda"}
            </Button>
          </div>

          {/* Il buco detto ad alta voce: approvato, e la domanda non c'è ancora. */}
          {!salvata && !domandaPosta && <p className="mt-2 text-xs text-kireo-orange">{pannello.testo}</p>}
        </>
      ) : (
        <>
          {domandaPosta && <p className="mt-3 border-l-2 border-kireo-orange pl-3 text-sm text-kireo-light/90">{domandaPosta}</p>}
          <p className="mt-3 text-xs text-kireo-muted">{pannello.testo}</p>
        </>
      )}

      {errore && <p className="mt-2 text-xs text-red-400">{errore}</p>}
    </div>
  );
}
