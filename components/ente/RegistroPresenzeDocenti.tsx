"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

type Iscritto = {
  userId: string;
  nomeCompleto: string;
  stato: string;
};

// Registro presenze per un evento docenti dell'ente: certifica la
// partecipazione di un docente iscritto → genera l'attestato (idempotente,
// vedi certifica_partecipazione_docente). Nome/cognome dei docenti sono
// visibili solo qui, solo per i propri eventi (RLS
// profiles_select_organizzatore_docenti_iscritti), solo per poterli
// certificare — mai dati aggregati o cross-evento.
export default function RegistroPresenzeDocenti({ eventoId, iscritti }: { eventoId: string; iscritti: Iscritto[] }) {
  const router = useRouter();
  const [caricamentoId, setCaricamentoId] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function certifica(userId: string) {
    setCaricamentoId(userId);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("certifica_partecipazione_docente", { p_evento_id: eventoId, p_user_id: userId });
      if (error) {
        setErrore("Non è stato possibile certificare la partecipazione. Riprova più tardi.");
        return;
      }
      router.refresh();
    } finally {
      setCaricamentoId(null);
    }
  }

  if (iscritti.length === 0) {
    return <p className="text-sm text-kireo-muted">Nessun docente iscritto a questo webinar.</p>;
  }

  return (
    <div className="space-y-2">
      {errore && <p className="text-sm text-red-400">{errore}</p>}
      <ul className="space-y-2">
        {iscritti.map((i) => (
          <li key={i.userId} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-kireo-dark p-3">
            <span className="text-sm text-kireo-light">{i.nomeCompleto}</span>
            {i.stato === "partecipato" ? (
              <span className="rounded-full bg-kireo-green/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-green-light">Certificato</span>
            ) : (
              <Button type="button" variant="outline" onClick={() => certifica(i.userId)} disabled={caricamentoId === i.userId}>
                {caricamentoId === i.userId ? "Un momento…" : "Certifica partecipazione"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
