"use client";

import { useState } from "react";
import { Button } from "./Button";
import ScuolaCascadeFields, { SCUOLA_ALTRO, type ScuolaCascadeValue } from "./ScuolaCascadeFields";
import { inputClass, fieldBorder } from "@/lib/formStyles";

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
      next.email = "Inserisci la tua email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Inserisci un indirizzo email valido.";
    }

    if (!materia) next.materia = "Seleziona la tua materia di insegnamento.";
    if (!scuolaValue.provincia) next.provincia = "Seleziona la provincia della scuola.";
    if (!scuolaValue.indirizzo) next.indirizzo = "Seleziona il tipo di istituto.";

    if (!scuolaValue.scuola) {
      next.scuola = "Seleziona la scuola.";
    } else if (scuolaValue.scuola === SCUOLA_ALTRO && !scuolaValue.scuolaAltro.trim()) {
      next.scuolaAltro = "Scrivi il nome della scuola.";
    }

    if (!dichiarazione) next.dichiarazione = "Devi confermare di essere un docente o operatore scolastico.";
    if (!privacy) next.privacy = "Devi accettare la privacy policy per continuare.";

    return next;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length === 0) {
      setInviato(true);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
          Benvenuto in KIREO!
        </h2>
        <p className="mt-2 text-sm text-kireo-muted">
          Ti abbiamo inviato una email con i prossimi webinar in calendario.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
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

      <Button type="submit" variant="primary" className="w-full">
        Entra in KIREO
      </Button>
    </form>
  );
}
