"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./Button";
import ScuolaCascadeFields, { SCUOLA_ALTRO, type ScuolaCascadeValue } from "./ScuolaCascadeFields";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { messaggioErroreAuth } from "@/lib/authErrors";

// Messaggi per gli errori che possono arrivare da un link di conferma email
// o da un accesso successivo non ancora finalizzato (lib/scuola/context.ts)
// — mostrati qui, sul form da cui è partita la richiesta, non sulla pagina
// di login (stesso principio già applicato al form ente).
const MESSAGGI_ERRORE_CONFERMA: Record<string, string> = {
  scuola_dati_incompleti:
    "Mancano alcuni dati per completare la registrazione della tua scuola: prova a registrarti di nuovo, oppure contattaci da /contatti.",
  scuola_sconosciuto:
    "Qualcosa è andato storto nel completare la registrazione. Se la tua scuola ha già un referente registrato, contattaci da /contatti per essere aggiunto come tutor; altrimenti prova ad accedere di nuovo tra qualche istante.",
};

export default function RichiestaAccessoScuolaForm() {
  const searchParams = useSearchParams();
  const erroreParam = searchParams.get("errore");

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [scuolaValue, setScuolaValue] = useState<ScuolaCascadeValue>({
    provincia: "",
    indirizzo: "",
    scuola: "",
    scuolaAltro: "",
  });
  const [privacy, setPrivacy] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(
    erroreParam ? (MESSAGGI_ERRORE_CONFERMA[erroreParam] ?? "Si è verificato un errore.") : null,
  );
  const [caricamento, setCaricamento] = useState(false);
  const [inviato, setInviato] = useState(false);

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleScuolaChange(patch: Partial<ScuolaCascadeValue>) {
    setScuolaValue((prev) => ({ ...prev, ...patch }));
    Object.keys(patch).forEach((field) => clearError(field));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!nome.trim()) next.nome = "Inserisci il tuo nome.";
    if (!cognome.trim()) next.cognome = "Inserisci il tuo cognome.";

    if (!email.trim()) {
      next.email = "Inserisci un'email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Inserisci un indirizzo email valido.";
    }

    if (!scuolaValue.provincia) next.provincia = "Seleziona la provincia della scuola.";
    if (!scuolaValue.indirizzo) next.indirizzo = "Seleziona il tipo di istituto.";
    if (!scuolaValue.scuola) {
      next.scuola = "Seleziona la scuola.";
    } else if (scuolaValue.scuola === SCUOLA_ALTRO) {
      next.scuola = "La tua scuola non è ancora nel nostro elenco: scrivici da /contatti per aggiungerla.";
    }

    if (!password) {
      next.password = "Scegli una password.";
    } else if (password.length < 8) {
      next.password = "La password deve avere almeno 8 caratteri.";
    }
    if (confermaPassword !== password) next.confermaPassword = "Le password non coincidono.";
    if (!privacy) next.privacy = "Devi accettare la privacy policy per continuare.";

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
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dopo-accesso`,
          data: {
            ruolo: "referente_scuola",
            scuola_id: scuolaValue.scuola,
            nome: nome.trim(),
            cognome: cognome.trim(),
          },
        },
      });

      if (error) {
        setErroreGenerale(messaggioErroreAuth(error));
        return;
      }

      setInviato(true);
    } catch {
      setErroreGenerale("Qualcosa è andato storto durante la richiesta. Riprova tra qualche istante.");
    } finally {
      setCaricamento(false);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
          Controlla la tua email
        </h3>
        <p className="mt-2 text-sm text-kireo-muted">
          Conferma l&apos;indirizzo email per completare la registrazione. La tua scuola resterà in attesa finché
          KIREO non attiva la convenzione.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="nome" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Nome
          </label>
          <input
            id="nome"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              clearError("nome");
            }}
            aria-invalid={Boolean(errors.nome)}
            className={`${inputClass} ${fieldBorder(Boolean(errors.nome))}`}
          />
          {errors.nome && <p className="mt-1.5 text-sm text-red-400">{errors.nome}</p>}
        </div>
        <div>
          <label htmlFor="cognome" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Cognome
          </label>
          <input
            id="cognome"
            value={cognome}
            onChange={(e) => {
              setCognome(e.target.value);
              clearError("cognome");
            }}
            aria-invalid={Boolean(errors.cognome)}
            className={`${inputClass} ${fieldBorder(Boolean(errors.cognome))}`}
          />
          {errors.cognome && <p className="mt-1.5 text-sm text-red-400">{errors.cognome}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-kireo-light">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
          aria-invalid={Boolean(errors.email)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.email))}`}
          placeholder="referente@scuola.edu.it"
        />
        {errors.email && <p className="mt-1.5 text-sm text-red-400">{errors.email}</p>}
      </div>

      <ScuolaCascadeFields value={scuolaValue} onChange={handleScuolaChange} errors={errors} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError("password");
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
            type="password"
            autoComplete="new-password"
            value={confermaPassword}
            onChange={(e) => {
              setConfermaPassword(e.target.value);
              clearError("confermaPassword");
            }}
            aria-invalid={Boolean(errors.confermaPassword)}
            className={`${inputClass} ${fieldBorder(Boolean(errors.confermaPassword))}`}
          />
          {errors.confermaPassword && <p className="mt-1.5 text-sm text-red-400">{errors.confermaPassword}</p>}
        </div>
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="privacy"
            type="checkbox"
            checked={privacy}
            onChange={(e) => {
              setPrivacy(e.target.checked);
              clearError("privacy");
            }}
            aria-invalid={Boolean(errors.privacy)}
            className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
          />
          <label htmlFor="privacy" className="text-sm text-kireo-muted">
            Ho letto e accetto la{" "}
            <a href="/privacy" className="text-kireo-orange underline underline-offset-2">
              Privacy Policy
            </a>
          </label>
        </div>
        {errors.privacy && <p className="mt-1.5 text-sm text-red-400">{errors.privacy}</p>}
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={caricamento}>
        {caricamento ? "Invio in corso…" : "Registra la tua scuola"}
      </Button>
      <p className="text-center text-xs text-kireo-muted">
        La scuola resta in attesa di attivazione: KIREO la contatta per la convenzione prima di sbloccare le funzioni.
      </p>
    </form>
  );
}
