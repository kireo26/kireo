"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

// Rimanda l'email all'ente su una decisione già presa (30/10). L'esito nuovo
// si scrive in `avvisi_email_enti`: se parte, la riga esce dall'elenco.
export default function RiprovaAvvisoEnte({ cosa, id }: { cosa: "evento" | "newsletter" | "area"; id: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  async function riprova() {
    setInCorso(true);
    setEsito(null);
    try {
      const risposta = await fetch("/api/admin/riprova-avviso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cosa, id }),
      });
      const corpo = (await risposta.json().catch(() => ({}))) as { errore?: string; emailInviata?: boolean };
      if (!risposta.ok) {
        setEsito(corpo.errore ?? "Non è stato possibile riprovare.");
        return;
      }
      // Partita: la riga esce dall'elenco. Non partita: la riga resta, con il motivo nuovo.
      if (!corpo.emailInviata) setEsito("Non è partita neanche questa volta: il motivo nuovo è nella riga.");
      router.refresh();
    } catch {
      setEsito("Non è stato possibile riprovare.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={riprova} disabled={inCorso}>
        {inCorso ? "Un momento…" : "Riprova l'email"}
      </Button>
      {esito && <span className="text-sm text-kireo-orange">{esito}</span>}
    </div>
  );
}
