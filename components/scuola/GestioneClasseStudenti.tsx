"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { etichettaPrincipaleStudente } from "@/lib/scuola/formatStudente";

type Studente = { userId: string; nome: string; cognome: string; email: string | null };

export default function GestioneClasseStudenti({
  classeId,
  membri,
  disponibili,
  puoGestire,
}: {
  classeId: string;
  membri: Studente[];
  disponibili: Studente[];
  puoGestire: boolean;
}) {
  const router = useRouter();
  const [daAggiungere, setDaAggiungere] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleAggiungi() {
    if (!daAggiungere) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("classi_studenti").insert({ classe_id: classeId, student_id: daAggiungere });
      if (error) {
        setErrore("Non è stato possibile aggiungere lo studente.");
        return;
      }
      setDaAggiungere("");
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  async function handleRimuovi(studentId: string) {
    setCaricamento(true);
    try {
      const supabase = createClient();
      await supabase.from("classi_studenti").delete().eq("classe_id", classeId).eq("student_id", studentId);
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      {membri.length === 0 ? (
        <p className="text-sm text-kireo-muted">Nessuno studente in questa classe.</p>
      ) : (
        <ul className="space-y-1.5">
          {membri.map((s) => (
            <li key={s.userId} className="flex items-center justify-between text-sm text-kireo-light/90">
              <Link href={`/scuola/studenti/${s.userId}`} className="hover:underline">
                {etichettaPrincipaleStudente(s.nome, s.cognome, s.email)}
              </Link>
              {puoGestire && (
                <button type="button" onClick={() => handleRimuovi(s.userId)} disabled={caricamento} className="text-xs text-red-400 hover:underline">
                  Rimuovi
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {puoGestire && disponibili.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={daAggiungere}
            onChange={(e) => setDaAggiungere(e.target.value)}
            className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light"
          >
            <option value="">Aggiungi studente verificato…</option>
            {disponibili.map((s) => (
              <option key={s.userId} value={s.userId}>
                {etichettaPrincipaleStudente(s.nome, s.cognome, s.email)}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={handleAggiungi} disabled={!daAggiungere || caricamento}>
            Aggiungi
          </Button>
        </div>
      )}
      {errore && <p className="mt-2 text-sm text-red-400">{errore}</p>}
    </div>
  );
}
