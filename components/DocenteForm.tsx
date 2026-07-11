"use client";

import { useState } from "react";
import { Button } from "./Button";
import ScuolaCascadeFields, { SCUOLA_ALTRO, type ScuolaCascadeValue } from "./ScuolaCascadeFields";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { ETA_MINIMA, calcolaEta } from "@/lib/registrazione";

const MATERIE = [
  "Area umanistica",
  "Area scientifica",
  "Area linguistica",
  "Area tecnica/tecnologica",
  "Area economico-giuridica",
  "Area artistica",
  "Sostegno",
  "Religione",
  "Scienze motorie",
  "Altro",
];

export default function DocenteForm() {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dataNascita, setDataNascita] = useState("");
  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [materia, setMateria] = useState("");
  const [scuolaValue, setScuolaValue] = useState<ScuolaCascadeValue>({
    provincia: "",
    indirizzo: "",
    scuola: "",
    scuolaAltro: "",
  });
  const [referenteOrientamento, setReferenteOrientamento] = useState(false);
  const [dichiarazione, setDichiarazione] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [inviato, setInviato] = useState(false);

  const etaSottoMinimo = dataNascita !== "" && calcolaEta(dataNascita) < ETA_MINIMA;

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
      next.email = "Inserisci la tua email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Inserisci un indirizzo email valido.";
    }

    if (!dataNascita) {
      next.dataNascita = "Inserisci la tua data di nascita.";
    } else if (calcolaEta(dataNascita) < ETA_MINIMA) {
      next.dataNascita = `Per registrarti su KIREO devi avere almeno ${ETA_MINIMA} anni.`;
    }

    if (!password) {
      next.password = "Scegli una password.";
    } else if (password.length < 8) {
      next.password = "La password deve avere almeno 8 caratteri.";
    }
    if (confermaPassword !== password) next.confermaPassword = "Le password non coincidono.";

    if (!materia) next.materia = "Seleziona la tua materia di insegnamento.";
    if (!scuolaValue.provincia) next.provincia = "Seleziona la provincia della scuola.";
    if (!scuolaValue.indirizzo) next.indirizzo = "Seleziona il tipo di istituto.";

    if (!scuolaValue.scuola) {
      next.scuola = "Seleziona la scuola.";
    } else if (scuolaValue.scuola === SCUOLA_ALTRO) {
      next.scuola = "Per ora la registrazione richiede una scuola presente nell'elenco. Scrivici da Contatti se non la trovi.";
    }

    if (!dichiarazione) next.dichiarazione = "Devi confermare di essere un docente o operatore scolastico.";
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
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          ruolo: "docente",
          nome: nome.trim(),
          cognome: cognome.trim(),
          telefono: telefono.trim() || null,
          data_nascita: dataNascita,
          school_code: scuolaValue.scuola,
          materia,
          is_referente_orientamento: referenteOrientamento,
        },
      },
    });

    setCaricamento(false);

    if (error) {
      setErroreGenerale(
        error.message.includes("already registered") || error.message.includes("already exists")
          ? "Esiste già un profilo con questa email. Prova ad accedere."
          : "Non siamo riusciti a completare la registrazione. Riprova.",
      );
      return;
    }

    setInviato(true);
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
          Controlla la tua email
        </h2>
        <p className="mt-2 text-sm text-kireo-muted">
          Ti abbiamo inviato un link di conferma: aprilo per attivare il tuo profilo KIREO.
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
        <label htmlFor="nome" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          autoComplete="given-name"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            clearError("nome");
          }}
          aria-invalid={Boolean(errors.nome)}
          aria-describedby={errors.nome ? "nome-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.nome))}`}
          placeholder="Il tuo nome"
        />
        {errors.nome && (
          <p id="nome-error" className="mt-1.5 text-sm text-red-400">
            {errors.nome}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="cognome" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Cognome
        </label>
        <input
          id="cognome"
          name="cognome"
          type="text"
          autoComplete="family-name"
          value={cognome}
          onChange={(e) => {
            setCognome(e.target.value);
            clearError("cognome");
          }}
          aria-invalid={Boolean(errors.cognome)}
          aria-describedby={errors.cognome ? "cognome-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.cognome))}`}
          placeholder="Il tuo cognome"
        />
        {errors.cognome && (
          <p id="cognome-error" className="mt-1.5 text-sm text-red-400">
            {errors.cognome}
          </p>
        )}
      </div>

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
            clearError("email");
          }}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.email))}`}
          placeholder="nome@esempio.it"
        />
        {errors.email && (
          <p id="email-error" className="mt-1.5 text-sm text-red-400">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="telefono" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Telefono (facoltativo)
        </label>
        <input
          id="telefono"
          name="telefono"
          type="tel"
          autoComplete="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className={`${inputClass} ${fieldBorder(false)}`}
          placeholder="Il tuo numero di telefono"
        />
      </div>

      <div>
        <label htmlFor="dataNascita" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Data di nascita
        </label>
        <input
          id="dataNascita"
          name="dataNascita"
          type="date"
          autoComplete="bday"
          value={dataNascita}
          onChange={(e) => {
            setDataNascita(e.target.value);
            clearError("dataNascita");
          }}
          aria-invalid={Boolean(errors.dataNascita)}
          aria-describedby={errors.dataNascita ? "dataNascita-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.dataNascita))}`}
        />
        {errors.dataNascita && (
          <p id="dataNascita-error" className="mt-1.5 text-sm text-red-400">
            {errors.dataNascita}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError("password");
          }}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.password))}`}
          placeholder="Almeno 8 caratteri"
        />
        {errors.password && (
          <p id="password-error" className="mt-1.5 text-sm text-red-400">
            {errors.password}
          </p>
        )}
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
            clearError("confermaPassword");
          }}
          aria-invalid={Boolean(errors.confermaPassword)}
          aria-describedby={errors.confermaPassword ? "confermaPassword-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.confermaPassword))}`}
          placeholder="Ripeti la password"
        />
        {errors.confermaPassword && (
          <p id="confermaPassword-error" className="mt-1.5 text-sm text-red-400">
            {errors.confermaPassword}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="materia" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Materia di insegnamento
        </label>
        <select
          id="materia"
          name="materia"
          value={materia}
          onChange={(e) => {
            setMateria(e.target.value);
            clearError("materia");
          }}
          aria-invalid={Boolean(errors.materia)}
          aria-describedby={errors.materia ? "materia-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.materia))}`}
        >
          <option value="" disabled>
            Seleziona la materia
          </option>
          {MATERIE.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {errors.materia && (
          <p id="materia-error" className="mt-1.5 text-sm text-red-400">
            {errors.materia}
          </p>
        )}
      </div>

      <ScuolaCascadeFields value={scuolaValue} onChange={handleScuolaChange} errors={errors} />

      <div className="flex items-start gap-3">
        <input
          id="referenteOrientamento"
          name="referenteOrientamento"
          type="checkbox"
          checked={referenteOrientamento}
          onChange={(e) => setReferenteOrientamento(e.target.checked)}
          className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
        />
        <label htmlFor="referenteOrientamento" className="text-sm text-kireo-muted">
          Sono referente per l&apos;orientamento nella mia scuola
        </label>
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="dichiarazione"
            name="dichiarazione"
            type="checkbox"
            checked={dichiarazione}
            onChange={(e) => {
              setDichiarazione(e.target.checked);
              clearError("dichiarazione");
            }}
            aria-invalid={Boolean(errors.dichiarazione)}
            aria-describedby={errors.dichiarazione ? "dichiarazione-error" : undefined}
            className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
          />
          <label htmlFor="dichiarazione" className="text-sm text-kireo-muted">
            Dichiaro di essere un docente o operatore scolastico
          </label>
        </div>
        {errors.dichiarazione && (
          <p id="dichiarazione-error" className="mt-1.5 text-sm text-red-400">
            {errors.dichiarazione}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="privacy"
            name="privacy"
            type="checkbox"
            checked={privacy}
            onChange={(e) => {
              setPrivacy(e.target.checked);
              clearError("privacy");
            }}
            aria-invalid={Boolean(errors.privacy)}
            aria-describedby={errors.privacy ? "privacy-error" : undefined}
            className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
          />
          <label htmlFor="privacy" className="text-sm text-kireo-muted">
            Ho letto e accetto la{" "}
            <a href="/privacy" className="text-kireo-orange underline underline-offset-2">
              Privacy Policy
            </a>
          </label>
        </div>
        {errors.privacy && (
          <p id="privacy-error" className="mt-1.5 text-sm text-red-400">
            {errors.privacy}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={caricamento || etaSottoMinimo}>
        {caricamento ? "Creazione in corso…" : "Entra in KIREO"}
      </Button>
    </form>
  );
}
