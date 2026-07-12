"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";

const CLASSI = [
  { value: "3", label: "3° anno" },
  { value: "4", label: "4° anno" },
  { value: "5", label: "5° anno" },
];

// Stesso pattern di GuidaAreaForm (download immediato + email di
// follow-up), ma la guida qui è reale (caricata dall'ente, non un
// segnaposto) e scrive recinto_enti invece di activity_log: il download
// non è legato a una delle 18 aree tematiche, quindi non ha senso
// forzarlo in quella tabella — recinto_enti è la traccia corretta per
// l'interesse verso un'istituzione.
export default function GuidaEnteForm({
  istituzioneId,
  istituzioneNome,
  pdfUrl,
}: {
  istituzioneId: string;
  istituzioneNome: string;
  pdfUrl: string;
}) {
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setInviato(true);
    window.location.href = pdfUrl;

    fetch("/api/guida-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cognome, email: email.trim(), istituzioneId }),
    }).catch(() => {});

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from("recinto_enti")
          .upsert(
            { student_id: session.user.id, istituzione_id: istituzioneId, origine: "guida" },
            { onConflict: "student_id,istituzione_id", ignoreDuplicates: true },
          );
      }
    } catch {
      // no-op: il download è già partito, non blocchiamo per la sola traccia
    }
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

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-kireo-light">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
          aria-invalid={Boolean(errors.email)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.email))}`}
          placeholder="nome@esempio.it"
        />
        {errors.email && <p className="mt-1.5 text-sm text-red-400">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="classe" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Classe frequentata
        </label>
        <select
          id="classe"
          value={classe}
          onChange={(e) => {
            setClasse(e.target.value);
            clearError("classe");
          }}
          aria-invalid={Boolean(errors.classe)}
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
        {errors.classe && <p className="mt-1.5 text-sm text-red-400">{errors.classe}</p>}
      </div>

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

      <Button type="submit" variant="primary" className="w-full">
        Scarica la guida di {istituzioneNome}
      </Button>
    </form>
  );
}
