"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import type { RigaPresenza } from "@/lib/scuola/eventi";
import { etichettaPrincipaleStudente } from "@/lib/scuola/formatStudente";

export default function RegistroPresenzeEvento({
  eventoId,
  righe,
  puoCertificare,
}: {
  eventoId: string;
  righe: RigaPresenza[];
  puoCertificare: boolean;
}) {
  const router = useRouter();
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [caricamento, setCaricamento] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  function toggle(studentId: string) {
    setSelezionati((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  }

  async function certifica(studentIds: string[]) {
    setCaricamento("certifica");
    setErrore(null);
    try {
      const supabase = createClient();
      for (const studentId of studentIds) {
        const { error } = await supabase.rpc("certifica_presenza", { p_evento_id: eventoId, p_student_id: studentId });
        if (error) setErrore("Non è stato possibile certificare la presenza di tutti gli studenti selezionati. Riprova.");
      }
      setSelezionati([]);
      router.refresh();
    } finally {
      setCaricamento(null);
    }
  }

  const daCertificare = righe.filter((r) => r.stato !== "partecipato");

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      {!puoCertificare && (
        <p className="mb-3 text-xs text-kireo-muted">
          Puoi vedere il registro presenze, ma non hai il permesso di certificarle: chiedi al referente di attivarlo da Staff.
        </p>
      )}
      {puoCertificare && selezionati.length > 0 && (
        <div className="mb-3">
          <Button type="button" variant="primary" onClick={() => certifica(selezionati)} disabled={caricamento !== null}>
            {caricamento ? "Certificazione…" : `Certifica presenza selezionati (${selezionati.length})`}
          </Button>
        </div>
      )}
      {puoCertificare && daCertificare.length > 1 && (
        <button
          type="button"
          onClick={() => certifica(daCertificare.map((r) => r.studentId))}
          disabled={caricamento !== null}
          className="mb-3 text-sm text-kireo-orange underline underline-offset-2"
        >
          Certifica tutti i presenti
        </button>
      )}
      {errore && <p className="mb-3 text-sm text-red-400">{errore}</p>}
      <ul className="space-y-1.5">
        {righe.map((r) => (
          <li key={r.studentId} className="flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-3">
              {puoCertificare && r.stato !== "partecipato" && (
                <input
                  type="checkbox"
                  checked={selezionati.includes(r.studentId)}
                  onChange={() => toggle(r.studentId)}
                  className="h-4 w-4 rounded border-white/20 bg-kireo-dark accent-kireo-green"
                />
              )}
              <Link href={`/scuola/studenti/${r.studentId}`} className="text-kireo-light/90 hover:underline">
                {etichettaPrincipaleStudente(r.nome, r.cognome, r.email)}
              </Link>
            </label>
            {r.stato === "partecipato" ? (
              <span className="rounded-full bg-kireo-green/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-green-light">Presente ✓</span>
            ) : puoCertificare ? (
              <button
                type="button"
                onClick={() => certifica([r.studentId])}
                disabled={caricamento !== null}
                className="text-xs text-kireo-orange underline underline-offset-2"
              >
                Certifica
              </button>
            ) : (
              <span className="text-xs text-kireo-muted">In attesa</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
