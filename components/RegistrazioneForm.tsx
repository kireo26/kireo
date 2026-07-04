"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { PROVINCE_ITALIANE } from "@/lib/province";

type Indirizzo = "Liceo" | "Tecnico" | "Professionale";
type Scuola = { codice: string; nome: string };
type ScuoleData = Record<string, Partial<Record<Indirizzo, Scuola[]>>>;

const CLASSI = [
  { value: "3", label: "3° anno" },
  { value: "4", label: "4° anno" },
  { value: "5", label: "5° anno" },
];

const INDIRIZZI: { value: Indirizzo; label: string }[] = [
  { value: "Liceo", label: "Liceo" },
  { value: "Tecnico", label: "Istituto Tecnico" },
  { value: "Professionale", label: "Istituto Professionale" },
];

const SCUOLA_ALTRO = "__altro";

const inputClass =
  "w-full rounded-lg border bg-kireo-dark px-4 py-3 text-base text-kireo-light placeholder:text-kireo-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function fieldBorder(hasError: boolean) {
  return hasError ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-kireo-green";
}

export default function RegistrazioneForm() {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [classe, setClasse] = useState("");
  const [provincia, setProvincia] = useState("");
  const [indirizzo, setIndirizzo] = useState<Indirizzo | "">("");
  const [scuola, setScuola] = useState("");
  const [scuolaAltro, setScuolaAltro] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [newsletter, setNewsletter] = useState(false);

  const [scuoleData, setScuoleData] = useState<ScuoleData | null>(null);
  const [caricamentoScuole, setCaricamentoScuole] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inviato, setInviato] = useState(false);

  useEffect(() => {
    fetch("/data/scuole-secondarie-superiori.json")
      .then((res) => res.json())
      .then((data: ScuoleData) => setScuoleData(data))
      .catch(() => setScuoleData({}))
      .finally(() => setCaricamentoScuole(false));
  }, []);

  const scuoleDisponibili = useMemo(() => {
    if (!provincia || !indirizzo || !scuoleData) return [];
    return scuoleData[provincia]?.[indirizzo] ?? [];
  }, [provincia, indirizzo, scuoleData]);

  const scuolaSelectAbilitata = Boolean(provincia && indirizzo && !caricamentoScuole);

  function handleProvinciaChange(value: string) {
    setProvincia(value);
    setScuola("");
    setScuolaAltro("");
  }

  function handleIndirizzoChange(value: Indirizzo | "") {
    setIndirizzo(value);
    setScuola("");
    setScuolaAltro("");
  }

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

    if (!nome.trim()) next.nome = "Inserisci il tuo nome.";
    if (!cognome.trim()) next.cognome = "Inserisci il tuo cognome.";

    if (!email.trim()) {
      next.email = "Inserisci la tua email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Inserisci un indirizzo email valido.";
    }

    if (!classe) next.classe = "Seleziona la classe che frequenti.";
    if (!provincia) next.provincia = "Seleziona la provincia della tua scuola.";
    if (!indirizzo) next.indirizzo = "Seleziona l'indirizzo della tua scuola.";

    if (!scuola) {
      next.scuola = "Seleziona la tua scuola.";
    } else if (scuola === SCUOLA_ALTRO && !scuolaAltro.trim()) {
      next.scuolaAltro = "Scrivi il nome della tua scuola.";
    }

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
          Profilo creato!
        </h2>
        <p className="mt-2 text-sm text-kireo-muted">
          Ti abbiamo inviato una email di benvenuto.
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
        <label htmlFor="classe" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Classe frequentata
        </label>
        <select
          id="classe"
          name="classe"
          value={classe}
          onChange={(e) => {
            setClasse(e.target.value);
            clearError("classe");
          }}
          aria-invalid={Boolean(errors.classe)}
          aria-describedby={errors.classe ? "classe-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.classe))}`}
        >
          <option value="" disabled>
            Seleziona la classe
          </option>
          {CLASSI.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {errors.classe && (
          <p id="classe-error" className="mt-1.5 text-sm text-red-400">
            {errors.classe}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="provincia" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Provincia della scuola
        </label>
        <select
          id="provincia"
          name="provincia"
          value={provincia}
          onChange={(e) => {
            handleProvinciaChange(e.target.value);
            clearError("provincia");
          }}
          aria-invalid={Boolean(errors.provincia)}
          aria-describedby={errors.provincia ? "provincia-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.provincia))}`}
        >
          <option value="" disabled>
            Seleziona la provincia
          </option>
          {PROVINCE_ITALIANE.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {errors.provincia && (
          <p id="provincia-error" className="mt-1.5 text-sm text-red-400">
            {errors.provincia}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="indirizzo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Indirizzo della scuola
        </label>
        <select
          id="indirizzo"
          name="indirizzo"
          value={indirizzo}
          onChange={(e) => {
            handleIndirizzoChange(e.target.value as Indirizzo);
            clearError("indirizzo");
          }}
          aria-invalid={Boolean(errors.indirizzo)}
          aria-describedby={errors.indirizzo ? "indirizzo-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.indirizzo))}`}
        >
          <option value="" disabled>
            Seleziona l&apos;indirizzo
          </option>
          {INDIRIZZI.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
        {errors.indirizzo && (
          <p id="indirizzo-error" className="mt-1.5 text-sm text-red-400">
            {errors.indirizzo}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="scuola" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Nome della scuola
        </label>
        <select
          id="scuola"
          name="scuola"
          value={scuola}
          disabled={!scuolaSelectAbilitata}
          onChange={(e) => {
            setScuola(e.target.value);
            clearError("scuola");
          }}
          aria-invalid={Boolean(errors.scuola)}
          aria-describedby={errors.scuola ? "scuola-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.scuola))}`}
        >
          <option value="" disabled>
            {!provincia || !indirizzo
              ? "Seleziona prima provincia e indirizzo"
              : caricamentoScuole
                ? "Caricamento elenco scuole…"
                : "Seleziona la scuola"}
          </option>
          {scuoleDisponibili.map((s) => (
            <option key={s.codice} value={s.codice}>
              {s.nome}
            </option>
          ))}
          {scuolaSelectAbilitata && <option value={SCUOLA_ALTRO}>La mia scuola non è in elenco</option>}
        </select>
        {errors.scuola && (
          <p id="scuola-error" className="mt-1.5 text-sm text-red-400">
            {errors.scuola}
          </p>
        )}

        {scuola === SCUOLA_ALTRO && (
          <div className="mt-3">
            <label htmlFor="scuolaAltro" className="mb-1.5 block text-sm font-medium text-kireo-light">
              Nome della tua scuola
            </label>
            <input
              id="scuolaAltro"
              name="scuolaAltro"
              type="text"
              value={scuolaAltro}
              onChange={(e) => {
                setScuolaAltro(e.target.value);
                clearError("scuolaAltro");
              }}
              aria-invalid={Boolean(errors.scuolaAltro)}
              aria-describedby={errors.scuolaAltro ? "scuolaAltro-error" : undefined}
              className={`${inputClass} ${fieldBorder(Boolean(errors.scuolaAltro))}`}
              placeholder="Scrivi il nome della scuola"
            />
            {errors.scuolaAltro && (
              <p id="scuolaAltro-error" className="mt-1.5 text-sm text-red-400">
                {errors.scuolaAltro}
              </p>
            )}
          </div>
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

      <div className="flex items-start gap-3">
        <input
          id="newsletter"
          name="newsletter"
          type="checkbox"
          checked={newsletter}
          onChange={(e) => setNewsletter(e.target.checked)}
          className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
        />
        <label htmlFor="newsletter" className="text-sm text-kireo-muted">
          Voglio ricevere aggiornamenti sulle attività di orientamento
        </label>
      </div>

      <Button type="submit" variant="primary" className="w-full">
        Crea il mio profilo
      </Button>
    </form>
  );
}
