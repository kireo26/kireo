"use client";

import { indirizzoDiUnAccountCancellato, TESTO_INDIRIZZO_CANCELLATO } from "@/lib/auth/indirizzoCancellato";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { messaggioErroreAuth } from "@/lib/authErrors";
import { codiceInvitoCompleto, leggiEsitoVerifica, normalizzaCodiceInvito, TESTI_CODICE_INVITO } from "@/lib/scuola/codiceInvito";

const MESSAGGI_ERRORE_CONFERMA: Record<string, string> = {
  dati_incompleti: "Mancano alcuni dati per completare la registrazione: prova di nuovo, oppure contattaci da /contatti.",
  codice_non_valido: "Il codice invito non è più valido: chiedine uno nuovo al referente della tua scuola.",
  troppi_tentativi: "Troppi codici sbagliati provati con questo account nell'ultima ora: riprova fra un'ora, con il link dell'invito che ti ha mandato il referente.",
  sconosciuto: "Qualcosa è andato storto. Prova ad accedere di nuovo tra qualche istante: se il problema persiste, contattaci da /contatti.",
};

export default function RiscattaInvitoTutorForm({ codiceIniziale }: { codiceIniziale: string }) {
  const searchParams = useSearchParams();
  const erroreParam = searchParams.get("errore");
  const [codice, setCodice] = useState(codiceIniziale);
  const [statoCodice, setStatoCodice] = useState<"idle" | "incompleto" | "verificando" | "valido" | "non_valido" | "troppi_tentativi" | "non_controllato">("idle");
  const [nomeScuola, setNomeScuola] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [privacy, setPrivacy] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(
    erroreParam ? (MESSAGGI_ERRORE_CONFERMA[erroreParam] ?? "Si è verificato un errore.") : null,
  );
  const [caricamento, setCaricamento] = useState(false);
  const [inviato, setInviato] = useState(false);

  useEffect(() => {
    const codiceNormalizzato = normalizzaCodiceInvito(codice);
    if (!codiceNormalizzato) {
      setStatoCodice("idle");
      setNomeScuola(null);
      return;
    }
    // Un codice a metà non si verifica: la verifica conta i tentativi sbagliati,
    // e ogni lettera battuta sarebbe un tentativo.
    if (!codiceInvitoCompleto(codiceNormalizzato)) {
      setStatoCodice("incompleto");
      setNomeScuola(null);
      return;
    }

    let annullato = false;
    setStatoCodice("verificando");
    const timeout = setTimeout(async () => {
      try {
        const risposta = await fetch("/api/scuola/invito/verifica", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codice: codiceNormalizzato }),
        });
        const esito = leggiEsitoVerifica(await risposta.json().catch(() => null));
        if (annullato) return;
        setStatoCodice(esito.esito);
        setNomeScuola(esito.esito === "valido" ? esito.nomeScuola : null);
      } catch {
        if (!annullato) setStatoCodice("non_controllato");
      }
    }, 400);

    return () => {
      annullato = true;
      clearTimeout(timeout);
    };
  }, [codice]);

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
    if (statoCodice !== "valido") next.codice = "Inserisci un codice invito valido.";
    if (!nome.trim()) next.nome = "Inserisci il tuo nome.";
    if (!cognome.trim()) next.cognome = "Inserisci il tuo cognome.";
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
      if ((await indirizzoDiUnAccountCancellato(email.trim())) === true) {
        setErroreGenerale(TESTO_INDIRIZZO_CANCELLATO);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dopo-accesso`,
          data: {
            ruolo: "tutor_scuola",
            codice_invito: normalizzaCodiceInvito(codice),
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
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Controlla la tua email</h3>
        <p className="mt-2 text-sm text-kireo-muted">Conferma l&apos;indirizzo email per completare la registrazione come tutor.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>
      )}

      <div>
        <label htmlFor="codice" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Codice invito
        </label>
        <input
          id="codice"
          value={codice}
          onChange={(e) => setCodice(e.target.value.toUpperCase())}
          aria-invalid={Boolean(errors.codice)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.codice))}`}
          placeholder="TUTOR-XXXX-XXXX-XXXX-XXXX"
        />
        {statoCodice === "verificando" && <p className="mt-1.5 text-sm text-kireo-muted">Verifica in corso…</p>}
        {statoCodice === "valido" && (
          <p className="mt-1.5 text-sm text-kireo-green-light">Codice valido — {nomeScuola ?? "scuola trovata"}.</p>
        )}
        {statoCodice === "incompleto" && <p className="mt-1.5 text-sm text-kireo-muted">{TESTI_CODICE_INVITO.forma}</p>}
        {statoCodice === "non_valido" && <p className="mt-1.5 text-sm text-red-400">{TESTI_CODICE_INVITO.nonValido}</p>}
        {statoCodice === "troppi_tentativi" && <p className="mt-1.5 text-sm text-red-400">{TESTI_CODICE_INVITO.troppiTentativi}</p>}
        {statoCodice === "non_controllato" && <p className="mt-1.5 text-sm text-kireo-orange">{TESTI_CODICE_INVITO.nonControllato}</p>}
        {errors.codice && <p className="mt-1.5 text-sm text-red-400">{errors.codice}</p>}
      </div>

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
        />
        {errors.email && <p className="mt-1.5 text-sm text-red-400">{errors.email}</p>}
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
        {caricamento ? "Invio in corso…" : "Completa la registrazione"}
      </Button>
    </form>
  );
}
