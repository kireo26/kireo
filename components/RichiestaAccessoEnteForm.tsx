"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { messaggioErroreAuth } from "@/lib/authErrors";
import { generaSlug } from "@/lib/slug";

// Messaggi per gli errori che possono arrivare da un link di conferma email
// (app/auth/confirm/route.ts) o da un accesso successivo non ancora
// finalizzato (lib/ente/context.ts) — mostrati qui, sul form da cui è
// partita la richiesta, non sulla pagina di login. "ente_sconosciuto" è
// pensato per essere ritentabile: la finalizzazione è idempotente, un nuovo
// tentativo (accedendo di nuovo, o aprendo un'altra volta il link email) può
// ripartire pulito.
const MESSAGGI_ERRORE_CONFERMA: Record<string, string> = {
  ente_dati_incompleti:
    "Mancano alcuni dati per completare la registrazione del tuo ente: prova a registrarti di nuovo, oppure contattaci da /contatti.",
  ente_sconosciuto:
    "Qualcosa è andato storto nel completare la registrazione del tuo ente. Prova ad accedere di nuovo tra qualche istante: se il problema persiste, contattaci da /contatti.",
};

const TIPI_ISTITUZIONE = [
  { value: "universita", label: "Università" },
  { value: "its", label: "ITS Academy" },
  { value: "academy", label: "Accademia" },
  { value: "ente_professionale", label: "Ente di formazione professionale" },
  { value: "altro", label: "Altro" },
];

// Signup reale (email+password) per il ruolo istituzione: a differenza di
// RichiestaInformazioniForm (solo UI, per le scuole) questo crea davvero un
// account — l'ente entra in stato "in_attesa" finché KIREO non lo attiva
// manualmente (vedi finalize_registration_istituzione).
export default function RichiestaAccessoEnteForm() {
  const searchParams = useSearchParams();
  const erroreParam = searchParams.get("errore");

  const [nomeEnte, setNomeEnte] = useState("");
  const [tipo, setTipo] = useState("");
  const [referenteNome, setReferenteNome] = useState("");
  const [referenteCognome, setReferenteCognome] = useState("");
  const [email, setEmail] = useState("");
  const [sitoUfficiale, setSitoUfficiale] = useState("");
  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
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

  function validate() {
    const next: Record<string, string> = {};
    if (!nomeEnte.trim()) next.nomeEnte = "Inserisci il nome dell'ente.";
    if (!tipo) next.tipo = "Seleziona il tipo di istituzione.";
    if (!referenteNome.trim()) next.referenteNome = "Inserisci il nome del referente.";
    if (!referenteCognome.trim()) next.referenteCognome = "Inserisci il cognome del referente.";

    if (!email.trim()) {
      next.email = "Inserisci un'email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Inserisci un indirizzo email valido.";
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
            ruolo: "istituzione",
            nome_ente: nomeEnte.trim(),
            slug: generaSlug(nomeEnte.trim()),
            tipo,
            referente_nome: referenteNome.trim(),
            referente_cognome: referenteCognome.trim(),
            sito_ufficiale: sitoUfficiale.trim() || null,
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
          Conferma l&apos;indirizzo email per completare la richiesta. Il profilo del tuo ente resterà in attesa di
          attivazione da parte di KIREO prima di comparire pubblicamente.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>
      )}

      <div>
        <label htmlFor="nomeEnte" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Nome dell&apos;ente
        </label>
        <input
          id="nomeEnte"
          value={nomeEnte}
          onChange={(e) => {
            setNomeEnte(e.target.value);
            clearError("nomeEnte");
          }}
          aria-invalid={Boolean(errors.nomeEnte)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.nomeEnte))}`}
          placeholder="Es. Istituto Tecnico Superiore..."
        />
        {errors.nomeEnte && <p className="mt-1.5 text-sm text-red-400">{errors.nomeEnte}</p>}
      </div>

      <div>
        <label htmlFor="tipo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Tipo di istituzione
        </label>
        <select
          id="tipo"
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            clearError("tipo");
          }}
          aria-invalid={Boolean(errors.tipo)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.tipo))}`}
        >
          <option value="" disabled>
            Seleziona il tipo
          </option>
          {TIPI_ISTITUZIONE.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {errors.tipo && <p className="mt-1.5 text-sm text-red-400">{errors.tipo}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="referenteNome" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Nome del referente
          </label>
          <input
            id="referenteNome"
            value={referenteNome}
            onChange={(e) => {
              setReferenteNome(e.target.value);
              clearError("referenteNome");
            }}
            aria-invalid={Boolean(errors.referenteNome)}
            className={`${inputClass} ${fieldBorder(Boolean(errors.referenteNome))}`}
          />
          {errors.referenteNome && <p className="mt-1.5 text-sm text-red-400">{errors.referenteNome}</p>}
        </div>
        <div>
          <label htmlFor="referenteCognome" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Cognome del referente
          </label>
          <input
            id="referenteCognome"
            value={referenteCognome}
            onChange={(e) => {
              setReferenteCognome(e.target.value);
              clearError("referenteCognome");
            }}
            aria-invalid={Boolean(errors.referenteCognome)}
            className={`${inputClass} ${fieldBorder(Boolean(errors.referenteCognome))}`}
          />
          {errors.referenteCognome && <p className="mt-1.5 text-sm text-red-400">{errors.referenteCognome}</p>}
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
          placeholder="referente@ente.it"
        />
        {errors.email && <p className="mt-1.5 text-sm text-red-400">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="sitoUfficiale" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Sito ufficiale (facoltativo)
        </label>
        <input
          id="sitoUfficiale"
          type="url"
          value={sitoUfficiale}
          onChange={(e) => setSitoUfficiale(e.target.value)}
          className={`${inputClass} ${fieldBorder(false)}`}
          placeholder="https://..."
        />
      </div>

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
        {caricamento ? "Invio in corso…" : "Richiedi l'accesso"}
      </Button>
      <p className="text-center text-xs text-kireo-muted">
        Il profilo entra in stato di attesa: KIREO lo attiva manualmente prima che compaia pubblicamente.
      </p>
    </form>
  );
}
