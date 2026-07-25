"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";

// Form condiviso dalle due landing del funnel scuole (/dirigenti,
// /scuole): stessi campi, differenziati solo per origine (usata dal
// server per il messaggio di conferma e la coda admin) e per le opzioni
// del select ruolo. Insert + invio email avvengono lato server
// (app/api/richiesta-contatto/route.ts): la chiave Brevo non deve mai
// arrivare al client.
export default function RichiestaContattoForm({
  origine,
  ruoliOpzioni,
  etichettaBottone,
}: {
  origine: "dirigenti" | "scuole";
  ruoliOpzioni: string[];
  etichettaBottone: string;
}) {
  const [nome, setNome] = useState("");
  const [ruolo, setRuolo] = useState("");
  const [istituto, setIstituto] = useState("");
  const [codiceMeccanografico, setCodiceMeccanografico] = useState("");
  const [email, setEmail] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [privacy, setPrivacy] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
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
    if (!nome.trim()) next.nome = "Inserisci il tuo nome.";
    if (!ruolo) next.ruolo = "Seleziona il tuo ruolo.";
    if (!istituto.trim()) next.istituto = "Inserisci il nome dell'istituto.";
    if (!email.trim()) {
      next.email = "Inserisci un'email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Inserisci un indirizzo email valido.";
    }
    if (!messaggio.trim()) next.messaggio = "Scrivi un breve messaggio.";
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
      const risposta = await fetch("/api/richiesta-contatto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origine,
          nome: nome.trim(),
          ruolo,
          istituto: istituto.trim(),
          codiceMeccanografico: codiceMeccanografico.trim() || null,
          email: email.trim(),
          messaggio: messaggio.trim(),
        }),
      });

      if (!risposta.ok) {
        const dati = await risposta.json().catch(() => null);
        setErroreGenerale(dati?.errore ?? "Qualcosa è andato storto. Riprova tra qualche istante.");
        return;
      }

      setInviato(true);
    } catch {
      setErroreGenerale("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setCaricamento(false);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
          Richiesta inviata
        </h3>
        <p className="mt-2 text-sm text-kireo-muted">
          Grazie! Ti risponderemo entro 24 ore. Controlla anche la posta indesiderata.
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
          Nome e cognome
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
        <label htmlFor="ruolo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Ruolo
        </label>
        <select
          id="ruolo"
          value={ruolo}
          onChange={(e) => {
            setRuolo(e.target.value);
            clearError("ruolo");
          }}
          aria-invalid={Boolean(errors.ruolo)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.ruolo))}`}
        >
          <option value="" disabled>
            Seleziona il tuo ruolo
          </option>
          {ruoliOpzioni.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {errors.ruolo && <p className="mt-1.5 text-sm text-red-400">{errors.ruolo}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="istituto" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Istituto
          </label>
          <input
            id="istituto"
            value={istituto}
            onChange={(e) => {
              setIstituto(e.target.value);
              clearError("istituto");
            }}
            aria-invalid={Boolean(errors.istituto)}
            className={`${inputClass} ${fieldBorder(Boolean(errors.istituto))}`}
            placeholder="Nome dell'istituto"
          />
          {errors.istituto && <p className="mt-1.5 text-sm text-red-400">{errors.istituto}</p>}
        </div>
        <div>
          <label htmlFor="codiceMeccanografico" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Codice meccanografico (facoltativo)
          </label>
          <input
            id="codiceMeccanografico"
            value={codiceMeccanografico}
            onChange={(e) => setCodiceMeccanografico(e.target.value)}
            className={`${inputClass} ${fieldBorder(false)}`}
            placeholder="Es. MIXX00000X"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Email
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
          placeholder="nome@scuola.edu.it"
        />
        {errors.email && <p className="mt-1.5 text-sm text-red-400">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="messaggio" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Messaggio
        </label>
        <textarea
          id="messaggio"
          value={messaggio}
          onChange={(e) => {
            setMessaggio(e.target.value);
            clearError("messaggio");
          }}
          rows={3}
          aria-invalid={Boolean(errors.messaggio)}
          className={`${inputClass} ${fieldBorder(Boolean(errors.messaggio))}`}
          placeholder="Scrivi qui la tua richiesta..."
        />
        {errors.messaggio && <p className="mt-1.5 text-sm text-red-400">{errors.messaggio}</p>}
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
            .
          </label>
        </div>
        {errors.privacy && <p className="mt-1.5 text-sm text-red-400">{errors.privacy}</p>}
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={caricamento}>
        {caricamento ? "Invio in corso…" : etichettaBottone}
      </Button>
    </form>
  );
}
