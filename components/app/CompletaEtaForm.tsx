"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";

const ETA_MINIMA = 14;
const ETA_MASSIMA_PLAUSIBILE = 25;

function calcolaEta(dataNascita: string): number {
  const nascita = new Date(dataNascita);
  const oggi = new Date();
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const nonAncoraCompleanno = oggi.getMonth() < nascita.getMonth() || (oggi.getMonth() === nascita.getMonth() && oggi.getDate() < nascita.getDate());
  if (nonAncoraCompleanno) eta--;
  return eta;
}

// Blocco obbligatorio per chi si è registrato prima che la data di nascita
// fosse un campo raccolto: senza questo dato non sappiamo se ha l'età minima,
// e le regole che guardano l'età non possono decidere — i gesti verso un ente
// (puo_contattare_enti, 20261109110000, che senza data dice no) e le
// comunicazioni facoltative (consenso_dato_da_maggiorenne).
export default function CompletaEtaForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [dataNascita, setDataNascita] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore(null);

    if (!dataNascita) {
      setErrore("Inserisci la tua data di nascita.");
      return;
    }
    const eta = calcolaEta(dataNascita);
    if (eta < ETA_MINIMA) {
      setErrore(`Su KIREO è richiesta un'età minima di ${ETA_MINIMA} anni. Se hai meno di ${ETA_MINIMA} anni, scrivi a KIREO tramite la pagina Contatti.`);
      return;
    }
    if (eta > ETA_MASSIMA_PLAUSIBILE) {
      setErrore("Controlla la data inserita: sembra implausibile per un profilo studente.");
      return;
    }

    setCaricamento(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ data_nascita: dataNascita }).eq("id", userId);
      if (error) {
        setErrore("Non è stato possibile salvare. Riprova.");
        return;
      }
      router.refresh();
    } catch {
      setErrore("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto mt-8 max-w-sm space-y-4 rounded-2xl border border-white/5 bg-kireo-card p-6 text-left">
      <div>
        <label htmlFor="dataNascita" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Data di nascita
        </label>
        <input
          id="dataNascita"
          type="date"
          value={dataNascita}
          onChange={(e) => setDataNascita(e.target.value)}
          aria-invalid={Boolean(errore)}
          className={`${inputClass} ${fieldBorder(Boolean(errore))}`}
        />
        {errore && <p className="mt-1.5 text-sm text-red-400">{errore}</p>}
      </div>
      <Button type="submit" variant="primary" className="w-full" disabled={caricamento}>
        {caricamento ? "Salvataggio…" : "Continua"}
      </Button>
    </form>
  );
}
