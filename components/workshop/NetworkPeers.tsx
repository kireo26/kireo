"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Peer = {
  student_id: string;
  nome: string;
  cognome: string;
  ruolo_slug: string;
  ruolo_titolo: string;
};

type MessaggioRete = {
  id: string;
  mittente_id: string;
  contenuto: string;
  created_at: string;
};

function Iniziali({ nome, cognome }: { nome: string; cognome: string }) {
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-kireo-green/15 text-xs font-semibold text-kireo-green-light">
      {nome[0]}
      {cognome[0]}
    </span>
  );
}

// Un thread per compagno di workshop, aperto solo su richiesta ("Scrivi").
// L'invio passa sempre da invia_messaggio_rete_workshop: verifica lato DB
// che mittente e destinatario siano entrambi iscritti attivi allo stesso
// workshop, non è una messaggistica libera fra studenti qualsiasi.
function ThreadPeer({ workshopId, peer, onChiudi }: { workshopId: string; peer: Peer; onChiudi: () => void }) {
  const router = useRouter();
  const [messaggi, setMessaggi] = useState<MessaggioRete[] | null>(null);
  const [testo, setTesto] = useState("");
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("workshop_messaggi")
        .select("id, mittente_id, contenuto, created_at")
        .eq("workshop_id", workshopId)
        .or(`and(mittente_id.eq.${user.id},destinatario_id.eq.${peer.student_id}),and(mittente_id.eq.${peer.student_id},destinatario_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      if (!annullato) setMessaggi(data ?? []);
      await supabase.from("workshop_messaggi").update({ letto: true }).eq("workshop_id", workshopId).eq("mittente_id", peer.student_id).eq("destinatario_id", user.id).eq("letto", false);
    })();
    return () => {
      annullato = true;
    };
  }, [workshopId, peer.student_id]);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!testo.trim() || invio) return;
    setInvio(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("invia_messaggio_rete_workshop", {
        p_workshop_id: workshopId,
        p_destinatario_id: peer.student_id,
        p_contenuto: testo.trim(),
      });
      if (error) {
        setErrore(error.message?.includes("troppi_messaggi_oggi") ? "Hai raggiunto il numero massimo di messaggi per oggi." : "Non è stato possibile inviare il messaggio.");
        return;
      }
      setTesto("");
      router.refresh();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setMessaggi((prev) => [...(prev ?? []), { id: `temp-${Date.now()}`, mittente_id: user.id, contenuto: testo.trim(), created_at: new Date().toISOString() }]);
      }
    } finally {
      setInvio(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-kireo-dark p-3">
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {messaggi === null ? (
          <p className="text-xs text-kireo-muted">Caricamento…</p>
        ) : messaggi.length === 0 ? (
          <p className="text-xs text-kireo-muted">Nessun messaggio ancora. Presentati!</p>
        ) : (
          messaggi.map((m) => {
            const mio = m.mittente_id !== peer.student_id;
            return (
              <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs ${mio ? "bg-kireo-green text-kireo-light" : "bg-kireo-card text-kireo-light/90"}`}>
                  {m.contenuto}
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={invia} className="mt-2 flex gap-2">
        <input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          maxLength={2000}
          placeholder={`Scrivi a ${peer.nome}...`}
          className="flex-1 rounded-lg border border-white/10 bg-kireo-card px-3 py-1.5 text-xs text-kireo-light placeholder:text-kireo-muted focus:outline-none focus:border-kireo-green"
        />
        <button type="submit" disabled={invio || !testo.trim()} className="rounded-lg bg-kireo-green px-3 py-1.5 text-xs font-semibold text-kireo-light disabled:opacity-50">
          Invia
        </button>
      </form>
      {errore && <p className="mt-1.5 text-xs text-red-400">{errore}</p>}
      <button type="button" onClick={onChiudi} className="mt-2 text-[11px] text-kireo-muted underline underline-offset-2">
        Chiudi
      </button>
    </div>
  );
}

export default function NetworkPeers({ workshopId, peers }: { workshopId: string; peers: Peer[] }) {
  const [aperto, setAperto] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Chi altro sta lavorando al progetto</h2>
      <p className="mt-1 text-sm text-kireo-muted">Confrontati con chi copre le altre aree — siete nella stessa squadra.</p>

      <ul className="mt-5 space-y-2">
        {peers.map((peer) => (
          <li key={peer.student_id} className="rounded-xl border border-white/10 p-3">
            <div className="flex items-center gap-3">
              <Iniziali nome={peer.nome} cognome={peer.cognome} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-kireo-light">
                  {peer.nome} {peer.cognome}
                </p>
                <p className="text-xs text-kireo-muted">{peer.ruolo_titolo}</p>
              </div>
              <button
                type="button"
                onClick={() => setAperto(aperto === peer.student_id ? null : peer.student_id)}
                className="flex-none rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-kireo-light hover:border-kireo-green"
              >
                {aperto === peer.student_id ? "Nascondi" : "Scrivi"}
              </button>
            </div>
            {aperto === peer.student_id && <ThreadPeer workshopId={workshopId} peer={peer} onChiudi={() => setAperto(null)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
