"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { messaggioErroreAuth } from "@/lib/authErrors";

export default function ReimpostaPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = "La password deve avere almeno 8 caratteri.";
    if (confermaPassword !== password) next.confermaPassword = "Le password non coincidono.";
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
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErroreGenerale(messaggioErroreAuth(error));
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setErroreGenerale("Qualcosa è andato storto durante l'aggiornamento. Riprova tra qualche istante.");
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
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Nuova password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: "" }));
          }}
          aria-invalid={Boolean(errors.password)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.password))}`}
          placeholder="Almeno 8 caratteri"
        />
        {errors.password && <p className="mt-1.5 text-sm text-red-400">{errors.password}</p>}
      </div>

      <div>
        <label htmlFor="confermaPassword" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Conferma password
        </label>
        <input
          id="confermaPassword"
          name="confermaPassword"
          type="password"
          autoComplete="new-password"
          value={confermaPassword}
          onChange={(e) => {
            setConfermaPassword(e.target.value);
            setErrors((prev) => ({ ...prev, confermaPassword: "" }));
          }}
          aria-invalid={Boolean(errors.confermaPassword)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.confermaPassword))}`}
          placeholder="Ripeti la password"
        />
        {errors.confermaPassword && <p className="mt-1.5 text-sm text-red-400">{errors.confermaPassword}</p>}
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={caricamento}>
        {caricamento ? "Salvataggio…" : "Salva la nuova password"}
      </Button>
    </form>
  );
}
