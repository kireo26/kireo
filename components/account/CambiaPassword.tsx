"use client";

// Il cambio della password da dentro. Prima si chiede quella attuale
// (`signInWithPassword`), poi si scrive la nuova (`updateUser`). Gli errori di
// Supabase passano da `messaggioErroreAuth`, la stessa strada dei form di
// accesso: «riprova» solo a un guasto.

import { useState } from "react";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { messaggioErroreAuth } from "@/lib/authErrors";
import { erroriPassword, TESTI_PASSWORD } from "@/lib/account/cancellazione";

export default function CambiaPassword({ email }: { email: string }) {
  const [attuale, setAttuale] = useState("");
  const [nuova, setNuova] = useState("");
  const [conferma, setConferma] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errori, setErrori] = useState<string[]>([]);
  const [fatto, setFatto] = useState(false);

  async function handleCambia(e: React.FormEvent) {
    e.preventDefault();
    setFatto(false);
    const controllo = erroriPassword(attuale, nuova, conferma);
    setErrori(controllo);
    if (controllo.length > 0) return;
    setInCorso(true);
    const supabase = createClient();
    try {
      const { error: erroreAccesso } = await supabase.auth.signInWithPassword({ email, password: attuale });
      if (erroreAccesso) {
        setErrori([erroreAccesso.code === "invalid_credentials" ? TESTI_PASSWORD.attualeSbagliata : messaggioErroreAuth(erroreAccesso)]);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: nuova });
      if (error) {
        setErrori([messaggioErroreAuth(error)]);
        return;
      }
      setAttuale("");
      setNuova("");
      setConferma("");
      setFatto(true);
    } finally {
      setInCorso(false);
    }
  }

  const campo = (id: string, etichetta: string, valore: string, imposta: (v: string) => void, completamento: string) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-kireo-light">
        {etichetta}
      </label>
      <input
        id={id}
        type="password"
        autoComplete={completamento}
        value={valore}
        onChange={(e) => imposta(e.target.value)}
        className={`${inputClass} ${fieldBorder(false)}`}
      />
    </div>
  );

  return (
    <form onSubmit={handleCambia} noValidate className="space-y-4">
      {campo("password-attuale", "Password attuale", attuale, setAttuale, "current-password")}
      {campo("password-nuova", "Nuova password", nuova, setNuova, "new-password")}
      {campo("password-conferma", "Ripeti la nuova password", conferma, setConferma, "new-password")}
      {errori.map((t) => (
        <p key={t} className="text-sm text-red-400">
          {t}
        </p>
      ))}
      {fatto ? <p className="text-sm text-kireo-green">{TESTI_PASSWORD.cambiata}</p> : null}
      <Button type="submit" variant="outline" disabled={inCorso}>
        {inCorso ? "Salvataggio…" : "Cambia la password"}
      </Button>
    </form>
  );
}
