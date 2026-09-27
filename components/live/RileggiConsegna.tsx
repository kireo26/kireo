"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

// Far rileggere una consegna che il giudizio non ha letto.
//
// PERCHÉ ESISTE. Se la chiamata al revisore falliva, la consegna restava salvata
// con `valutata_il` nulla, e l'unico modo di rigiudicarla era premere di nuovo il
// bottone del campo — cioè solo finché la pagina restava aperta: dopo un
// ricaricamento `statoPortaConsegna` risponde `gia_consegnata`, il campo non c'è
// più, e il testo restava nel database senza diventare mai una prova. Lo studente
// aveva scritto, il suo profilo non l'avrebbe mai saputo, e l'unica traccia era un
// guasto registrato da qualche parte.
//
// A PREMERE È UNA PERSONA, e non è pigrizia: rigiudicare costa una chiamata, e la
// regola di casa (19/09) è che un ritentativo automatico su una scrittura a
// pagamento non si fa. Nessun cron ripassa su queste righe — e finché
// `registra_evidenze_consegna_evento` ricava lo studente da `auth.uid()`, un cron
// non potrebbe nemmeno chiamarla.
//
// IL CORPO DELLA RICHIESTA: si rimanda il testo salvato, che la route ignora nel
// ramo del `23505` — rilegge SEMPRE quello autorevole dal database, mai quello
// arrivato adesso. Lo si manda comunque perché la route valida la lunghezza prima
// di toccare il database, e un corpo vuoto verrebbe respinto per una ragione
// sbagliata.
export default function RileggiConsegna({ eventoId, testo }: { eventoId: string; testo: string }) {
  const router = useRouter();
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function rileggi() {
    setInvio(true);
    setErrore(null);
    try {
      const risposta = await fetch(`/api/eventi/${eventoId}/consegna`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo }),
      });
      const dati = (await risposta.json()) as { ok?: boolean; messaggio?: string };
      if (dati.ok === true) {
        router.refresh();
        return;
      }
      setErrore(dati.messaggio ?? "Non ci siamo riusciti nemmeno adesso. Riprova più tardi.");
    } catch {
      setErrore("Non ci siamo riusciti: controlla la connessione e riprova.");
    } finally {
      setInvio(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-kireo-muted">
        Non siamo riusciti a leggerla. Il testo è al sicuro, e non è un giudizio su quello che hai scritto: è un problema nostro.
      </p>
      <div className="mt-3">
        <Button variant="outline" onClick={rileggi} disabled={invio}>
          {invio ? "Lettura in corso…" : "Fai rileggere la risposta"}
        </Button>
      </div>
      {errore ? <p className="mt-2 text-sm text-kireo-orange">{errore}</p> : null}
    </div>
  );
}
