"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { messaggioErroreAuth } from "@/lib/authErrors";

const MESSAGGI_ERRORE: Record<string, string> = {
  link_non_valido: "Il link non è valido. Riprova ad accedere.",
  link_scaduto: "Il link è scaduto o già utilizzato: prova ad accedere, oppure richiedi un nuovo link.",
  registrazione_fallita: "Non siamo riusciti a completare la registrazione. Contattaci da /contatti.",
  dati_incompleti: "Mancano alcuni dati per completare la registrazione. Contattaci da /contatti.",
  scuola_non_valida: "La scuola collegata al tuo profilo non è più disponibile. Contattaci da /contatti.",
  codice_non_valido: "Il codice della tua scuola non è più valido. Contattaci da /contatti.",
  sconosciuto: "Non siamo riusciti a completare la registrazione. Contattaci da /contatti.",
};

export default function AccediForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom");
  const erroreParam = searchParams.get("errore");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(
    erroreParam ? (MESSAGGI_ERRORE[erroreParam] ?? "Si è verificato un errore.") : null,
  );
  const [caricamento, setCaricamento] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Inserisci la tua email.";
    if (!password) next.password = "Inserisci la tua password.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroreGenerale(null);
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setCaricamento(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) {
        setErroreGenerale(messaggioErroreAuth(error));
        return;
      }

      router.push(redirectedFrom || "/dopo-accesso");
      router.refresh();
    } catch {
      setErroreGenerale("Qualcosa è andato storto durante l'accesso. Riprova tra qualche istante.");
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>
      )}

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
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((prev) => ({ ...prev, email: "" }));
          }}
          aria-invalid={Boolean(errors.email)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.email))}`}
          placeholder="nome@esempio.it"
        />
        {errors.email && <p className="mt-1.5 text-sm text-red-400">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: "" }));
          }}
          aria-invalid={Boolean(errors.password)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.password))}`}
          placeholder="La tua password"
        />
        {errors.password && <p className="mt-1.5 text-sm text-red-400">{errors.password}</p>}
      </div>

      <div className="text-right">
        <Link href="/recupera-password" className="text-sm text-kireo-orange underline underline-offset-2">
          Password dimenticata?
        </Link>
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={caricamento}>
        {caricamento ? "Accesso in corso…" : "Accedi"}
      </Button>

      <p className="text-center text-sm text-kireo-muted">
        Non hai ancora un profilo?{" "}
        <Link href="/registrazione" className="text-kireo-orange underline underline-offset-2">
          Registrati
        </Link>
      </p>
      <p className="text-center text-sm text-kireo-muted">
        Sei un ente formativo?{" "}
        <Link href="/istituzioni" className="text-kireo-orange underline underline-offset-2">
          Scopri come aderire
        </Link>
      </p>
    </form>
  );
}
