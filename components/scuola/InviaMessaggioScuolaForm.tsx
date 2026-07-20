"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";

type Classe = { id: string; nomeVisualizzato: string };
type Studente = { userId: string; nome: string; cognome: string };

export default function InviaMessaggioScuolaForm({ classi, studenti }: { classi: Classe[]; studenti: Studente[] }) {
  const router = useRouter();
  const [destinatari, setDestinatari] = useState<"tutta_scuola" | "classe" | "selezione">("tutta_scuola");
  const [classeId, setClasseId] = useState("");
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [oggetto, setOggetto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [inviando, setInviando] = useState(false);
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [inviato, setInviato] = useState(false);

  function toggleStudente(id: string) {
    setSelezionati((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroreGenerale(null);
    const next: Record<string, string> = {};
    if (!oggetto.trim()) next.oggetto = "Inserisci un oggetto.";
    if (!corpo.trim()) next.corpo = "Scrivi il contenuto del messaggio.";
    if (destinatari === "classe" && !classeId) next.classeId = "Seleziona una classe.";
    if (destinatari === "selezione" && selezionati.length === 0) next.selezione = "Seleziona almeno uno studente.";
    setErrori(next);
    if (Object.keys(next).length > 0) return;

    setInviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("invia_messaggio_scuola", {
        p_destinatari: destinatari,
        p_oggetto: oggetto.trim(),
        p_corpo: corpo.trim(),
        p_classe_id: destinatari === "classe" ? classeId : null,
        p_student_ids: destinatari === "selezione" ? selezionati : null,
        p_canale: "interno",
      });
      if (error) {
        setErroreGenerale("Non è stato possibile inviare il messaggio. Riprova più tardi.");
        return;
      }
      setInviato(true);
      router.refresh();
    } catch {
      setErroreGenerale("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setInviando(false);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Messaggio inviato</h3>
        <p className="mt-2 text-sm text-kireo-muted">
          Consegnato internamente ai destinatari. L&apos;invio via email non è ancora attivo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6">
      {erroreGenerale && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>}

      <div>
        <label htmlFor="destinatari" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Destinatari
        </label>
        <select
          id="destinatari"
          value={destinatari}
          onChange={(e) => setDestinatari(e.target.value as typeof destinatari)}
          className={`${inputClass} ${fieldBorder(false)}`}
        >
          <option value="tutta_scuola">Tutta la scuola (studenti verificati)</option>
          <option value="classe">Una classe</option>
          <option value="selezione">Selezione di studenti</option>
        </select>
      </div>

      {destinatari === "classe" && (
        <div>
          <label htmlFor="classeId" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Classe
          </label>
          <select id="classeId" value={classeId} onChange={(e) => setClasseId(e.target.value)} className={`${inputClass} ${fieldBorder(Boolean(errori.classeId))}`}>
            <option value="">Seleziona una classe</option>
            {classi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nomeVisualizzato}
              </option>
            ))}
          </select>
          {errori.classeId && <p className="mt-1.5 text-sm text-red-400">{errori.classeId}</p>}
        </div>
      )}

      {destinatari === "selezione" && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-kireo-light">Studenti ({selezionati.length} selezionati)</p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-3">
            {studenti.map((s) => (
              <label key={s.userId} className="flex items-center gap-2 text-sm text-kireo-light/90">
                <input
                  type="checkbox"
                  checked={selezionati.includes(s.userId)}
                  onChange={() => toggleStudente(s.userId)}
                  className="h-4 w-4 rounded border-white/20 bg-kireo-dark accent-kireo-green"
                />
                {s.nome} {s.cognome}
              </label>
            ))}
          </div>
          {errori.selezione && <p className="mt-1.5 text-sm text-red-400">{errori.selezione}</p>}
        </div>
      )}

      <div>
        <label htmlFor="oggetto" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Oggetto
        </label>
        <input id="oggetto" value={oggetto} onChange={(e) => setOggetto(e.target.value)} aria-invalid={Boolean(errori.oggetto)} className={`${inputClass} ${fieldBorder(Boolean(errori.oggetto))}`} />
        {errori.oggetto && <p className="mt-1.5 text-sm text-red-400">{errori.oggetto}</p>}
      </div>

      <div>
        <label htmlFor="corpo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Messaggio
        </label>
        <textarea id="corpo" value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={5} aria-invalid={Boolean(errori.corpo)} className={`${inputClass} ${fieldBorder(Boolean(errori.corpo))}`} />
        {errori.corpo && <p className="mt-1.5 text-sm text-red-400">{errori.corpo}</p>}
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={inviando}>
        {inviando ? "Invio in corso…" : "Invia messaggio"}
      </Button>
      <p className="text-center text-xs text-kireo-muted">
        Consegna interna immediata. L&apos;invio via email è predisposto ma non ancora attivo.
      </p>
    </form>
  );
}
