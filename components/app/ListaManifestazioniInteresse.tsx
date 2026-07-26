"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type ManifestazioneAttiva = { id: string; istituzioneNome: string; istituzioneSlug: string; creataIl: string };

export default function ListaManifestazioniInteresse({ manifestazioni }: { manifestazioni: ManifestazioneAttiva[] }) {
  const [elenco, setElenco] = useState(manifestazioni);
  const [caricamentoId, setCaricamentoId] = useState<string | null>(null);

  async function revoca(id: string) {
    setCaricamentoId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("manifestazioni_interesse").update({ revocata_il: new Date().toISOString() }).eq("id", id);
      if (!error) setElenco((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setCaricamentoId(null);
    }
  }

  if (elenco.length === 0) {
    return <p className="text-sm text-kireo-muted">Non hai condiviso il tuo profilo con nessun ente al momento.</p>;
  }

  return (
    <ul className="space-y-2">
      {elenco.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-kireo-dark p-3">
          <Link href={`/istituzioni/${m.istituzioneSlug}`} className="text-sm text-kireo-light hover:underline">
            {m.istituzioneNome}
          </Link>
          <button
            type="button"
            onClick={() => revoca(m.id)}
            disabled={caricamentoId === m.id}
            className="text-xs text-red-300 underline underline-offset-2"
          >
            {caricamentoId === m.id ? "…" : "Revoca"}
          </button>
        </li>
      ))}
    </ul>
  );
}
