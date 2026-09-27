"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

// Il campo in cui si risponde alla domanda posta in diretta. La porta l'ha già
// aperta il server (statoPortaConsegna, che a sua volta non autorizza: la porta
// vera è la policy di insert): qui si scrive e si manda.
//
// Il contatore dei caratteri non è un vezzo: il minimo è un vincolo a database
// (consegne_evento.testo), e un rifiuto su una lunghezza è precisamente il no che
// si può evitare dicendolo prima.
export default function ConsegnaEvento({
  eventoId,
  domanda,
  minCaratteri,
  maxCaratteri,
}: {
  eventoId: string;
  domanda: string;
  minCaratteri: number;
  maxCaratteri: number;
}) {
  const router = useRouter();
  const [testo, setTesto] = useState("");
  const [invio, setInvio] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; messaggio: string } | null>(null);

  const abbastanza = testo.trim().length >= minCaratteri;

  async function invia() {
    setInvio(true);
    setEsito(null);
    try {
      const risposta = await fetch(`/api/eventi/${eventoId}/consegna`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo: testo.trim() }),
      });
      const dati = (await risposta.json()) as { ok?: boolean; messaggio?: string };
      setEsito({
        ok: dati.ok === true,
        messaggio: dati.messaggio ?? "Non siamo riusciti a inviare la risposta. Riprova.",
      });
      // Consegnata: la pagina ricarica così al posto del campo compare quello
      // che ha scritto — non un campo vuoto che sembra non aver funzionato.
      if (dati.ok === true) router.refresh();
    } catch {
      setEsito({ ok: false, messaggio: "Non siamo riusciti a inviare la risposta. Controlla la connessione e riprova." });
    } finally {
      setInvio(false);
    }
  }

  if (esito?.ok) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-6">
        <p className="font-heading text-base font-semibold text-kireo-light">Risposta consegnata</p>
        <p className="mt-2 text-sm text-kireo-muted">{esito.messaggio}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <p className="font-heading text-base font-semibold text-kireo-light">La domanda finale</p>
      <p className="mt-3 border-l-2 border-kireo-orange pl-4 text-sm text-kireo-light">{domanda}</p>
      <p className="mt-4 text-sm text-kireo-muted">
        Rispondi con le tue parole. Non serve avere ragione: serve dire una cosa concreta — un esempio, un vincolo, una conseguenza.
      </p>

      <label htmlFor="consegna-testo" className="sr-only">
        La tua risposta
      </label>
      <textarea
        id="consegna-testo"
        value={testo}
        onChange={(e) => setTesto(e.target.value.slice(0, maxCaratteri))}
        rows={8}
        className="mt-4 w-full rounded-xl border border-white/10 bg-kireo-dark p-4 text-sm text-kireo-light outline-none focus:border-kireo-green"
        placeholder="Scrivi qui la tua risposta…"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-kireo-muted">
          {abbastanza
            ? `${testo.trim().length} caratteri`
            : `${testo.trim().length} di ${minCaratteri} caratteri: ancora un po'`}
        </p>
        <Button onClick={invia} disabled={!abbastanza || invio}>
          {invio ? "Invio in corso…" : "Consegna la risposta"}
        </Button>
      </div>

      {esito && !esito.ok ? <p className="mt-3 text-sm text-kireo-orange">{esito.messaggio}</p> : null}
    </div>
  );
}
