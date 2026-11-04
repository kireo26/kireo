"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { testoErroreCertificazioneDocente } from "@/lib/ente/certificazioneDocente";
import { sessioneAncoraViva } from "@/lib/rifiutiScrittura";
import { descriviErrore } from "@/lib/erroreSupabase";

type Iscritto = {
  userId: string;
  nomeCompleto: string;
  stato: string;
};

// Registro presenze per un evento docenti dell'ente: certifica la
// partecipazione di un docente iscritto → genera l'attestato (idempotente,
// vedi certifica_partecipazione_docente). Nome/cognome dei docenti sono
// visibili solo qui, solo per i propri eventi (dal 04/11 dalla funzione
// nomi_dei_docenti_iscritti, solo nome e cognome), solo per poterli
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
        // Ogni rifiuto dice il suo perché: «riprova» solo a un guasto (vedi
        // lib/ente/certificazioneDocente.ts, dove i rifiuti sono misurati).
        console.error("RegistroPresenzeDocenti: certificazione non riuscita", descriviErrore(error));
        setErrore(testoErroreCertificazioneDocente(error, await sessioneAncoraViva(supabase)));
        // Chi ha annullato l'iscrizione sparisce dall'elenco: la pagina si rilegge.
        if (error.message?.trim() === "non_iscritto") router.refresh();
        return;
      }
      router.refresh();
    } catch (e) {
      console.error("RegistroPresenzeDocenti: certificazione non arrivata", descriviErrore(e));
      setErrore(testoErroreCertificazioneDocente(null, true));
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
