"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { linkInvitoTutor } from "@/lib/scuola/linkInvito";
import { erroreInvitoTutor, TESTI_INVITO_TUTOR as T } from "@/lib/scuola/invitoTutor";

// L'invio email reale non è ancora attivo (nessun provider collegato):
// finché non lo sarà, il codice/link va condiviso a mano dal referente con
// il tutor (WhatsApp, di persona…) — vedi CLAUDE.md.
export default function InvitaTutorForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore(null);
    setLink(null);
    const erroreCampi = erroreInvitoTutor(nome, email);
    if (erroreCampi) {
      setErrore(T[erroreCampi]);
      return;
    }

    setInviando(true);
    try {
      const supabase = createClient();
      const { data: codice, error } = await supabase.rpc("crea_invito_tutor", { p_nome: nome.trim(), p_email: email.trim() || null });
      if (error || !codice) {
        if (error) console.error("[scuola] crea_invito_tutor:", descriviErrore(error));
        // Il database ripete i controlli del modulo (20261201120000): se uno
        // scatta lì, si dice quale, non «riprova».
        const m = error?.message ?? "";
        setErrore(
          m.includes("email_non_valida") ? T.emailNonValida
          : m.includes("nome_mancante") ? T.nomeMancante
          : m.includes("nome_troppo_lungo") ? T.nomeLungo
          : "Non è stato possibile creare l'invito. Riprova.",
        );
        return;
      }
      setLink(linkInvitoTutor(window.location.origin, codice));
      setNome("");
      setEmail("");
      router.refresh();
    } finally {
      setInviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Invita un tutor</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        L&apos;invio email non è ancora attivo: dopo aver creato l&apos;invito, condividi tu il link con il tutor.
      </p>
      {/* Uno sotto l'altro, non affiancati: affiancati si leggevano «Nome | Cognome» (28/10). */}
      <form onSubmit={handleSubmit} noValidate className="mt-4 flex max-w-md flex-col gap-4">
        <div>
          <label htmlFor="nomeTutor" className="mb-1.5 block text-sm font-medium text-kireo-light">
            {T.etichettaNome}
          </label>
          <input id="nomeTutor" value={nome} onChange={(e) => setNome(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`} />
        </div>
        <div>
          <label htmlFor="emailTutor" className="mb-1.5 block text-sm font-medium text-kireo-light">
            {T.etichettaEmail}
          </label>
          <input
            id="emailTutor"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby="notaEmailTutor"
            className={`${inputClass} ${fieldBorder(false)}`}
          />
          <p id="notaEmailTutor" className="mt-1.5 text-xs text-kireo-muted">
            {T.notaEmail}
          </p>
        </div>
        <div>
          <Button type="submit" variant="primary" disabled={inviando}>
            {inviando ? "Creazione…" : "Genera invito"}
          </Button>
        </div>
      </form>
      {errore && <p className="mt-3 text-sm text-red-400">{errore}</p>}
      {link && (
        <div className="mt-4 rounded-lg border border-kireo-green/40 bg-kireo-green/10 p-4">
          <p className="text-sm text-kireo-light">Invito creato. Condividi questo link con il tutor:</p>
          <p className="mt-2 break-all font-mono text-sm text-kireo-green-light">{link}</p>
        </div>
      )}
    </div>
  );
}
