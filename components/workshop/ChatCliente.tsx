"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CARATTERI_MESSAGGIO_WORKSHOP } from "@/lib/workshop/config";

type Messaggio = { mittente: "studente" | "cliente"; contenuto: string };

const MESSAGGIO_INIZIALE: Messaggio = {
  mittente: "cliente",
  contenuto:
    "Allora, eccoti qua. Ho letto che stai lavorando su un'idea per la mia enoteca. Dimmi tutto — cosa hai pensato? Partiamo dal nome e da come vuoi usare i soldi.",
};

export default function ChatCliente({
  iscrizioneId,
  nomeCliente,
  messaggiIniziali,
}: {
  iscrizioneId: string;
  nomeCliente: string;
  messaggiIniziali: Messaggio[];
}) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>(messaggiIniziali.length > 0 ? messaggiIniziali : [MESSAGGIO_INIZIALE]);
  const [testo, setTesto] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const fineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fineRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    const testoInvio = testo.trim();
    if (!testoInvio || caricamento) return;

    setTesto("");
    setErrore(null);
    setMessaggi((prev) => [...prev, { mittente: "studente", contenuto: testoInvio }]);
    setCaricamento(true);

    try {
      const res = await fetch("/api/workshop/cliente-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iscrizioneId, messaggio: testoInvio }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrore(data.errore ?? "Non è stato possibile inviare il messaggio.");
        return;
      }
      setMessaggi((prev) => [...prev, { mittente: "cliente", contenuto: data.risposta }]);
    } catch {
      setErrore("Errore di connessione. Riprova.");
    } finally {
      setCaricamento(false);
    }
  }

  const iniziali = nomeCliente
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-white/5 bg-kireo-card">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-kireo-orange/15 text-xs font-semibold text-kireo-orange">
          {iniziali}
        </span>
        <div>
          <p className="text-sm font-medium text-kireo-light">{nomeCliente}</p>
          <p className="text-xs text-kireo-muted">Il tuo cliente per questo workshop</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messaggi.map((m, i) => (
          <div key={i} className={`flex ${m.mittente === "studente" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.mittente === "studente" ? "bg-kireo-green text-kireo-light" : "bg-kireo-dark text-kireo-light/90"}`}>
              <p className="whitespace-pre-wrap">{m.contenuto}</p>
            </div>
          </div>
        ))}
        {caricamento && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-kireo-dark px-4 py-2.5 text-sm text-kireo-muted">…</div>
          </div>
        )}
        <div ref={fineRef} />
      </div>

      <form onSubmit={invia} className="border-t border-white/5 p-4">
        <div className="flex gap-2">
          <input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            maxLength={MAX_CARATTERI_MESSAGGIO_WORKSHOP}
            placeholder={`Scrivi a ${nomeCliente}...`}
            disabled={caricamento}
            className="flex-1 rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted focus:outline-none focus:border-kireo-green"
          />
          <button
            type="submit"
            disabled={caricamento || !testo.trim()}
            className="rounded-lg bg-kireo-green px-4 py-2 text-sm font-semibold text-kireo-light hover:bg-kireo-green-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            Invia
          </button>
        </div>
        {errore && <p className="mt-2 text-xs text-red-400">{errore}</p>}
      </form>
    </div>
  );
}
