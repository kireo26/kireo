"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";

export default function CreaComunicazioneForm({
  istituzioneId,
  pianoPremium,
  quotaNewsletterRimasta,
  quotaComunicazioniKireoRimasta,
}: {
  istituzioneId: string;
  pianoPremium: boolean;
  quotaNewsletterRimasta: number;
  quotaComunicazioniKireoRimasta: number;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"newsletter" | "comunicazione_kireo">("newsletter");
  const [oggetto, setOggetto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [inviando, setInviando] = useState(false);
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [inviato, setInviato] = useState(false);

  const quotaRimasta = tipo === "newsletter" ? quotaNewsletterRimasta : quotaComunicazioniKireoRimasta;
  const quotaEsaurita = quotaRimasta <= 0;

  function validate() {
    const next: Record<string, string> = {};
    if (!oggetto.trim()) next.oggetto = "Inserisci un oggetto.";
    if (!corpo.trim()) next.corpo = "Scrivi il contenuto della comunicazione.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroreGenerale(null);
    if (quotaEsaurita) {
      setErroreGenerale("Hai esaurito la quota per questo tipo di comunicazione nell'anno accademico corrente.");
      return;
    }
    const validazione = validate();
    setErrori(validazione);
    if (Object.keys(validazione).length > 0) return;

    setInviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("comunicazioni").insert({
        istituzione_id: istituzioneId,
        tipo,
        oggetto: oggetto.trim(),
        corpo: corpo.trim(),
        stato: "in_approvazione",
      });

      if (error) {
        setErroreGenerale("Non è stato possibile inviare la comunicazione. Riprova più tardi.");
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
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
          Comunicazione inviata in approvazione
        </h3>
        <p className="mt-2 text-sm text-kireo-muted">KIREO la revisiona prima di veicolarla — nessun invio diretto.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>
      )}

      <div>
        <label htmlFor="tipo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Tipo
        </label>
        <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={`${inputClass} ${fieldBorder(false)}`}>
          <option value="newsletter">Newsletter (ai tuoi iscritti)</option>
          {pianoPremium && <option value="comunicazione_kireo">Comunicazione mirata (piano premium)</option>}
        </select>
        <p className="mt-1.5 text-xs text-kireo-muted">
          Quota rimasta quest&apos;anno accademico: {quotaRimasta < 0 ? 0 : quotaRimasta}
        </p>
      </div>

      <div>
        <label htmlFor="oggetto" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Oggetto
        </label>
        <input
          id="oggetto"
          value={oggetto}
          onChange={(e) => setOggetto(e.target.value)}
          aria-invalid={Boolean(errori.oggetto)}
          className={`${inputClass} ${fieldBorder(Boolean(errori.oggetto))}`}
        />
        {errori.oggetto && <p className="mt-1.5 text-sm text-red-400">{errori.oggetto}</p>}
      </div>

      <div>
        <label htmlFor="corpo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Contenuto
        </label>
        <textarea
          id="corpo"
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={6}
          aria-invalid={Boolean(errori.corpo)}
          className={`${inputClass} ${fieldBorder(Boolean(errori.corpo))}`}
        />
        {errori.corpo && <p className="mt-1.5 text-sm text-red-400">{errori.corpo}</p>}
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={inviando || quotaEsaurita}>
        {quotaEsaurita ? "Quota esaurita" : inviando ? "Invio in corso…" : "Invia in approvazione"}
      </Button>
    </form>
  );
}
