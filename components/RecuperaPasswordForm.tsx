"use client";

import { useState } from "react";
import { Button } from "./Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";

export default function RecuperaPasswordForm() {
  const [email, setEmail] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [inviato, setInviato] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrore("Inserisci un indirizzo email valido.");
      return;
    }

    setCaricamento(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reimposta-password`,
      });

      if (error) {
        setErrore("Non siamo riusciti a inviare l'email. Riprova.");
        return;
      }

      setInviato(true);
    } catch {
      setErrore("Qualcosa è andato storto durante l'invio. Riprova tra qualche istante.");
    } finally {
      setCaricamento(false);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Controlla la tua email</h2>
        <p className="mt-2 text-sm text-kireo-muted">
          Se l&apos;indirizzo è registrato su KIREO, ti abbiamo inviato un link per reimpostare la password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {errore && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errore}</p>}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-kireo-light">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errore)}
          className={`${inputClass} ${fieldBorder(Boolean(errore))}`}
          placeholder="nome@esempio.it"
        />
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={caricamento}>
        {caricamento ? "Invio in corso…" : "Invia il link di recupero"}
      </Button>
    </form>
  );
}
