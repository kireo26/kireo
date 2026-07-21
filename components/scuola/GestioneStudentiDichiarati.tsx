"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import { etichettaPrincipaleStudente, nomeCompletoStudente } from "@/lib/scuola/formatStudente";

type StudenteDichiarato = {
  userId: string;
  nome: string;
  cognome: string;
  classe: string | null;
  email: string | null;
  dichiaratoIl: string;
};

export default function GestioneStudentiDichiarati({ studenti }: { studenti: StudenteDichiarato[] }) {
  const router = useRouter();
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [caricamento, setCaricamento] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  function toggle(userId: string) {
    setSelezionati((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function agisciSu(userIds: string[], esito: "verificato" | "rifiutato") {
    setCaricamento(esito === "verificato" ? "verifica" : "rifiuta");
    setErrore(null);
    try {
      const supabase = createClient();
      for (const userId of userIds) {
        const { error } = await supabase.rpc("verifica_studente", { p_student_id: userId, p_esito: esito });
        if (error) {
          setErrore("Non è stato possibile completare l'operazione per tutti gli studenti selezionati. Riprova.");
        }
      }
      setSelezionati([]);
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  if (studenti.length === 0) {
    return <p className="text-sm text-kireo-muted">Nessuno studente in attesa di verifica.</p>;
  }

  return (
    <div>
      {selezionati.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-sm text-kireo-light">{selezionati.length} selezionati</span>
          <Button type="button" variant="primary" onClick={() => agisciSu(selezionati, "verificato")} disabled={caricamento !== null}>
            {caricamento === "verifica" ? "Verifica…" : "Verifica selezionati"}
          </Button>
          <Button type="button" variant="outline" onClick={() => agisciSu(selezionati, "rifiutato")} disabled={caricamento !== null}>
            {caricamento === "rifiuta" ? "Rifiuto…" : "Rifiuta selezionati"}
          </Button>
        </div>
      )}
      {errore && <p className="mb-3 text-sm text-red-400">{errore}</p>}
      <ul className="space-y-2">
        {studenti.map((s) => (
          <li key={s.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selezionati.includes(s.userId)}
                onChange={() => toggle(s.userId)}
                className="h-4 w-4 rounded border-white/20 bg-kireo-dark accent-kireo-green"
              />
              <span>
                <span className="block">
                  <span className="font-heading text-sm font-semibold text-kireo-light">
                    {etichettaPrincipaleStudente(s.nome, s.cognome, s.email)}
                  </span>
                  {nomeCompletoStudente(s.nome, s.cognome) && s.email && (
                    <span className="ml-2 text-xs text-kireo-muted">{s.email}</span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-kireo-muted">
                  {s.classe && <>classe dichiarata: {s.classe} · </>}
                  dichiarata il {new Date(s.dichiaratoIl).toLocaleDateString("it-IT", { dateStyle: "long" })}
                </span>
              </span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="primary" onClick={() => agisciSu([s.userId], "verificato")} disabled={caricamento !== null}>
                Verifica
              </Button>
              <Button type="button" variant="outline" onClick={() => agisciSu([s.userId], "rifiutato")} disabled={caricamento !== null}>
                Rifiuta
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
