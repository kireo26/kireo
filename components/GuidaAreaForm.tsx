"use client";

import { useState } from "react";
import { Button } from "./Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { registraAttivita } from "@/lib/app/activityLog";

const CLASSI = [
  { value: "3", label: "3° anno" },
  { value: "4", label: "4° anno" },
  { value: "5", label: "5° anno" },
];

export default function GuidaAreaForm({ areaNome, areaSlug }: { areaNome: string; areaSlug: string }) {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [classe, setClasse] = useState("");
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
    if (!privacy) next.privacy = "Devi accettare la privacy policy per continuare.";

    return next;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setInviato(true);

    // Download immediato: un segnaposto chiaramente marcato come tale, non
    // ancora la guida reale (vedi report della sessione). Content-Disposition
    // attachment fa scaricare senza lasciare la pagina.
    window.location.href = `/api/guida/${areaSlug}`;

    // Follow-up via email: predisposto ma non ancora collegato a un invio
    // reale (nessun provider email configurato, vedi report). Non blocca
    // né rallenta la conferma mostrata allo studente.
    fetch("/api/guida-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cognome, email: email.trim(), areaSlug }),
    }).catch(() => {});

    registraAttivita(areaSlug, "download_guida");
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
          Il download è partito
        </h3>
        <p className="mt-2 text-sm text-kireo-muted">
          Controlla i download del tuo browser. Ti scriveremo anche via email con il link per riaprirla quando vuoi.
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
        Scarica la guida gratuita
      </Button>
      <p className="text-center text-xs text-kireo-muted">Guida di orientamento — {areaNome}</p>
    </form>
  );
}
