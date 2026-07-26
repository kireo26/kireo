"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notifica = { id: string; tipo: "nuovo_post" | "nuovo_evento_ente"; riferimento_id: string; letta: boolean; created_at: string };

const ETICHETTA_TIPO: Record<string, string> = {
  nuovo_post: "Nuovo post di un ente che segui",
  nuovo_evento_ente: "Nuovo evento di un ente che segui",
};

const LINK_TIPO: Record<string, string> = {
  nuovo_post: "/app/bacheca",
  nuovo_evento_ente: "/app/agenda",
};

// Campanella con badge non-lette, solo in-app (nessun digest email, fuori
// scope). Poll leggero ogni 60s invece di realtime: sufficiente per una
// notifica che non richiede consegna immediata.
export default function NotificheBell({ userId }: { userId: string }) {
  const [aperto, setAperto] = useState(false);
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [nonLette, setNonLette] = useState(0);
  const contenitoreRef = useRef<HTMLDivElement>(null);

  async function aggiornaConteggio() {
    const supabase = createClient();
    const { count } = await supabase
      .from("notifiche_studenti")
      .select("id", { count: "exact", head: true })
      .eq("student_id", userId)
      .eq("letta", false);
    setNonLette(count ?? 0);
  }

  useEffect(() => {
    aggiornaConteggio();
    const intervallo = setInterval(aggiornaConteggio, 60000);
    return () => clearInterval(intervallo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function handleClickFuori(e: MouseEvent) {
      if (contenitoreRef.current && !contenitoreRef.current.contains(e.target as Node)) setAperto(false);
    }
    document.addEventListener("mousedown", handleClickFuori);
    return () => document.removeEventListener("mousedown", handleClickFuori);
  }, []);

  async function apriPannello() {
    setAperto((prev) => !prev);
    if (aperto) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("notifiche_studenti")
      .select("id, tipo, riferimento_id, letta, created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifiche((data ?? []) as Notifica[]);
  }

  async function segnaLetta(id: string) {
    const supabase = createClient();
    await supabase.from("notifiche_studenti").update({ letta: true }).eq("id", id);
    setNotifiche((prev) => prev.map((n) => (n.id === id ? { ...n, letta: true } : n)));
    aggiornaConteggio();
  }

  async function segnaTutteLette() {
    const supabase = createClient();
    await supabase.from("notifiche_studenti").update({ letta: true }).eq("student_id", userId).eq("letta", false);
    setNotifiche((prev) => prev.map((n) => ({ ...n, letta: true })));
    setNonLette(0);
  }

  return (
    <div ref={contenitoreRef} className="relative">
      <button
        type="button"
        onClick={apriPannello}
        aria-label="Notifiche"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-kireo-light/80 transition-colors hover:bg-white/5"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8Z" />
          <path strokeWidth="2" strokeLinecap="round" d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {nonLette > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-kireo-orange px-1 text-[10px] font-bold text-kireo-dark">
            {nonLette > 9 ? "9+" : nonLette}
          </span>
        )}
      </button>

      {aperto && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-white/10 bg-kireo-card p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-kireo-light">Notifiche</p>
            {nonLette > 0 && (
              <button type="button" onClick={segnaTutteLette} className="text-xs text-kireo-orange underline underline-offset-2">
                Segna tutte come lette
              </button>
            )}
          </div>
          {notifiche.length === 0 ? (
            <p className="py-4 text-center text-xs text-kireo-muted">Nessuna notifica per ora.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {notifiche.map((n) => (
                <li key={n.id}>
                  <Link
                    href={LINK_TIPO[n.tipo] ?? "/app"}
                    onClick={() => !n.letta && segnaLetta(n.id)}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5 ${n.letta ? "text-kireo-muted" : "text-kireo-light"}`}
                  >
                    <span className="flex items-center gap-2">
                      {!n.letta && <span className="h-1.5 w-1.5 flex-none rounded-full bg-kireo-orange" />}
                      {ETICHETTA_TIPO[n.tipo] ?? n.tipo}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-kireo-muted">
                      {new Date(n.created_at).toLocaleDateString("it-IT", { dateStyle: "medium" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
