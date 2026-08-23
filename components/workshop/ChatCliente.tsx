"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MAX_CARATTERI_MESSAGGIO_WORKSHOP } from "@/lib/workshop/config";
import type { StatoChatTappa } from "@/lib/workshop/chatTappa";

type Messaggio = { mittente: "studente" | "cliente"; contenuto: string };

// Uscita DICHIARATA dalla chat. Il verbo è «interrompi», non «torna indietro»:
// dice allo studente che può fermarsi lui, che la conversazione non ha una fine
// da raggiungere e non serve il permesso del cliente. È la cosa che mancava al
// primo utente reale, che è arrivato a dieci messaggi non per scelta.
function UscitaChat({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green"
    >
      ← Interrompi la conversazione e torna al progetto
    </Link>
  );
}

// Contatore leggibile: dice quanti messaggi servono e, appena bastano, che si
// può consegnare. Non è un obbligo a scrivere di più: è il permesso di smettere.
function Contatore({ stato }: { stato: StatoChatTappa }) {
  if (stato.raggiuntoTetto) {
    return <span className="text-xs text-kireo-muted">Conversazione conclusa per questa tappa — torna al progetto e consegna.</span>;
  }
  if (stato.minimo === 0) {
    return <span className="text-xs text-kireo-muted">{stato.inviati} messaggi inviati</span>;
  }
  if (stato.raggiuntoMinimo) {
    return (
      <span className="text-xs text-kireo-green-light">
        {stato.inviati}/{stato.minimo} messaggi — puoi consegnare la tappa
      </span>
    );
  }
  return (
    <span className="text-xs text-kireo-muted">
      {stato.inviati}/{stato.minimo} messaggi — servono {stato.minimo - stato.inviati} messaggi prima di consegnare
    </span>
  );
}

export default function ChatCliente({
  iscrizioneId,
  nomeCliente,
  messaggioApertura,
  messaggiIniziali,
  hrefProgetto,
  statoChat,
}: {
  iscrizioneId: string;
  nomeCliente: string;
  messaggioApertura: string;
  messaggiIniziali: Messaggio[];
  hrefProgetto: string;
  statoChat: StatoChatTappa;
}) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>(
    messaggiIniziali.length > 0 ? messaggiIniziali : [{ mittente: "cliente", contenuto: messaggioApertura }],
  );
  const [testo, setTesto] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Lo stato arriva dal server (fonte di verità unica, lib/workshop/chatTappa)
  // e si aggiorna qui a ogni invio, così contatore e campo restano coerenti
  // senza ricaricare la pagina.
  const [stato, setStato] = useState<StatoChatTappa>(statoChat);
  const fineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fineRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    const testoInvio = testo.trim();
    if (!testoInvio || caricamento || stato.raggiuntoTetto) return;

    setTesto("");
    setErrore(null);
    setMessaggi((prev) => [...prev, { mittente: "studente", contenuto: testoInvio }]);
    const inviatiDopo = stato.inviati + 1;
    setStato((s) => ({
      ...s,
      inviati: inviatiDopo,
      raggiuntoMinimo: s.minimo > 0 && inviatiDopo >= s.minimo,
      raggiuntoTetto: inviatiDopo >= s.tetto,
    }));
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
    <div className="space-y-3">
      {/* Uscita in alto, sopra la chat: visibile senza scorrere. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UscitaChat href={hrefProgetto} />
        <Contatore stato={stato} />
      </div>

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
            placeholder={stato.raggiuntoTetto ? `${nomeCliente} ha chiuso la conversazione` : `Scrivi a ${nomeCliente}...`}
            disabled={caricamento || stato.raggiuntoTetto}
            className="flex-1 rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted focus:outline-none focus:border-kireo-green disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={caricamento || !testo.trim() || stato.raggiuntoTetto}
            className="rounded-lg bg-kireo-green px-4 py-2 text-sm font-semibold text-kireo-light hover:bg-kireo-green-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            Invia
          </button>
        </div>
        {errore && <p className="mt-2 text-xs text-red-400">{errore}</p>}
      </form>
      </div>

      {/* Uscita anche in fondo, sotto il campo: chi ha appena scritto non deve
          risalire per trovarla. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UscitaChat href={hrefProgetto} />
        <Contatore stato={stato} />
      </div>
    </div>
  );
}
