"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";

export default function CreaClasseForm({ scuolaProfiloId }: { scuolaProfiloId: string }) {
  const router = useRouter();
  const [anno, setAnno] = useState("1");
  const [sezione, setSezione] = useState("");
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore(null);
    if (!sezione.trim()) {
      setErrore("Inserisci la sezione (es. A, B…).");
      return;
    }

    setInviando(true);
    try {
      const supabase = createClient();
      const sezionePulita = sezione.trim().toUpperCase();
      const { error } = await supabase.from("classi").insert({
        scuola_profilo_id: scuolaProfiloId,
        anno: Number(anno),
        sezione: sezionePulita,
        nome_visualizzato: `${anno}ª${sezionePulita}`,
      });
      if (error) {
        setErrore(error.code === "23505" ? "Esiste già una classe con questo anno e sezione." : "Non è stato possibile creare la classe.");
        return;
      }
      setSezione("");
      router.refresh();
    } finally {
      setInviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5">
      <div>
        <label htmlFor="anno" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Anno
        </label>
        <select id="anno" value={anno} onChange={(e) => setAnno(e.target.value)} className={`${inputClass} ${fieldBorder(false)} w-24`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}º
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sezione" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Sezione
        </label>
        <input
          id="sezione"
          value={sezione}
          onChange={(e) => setSezione(e.target.value)}
          className={`${inputClass} ${fieldBorder(false)} w-24`}
          placeholder="B"
          maxLength={4}
        />
      </div>
      <Button type="submit" variant="primary" disabled={inviando}>
        {inviando ? "Creazione…" : "Crea classe"}
      </Button>
      {errore && <p className="w-full text-sm text-red-400">{errore}</p>}
    </form>
  );
}
