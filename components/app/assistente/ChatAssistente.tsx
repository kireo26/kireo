"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { MAX_MESSAGGI_CONVERSAZIONE } from "@/lib/assistente/config";

type Messaggio = { role: "user" | "assistant"; content: string };

// Pannello di chat, riusabile per qualunque area attiva: la history vive
// solo qui (stato React), non viene mai salvata — ad ogni invio si manda
// l'intera conversazione al server, che non la scrive da nessuna parte
// (vedi app/api/assistente/route.ts). Il disclaimer resta sempre visibile,
// non è un banner che si può chiudere.
export default function ChatAssistente({ areaSlug, areaNome }: { areaSlug: string; areaNome: string }) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [input, setInput] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const conversazioneAvviata = useRef(false);

  const messaggiRimasti = MAX_MESSAGGI_CONVERSAZIONE - messaggi.length;
  const limiteRaggiunto = messaggiRimasti <= 0;

  function nuovaConversazione() {
    setMessaggi([]);
    setErrore(null);
    setInput("");
    conversazioneAvviata.current = false;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const testo = input.trim();
    if (!testo || caricamento || limiteRaggiunto) return;

    const cronologiaPrecedente = messaggi;
    const nuovaConversazioneFlag = !conversazioneAvviata.current;
    const messaggioUtente: Messaggio = { role: "user", content: testo };

    setMessaggi((prev) => [...prev, messaggioUtente]);
    setInput("");
    setErrore(null);
    setCaricamento(true);

    try {
      const risposta = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaSlug,
          messages: [...cronologiaPrecedente, messaggioUtente],
          nuovaConversazione: nuovaConversazioneFlag,
        }),
      });

      const tipoContenuto = risposta.headers.get("Content-Type") ?? "";
      if (!risposta.ok || tipoContenuto.includes("application/json")) {
        const dati = await risposta.json().catch(() => null);
        setErrore(dati?.errore ?? "Qualcosa è andato storto. Riprova tra qualche istante.");
        return;
      }

      conversazioneAvviata.current = true;

      const reader = risposta.body?.getReader();
      if (!reader) {
        setErrore("Qualcosa è andato storto. Riprova tra qualche istante.");
        return;
      }

      const decoder = new TextDecoder();
      setMessaggi((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const pezzo = decoder.decode(value, { stream: true });
        setMessaggi((prev) => {
          const aggiornati = [...prev];
          const ultimo = aggiornati[aggiornati.length - 1];
          aggiornati[aggiornati.length - 1] = { ...ultimo, content: ultimo.content + pezzo };
          return aggiornati;
        });
      }
    } catch {
      setErrore("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/5 bg-kireo-card">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div>
          <p className="font-heading text-sm font-semibold text-kireo-light">Assistente digitale — {areaNome}</p>
          <p className="mt-0.5 text-xs text-kireo-muted">
            Le risposte sono generate da un&apos;intelligenza artificiale, non da una persona. Non condividere dati
            personali qui.
          </p>
        </div>
        <button
          type="button"
          onClick={nuovaConversazione}
          disabled={messaggi.length === 0}
          className="flex-none rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-kireo-light/80 transition-colors hover:border-white/30 hover:text-kireo-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          Nuova conversazione
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messaggi.length === 0 && (
          <p className="text-sm text-kireo-muted">
            Fai una domanda su {areaNome.toLowerCase()}: percorsi, competenze richieste, sbocchi possibili.
          </p>
        )}
        {messaggi.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-kireo-green text-kireo-light" : "bg-kireo-dark text-kireo-light/90"
              }`}
            >
              {m.content || (caricamento && i === messaggi.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
        {errore && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{errore}</p>
        )}
      </div>

      <div className="border-t border-white/5 px-4 py-3">
        {limiteRaggiunto ? (
          <p className="text-center text-sm text-kireo-muted">
            Hai raggiunto il numero massimo di messaggi per questa conversazione.{" "}
            <button type="button" onClick={nuovaConversazione} className="text-kireo-orange underline underline-offset-2">
              Inizia una nuova conversazione
            </button>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              disabled={caricamento}
              placeholder="Scrivi la tua domanda…"
              className="max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-kireo-dark px-4 py-2.5 text-sm text-kireo-light placeholder:text-kireo-muted focus:border-kireo-green focus:outline-none disabled:opacity-60"
            />
            <Button type="submit" variant="primary" disabled={caricamento || !input.trim()} className="flex-none">
              {caricamento ? "…" : "Invia"}
            </Button>
          </form>
        )}
        {!limiteRaggiunto && (
          <p className="mt-2 text-center text-[11px] text-kireo-muted">
            {messaggiRimasti} messagg{messaggiRimasti === 1 ? "io" : "i"} rimast
            {messaggiRimasti === 1 ? "o" : "i"} in questa conversazione
          </p>
        )}
      </div>
    </div>
  );
}
