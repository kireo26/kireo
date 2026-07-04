"use client";

import { useState } from "react";
import { Button } from "./Button";

export default function ContactForm() {
  const [inviato, setInviato] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviato(true);
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
          Messaggio inviato!
        </h3>
        <p className="mt-2 text-sm text-kireo-muted">
          Grazie per averci contattato. Ti risponderemo il prima possibile.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-8">
      <div>
        <label htmlFor="nome" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Nome e cognome
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-lg border border-white/10 bg-kireo-dark px-4 py-2.5 text-sm text-kireo-light placeholder:text-kireo-muted focus:border-kireo-green focus:outline-none"
          placeholder="Il tuo nome"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-white/10 bg-kireo-dark px-4 py-2.5 text-sm text-kireo-light placeholder:text-kireo-muted focus:border-kireo-green focus:outline-none"
          placeholder="nome@esempio.it"
        />
      </div>

      <div>
        <label htmlFor="ruolo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Sei…
        </label>
        <select
          id="ruolo"
          name="ruolo"
          required
          defaultValue=""
          className="w-full rounded-lg border border-white/10 bg-kireo-dark px-4 py-2.5 text-sm text-kireo-light focus:border-kireo-green focus:outline-none"
        >
          <option value="" disabled>
            Seleziona il tuo ruolo
          </option>
          <option value="studente">Uno studente</option>
          <option value="istituzione">Un&apos;istituzione formativa</option>
          <option value="docente">Un docente</option>
          <option value="altro">Altro</option>
        </select>
      </div>

      <div>
        <label htmlFor="messaggio" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Messaggio
        </label>
        <textarea
          id="messaggio"
          name="messaggio"
          required
          rows={5}
          className="w-full rounded-lg border border-white/10 bg-kireo-dark px-4 py-2.5 text-sm text-kireo-light placeholder:text-kireo-muted focus:border-kireo-green focus:outline-none"
          placeholder="Scrivi qui la tua richiesta..."
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="privacy"
          name="privacy"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-white/20 bg-kireo-dark accent-kireo-green"
        />
        <label htmlFor="privacy" className="text-sm text-kireo-muted">
          Ho letto e accetto l&apos;
          <a href="/privacy" className="text-kireo-orange underline underline-offset-2">
            informativa sulla privacy
          </a>
          .
        </label>
      </div>

      <Button type="submit" variant="primary" className="w-full sm:w-auto">
        Invia messaggio
      </Button>
    </form>
  );
}
