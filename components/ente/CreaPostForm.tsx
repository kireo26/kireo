"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";

const MAX_CORPO = 2000;
const MAX_IMMAGINE_MB = 5;
const MAX_POST_IN_REVISIONE = 3;
const REGEX_EMBED = /^https:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i;

// tipo=link_social riservato ai piani a pagamento (gating anche
// server-side, vedi post_enti_insert_propria): qui l'opzione è nascosta
// invece di mostrata-e-poi-respinta, con un nudge esplicito.
export default function CreaPostForm({
  istituzioneId,
  postInRevisione,
  pianoAPagamento,
}: {
  istituzioneId: string;
  postInRevisione: number;
  pianoAPagamento: boolean;
}) {
  const router = useRouter();
  const fairUseRaggiunto = postInRevisione >= MAX_POST_IN_REVISIONE;
  const [tipo, setTipo] = useState<"testo" | "immagine" | "link_social">("testo");
  const [corpo, setCorpo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [inviando, setInviando] = useState(false);
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [inviato, setInviato] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!corpo.trim()) next.corpo = "Scrivi il testo del post.";
    else if (corpo.length > MAX_CORPO) next.corpo = `Massimo ${MAX_CORPO} caratteri.`;
    if (tipo === "immagine" && !file) next.file = "Carica un'immagine.";
    if (tipo === "link_social") {
      if (!embedUrl.trim()) next.embedUrl = "Incolla il link del post Instagram o TikTok.";
      else if (!REGEX_EMBED.test(embedUrl.trim())) next.embedUrl = "Deve essere un link Instagram o TikTok.";
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroreGenerale(null);
    if (fairUseRaggiunto) {
      setErroreGenerale("Hai già 3 post in attesa di revisione: attendi l'esito prima di proporne altri.");
      return;
    }
    const validazione = validate();
    setErrori(validazione);
    if (Object.keys(validazione).length > 0) return;

    setInviando(true);
    try {
      const supabase = createClient();
      let immagineUrl: string | null = null;

      if (tipo === "immagine" && file) {
        const estensione = file.name.split(".").pop() ?? "jpg";
        const percorso = `${istituzioneId}/post-${Date.now()}.${estensione}`;
        const { error: erroreUpload } = await supabase.storage.from("post-enti-media").upload(percorso, file);
        if (erroreUpload) {
          setErroreGenerale("Non è stato possibile caricare l'immagine. Riprova.");
          return;
        }
        const { data } = supabase.storage.from("post-enti-media").getPublicUrl(percorso);
        immagineUrl = data.publicUrl;
      }

      const { error } = await supabase.from("post_enti").insert({
        istituzione_id: istituzioneId,
        tipo,
        corpo: corpo.trim(),
        immagine_url: tipo === "immagine" ? immagineUrl : null,
        embed_url: tipo === "link_social" ? embedUrl.trim() : null,
      });

      if (error) {
        if (error.message?.includes("troppi_post_in_revisione")) {
          setErroreGenerale("Hai già 3 post in attesa di revisione: attendi l'esito prima di proporne altri.");
        } else {
          setErroreGenerale("Non è stato possibile inviare il post. Riprova più tardi.");
        }
        return;
      }

      setInviato(true);
      router.refresh();
    } catch {
      setErroreGenerale("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setInviando(false);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Post inviato in approvazione</h3>
        <p className="mt-2 text-sm text-kireo-muted">KIREO lo revisiona prima che compaia nel feed degli studenti.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>}
      {fairUseRaggiunto && (
        <div className="rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-sm text-kireo-orange">
          Hai già 3 post in attesa di revisione. Attendi l&apos;esito di KIREO su almeno uno di questi prima di proporne altri.
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-kireo-light">Tipo di post</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["testo", "immagine", "link_social"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => pianoAPagamento || t !== "link_social" ? setTipo(t) : null}
              disabled={t === "link_social" && !pianoAPagamento}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                tipo === t ? "border-kireo-green bg-kireo-green/10 text-kireo-light" : "border-white/10 text-kireo-light/80"
              }`}
            >
              {t === "testo" ? "Testo" : t === "immagine" ? "Immagine" : "Link social"}
            </button>
          ))}
        </div>
        {!pianoAPagamento && (
          <p className="mt-2 text-xs text-kireo-muted">
            I post con embed Instagram/TikTok sono riservati ai piani a pagamento. Scopri di più su{" "}
            <a href="/ente/piano" className="text-kireo-orange underline underline-offset-2">
              il tuo piano
            </a>
            .
          </p>
        )}
      </div>

      <div>
        <label htmlFor="corpo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Testo del post
        </label>
        <textarea
          id="corpo"
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={4}
          maxLength={MAX_CORPO}
          aria-invalid={Boolean(errori.corpo)}
          className={`${inputClass} ${fieldBorder(Boolean(errori.corpo))}`}
        />
        <p className="mt-1 text-right text-xs text-kireo-muted">{corpo.length}/{MAX_CORPO}</p>
        {errori.corpo && <p className="mt-1.5 text-sm text-red-400">{errori.corpo}</p>}
      </div>

      {tipo === "immagine" && (
        <div>
          <label htmlFor="immagine" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Immagine (max {MAX_IMMAGINE_MB} MB)
          </label>
          <input
            id="immagine"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.file))}`}
          />
          {errori.file && <p className="mt-1.5 text-sm text-red-400">{errori.file}</p>}
        </div>
      )}

      {tipo === "link_social" && (
        <div>
          <label htmlFor="embedUrl" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Link del post Instagram o TikTok
          </label>
          <input
            id="embedUrl"
            type="url"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/..."
            aria-invalid={Boolean(errori.embedUrl)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.embedUrl))}`}
          />
          {errori.embedUrl && <p className="mt-1.5 text-sm text-red-400">{errori.embedUrl}</p>}
          <p className="mt-1.5 text-xs text-kireo-muted">Nel feed lo studente vede un&apos;anteprima statica: l&apos;embed si carica solo al click.</p>
        </div>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={inviando || fairUseRaggiunto}>
        {fairUseRaggiunto ? "3 post già in revisione" : inviando ? "Invio in corso…" : "Invia in approvazione"}
      </Button>
      <p className="text-center text-xs text-kireo-muted">
        Ricorda il{" "}
        <a href="/ente/regolamento" target="_blank" className="text-kireo-orange underline underline-offset-2">
          regolamento enti
        </a>
        .
      </p>
    </form>
  );
}
