"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { TESTI_POST } from "@/lib/ente/post";
import { MAX_GUIDA_MB, TIPO_GUIDA } from "@/lib/ente/media";
import {
  MAX_RIGA_LINK,
  MAX_TITOLO_LINK,
  REGEX_LINK_SOCIALE,
  nomeAllegato,
  percorsoAllegato,
} from "@/lib/post/contenuti";
import { descriviErrore } from "@/lib/erroreSupabase";

const MAX_CORPO = 2000;
const MAX_IMMAGINE_MB = 5;

type TipoPost = "testo" | "immagine" | "file" | "link_social";
const TIPI: { tipo: TipoPost; etichetta: string }[] = [
  { tipo: "testo", etichetta: "Testo" },
  { tipo: "immagine", etichetta: "Immagine" },
  { tipo: "file", etichetta: "File" },
  { tipo: "link_social", etichetta: "Link social" },
];

// Dal 30/10 (20261119110000) i quattro tipi sono di tutti i piani (Mario: «perché
// solo chi paga?»). Il link social è una SCHEDA che compila l'ente — titolo,
// una riga, un'immagine, il link — e nel feed non si carica mai la pagina della
// piattaforma: vedi `lib/post/contenuti.ts`. Il file è un PDF nello spazio
// dell'ente; lo studente lo scarica da una route che scrive la traccia prima.
// Il post si pubblica subito (29/10): il tetto è di 3 nelle ultime 24 ore, e
// la pagina passa `avvisoTetto` con l'ora da cui si potrà di nuovo.
export default function CreaPostForm({
  istituzioneId,
  avvisoTetto,
  pianoAPagamento,
}: {
  istituzioneId: string;
  avvisoTetto: string | null;
  pianoAPagamento: boolean;
}) {
  const router = useRouter();
  const fairUseRaggiunto = avvisoTetto !== null;
  const [tipo, setTipo] = useState<TipoPost>("testo");
  const [corpo, setCorpo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [allegato, setAllegato] = useState<File | null>(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [linkTitolo, setLinkTitolo] = useState("");
  const [linkRiga, setLinkRiga] = useState("");
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [inviando, setInviando] = useState(false);
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [inviato, setInviato] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!corpo.trim()) next.corpo = "Scrivi il testo del post.";
    else if (corpo.length > MAX_CORPO) next.corpo = `Massimo ${MAX_CORPO} caratteri.`;
    if ((tipo === "immagine" || tipo === "link_social") && !file) next.file = "Carica un'immagine.";
    else if (file && file.size > MAX_IMMAGINE_MB * 1024 * 1024) next.file = `L'immagine supera i ${MAX_IMMAGINE_MB} MB.`;
    if (tipo === "link_social") {
      if (!embedUrl.trim()) next.embedUrl = "Incolla il link del post su Instagram, Facebook o TikTok.";
      else if (!REGEX_LINK_SOCIALE.test(embedUrl.trim())) next.embedUrl = "Deve essere un link di Instagram, Facebook o TikTok, che comincia con https://.";
      if (!linkTitolo.trim()) next.linkTitolo = "Scrivi il titolo della scheda.";
      if (!linkRiga.trim()) next.linkRiga = "Scrivi una riga che dica cosa c'è nel post.";
    }
    if (tipo === "file") {
      if (!allegato) next.allegato = "Carica il PDF.";
      else if (allegato.type !== TIPO_GUIDA) next.allegato = "Il file deve essere un PDF.";
      else if (allegato.size > MAX_GUIDA_MB * 1024 * 1024) next.allegato = `Il file supera i ${MAX_GUIDA_MB} MB.`;
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroreGenerale(null);
    if (fairUseRaggiunto) {
      setErroreGenerale(avvisoTetto);
      return;
    }
    const validazione = validate();
    setErrori(validazione);
    if (Object.keys(validazione).length > 0) return;

    setInviando(true);
    try {
      const supabase = createClient();
      let immagineUrl: string | null = null;

      if ((tipo === "immagine" || tipo === "link_social") && file) {
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

      let allegatoPercorso: string | null = null;
      if (tipo === "file" && allegato) {
        allegatoPercorso = percorsoAllegato(istituzioneId, Date.now());
        const { error: erroreAllegato } = await supabase.storage
          .from("istituzioni-media")
          .upload(allegatoPercorso, allegato, { contentType: TIPO_GUIDA });
        if (erroreAllegato) {
          console.error("[ente] caricamento dell'allegato di un post:", descriviErrore(erroreAllegato));
          setErroreGenerale("Non è stato possibile caricare il file. Riprova.");
          return;
        }
      }

      const { error } = await supabase.from("post_enti").insert({
        istituzione_id: istituzioneId,
        tipo,
        corpo: corpo.trim(),
        immagine_url: tipo === "immagine" || tipo === "link_social" ? immagineUrl : null,
        embed_url: tipo === "link_social" ? embedUrl.trim() : null,
        link_titolo: tipo === "link_social" ? linkTitolo.trim() : null,
        link_riga: tipo === "link_social" ? linkRiga.trim() : null,
        allegato_percorso: tipo === "file" ? allegatoPercorso : null,
        allegato_nome: tipo === "file" && allegato ? nomeAllegato(allegato.name) : null,
      });

      if (error) {
        if (error.message?.includes("troppi_post_nelle_24_ore")) {
          setErroreGenerale(TESTI_POST.tettoDalDatabase);
          router.refresh();
        } else if (error.message?.includes("scheda_link_incompleta")) {
          setErroreGenerale(TESTI_POST.schedaIncompleta);
        } else {
          console.error("[ente] pubblicazione di un post:", descriviErrore(error));
          setErroreGenerale("Non è stato possibile pubblicare il post. Riprova più tardi.");
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
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{TESTI_POST.pubblicato}</h3>
        <p className="mt-2 text-sm text-kireo-muted">{pianoAPagamento ? TESTI_POST.pubblicatoConNotifica : TESTI_POST.pubblicatoDettaglio}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>}
      {fairUseRaggiunto && (
        <div className="rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-sm text-kireo-orange">
          {avvisoTetto}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-kireo-light">Tipo di post</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPI.map((t) => (
            <button
              key={t.tipo}
              type="button"
              onClick={() => setTipo(t.tipo)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                tipo === t.tipo ? "border-kireo-green bg-kireo-green/10 text-kireo-light" : "border-white/10 text-kireo-light/80"
              }`}
            >
              {t.etichetta}
            </button>
          ))}
        </div>
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

      {tipo === "link_social" && (
        <>
          <div>
            <label htmlFor="embedUrl" className="mb-1.5 block text-sm font-medium text-kireo-light">
              Link del post su Instagram, Facebook o TikTok
            </label>
            <input
              id="embedUrl"
              type="text"
              inputMode="url"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/..."
              aria-invalid={Boolean(errori.embedUrl)}
              className={`${inputClass} ${fieldBorder(Boolean(errori.embedUrl))}`}
            />
            {errori.embedUrl && <p className="mt-1.5 text-sm text-red-400">{errori.embedUrl}</p>}
          </div>
          <div>
            <label htmlFor="linkTitolo" className="mb-1.5 block text-sm font-medium text-kireo-light">
              Titolo della scheda
            </label>
            <input
              id="linkTitolo"
              type="text"
              value={linkTitolo}
              onChange={(e) => setLinkTitolo(e.target.value)}
              maxLength={MAX_TITOLO_LINK}
              aria-invalid={Boolean(errori.linkTitolo)}
              className={`${inputClass} ${fieldBorder(Boolean(errori.linkTitolo))}`}
            />
            {errori.linkTitolo && <p className="mt-1.5 text-sm text-red-400">{errori.linkTitolo}</p>}
          </div>
          <div>
            <label htmlFor="linkRiga" className="mb-1.5 block text-sm font-medium text-kireo-light">
              Una riga su cosa c&apos;è nel post
            </label>
            <input
              id="linkRiga"
              type="text"
              value={linkRiga}
              onChange={(e) => setLinkRiga(e.target.value)}
              maxLength={MAX_RIGA_LINK}
              aria-invalid={Boolean(errori.linkRiga)}
              className={`${inputClass} ${fieldBorder(Boolean(errori.linkRiga))}`}
            />
            {errori.linkRiga && <p className="mt-1.5 text-sm text-red-400">{errori.linkRiga}</p>}
          </div>
        </>
      )}

      {(tipo === "immagine" || tipo === "link_social") && (
        <div>
          <label htmlFor="immagine" className="mb-1.5 block text-sm font-medium text-kireo-light">
            {tipo === "link_social" ? "Immagine della scheda" : "Immagine"} (max {MAX_IMMAGINE_MB} MB)
          </label>
          <input
            id="immagine"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.file))}`}
          />
          {errori.file && <p className="mt-1.5 text-sm text-red-400">{errori.file}</p>}
        </div>
      )}

      {tipo === "link_social" && <p className="text-xs text-kireo-muted">{TESTI_POST.notaScheda}</p>}

      {tipo === "file" && (
        <div>
          <label htmlFor="allegato" className="mb-1.5 block text-sm font-medium text-kireo-light">
            File PDF (max {MAX_GUIDA_MB} MB)
          </label>
          <input
            id="allegato"
            type="file"
            accept="application/pdf"
            onChange={(e) => setAllegato(e.target.files?.[0] ?? null)}
            className={`${inputClass} ${fieldBorder(Boolean(errori.allegato))}`}
          />
          {errori.allegato && <p className="mt-1.5 text-sm text-red-400">{errori.allegato}</p>}
          <p className="mt-1.5 text-xs text-kireo-muted">{TESTI_POST.notaFile}</p>
        </div>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={inviando || fairUseRaggiunto}>
        {fairUseRaggiunto ? TESTI_POST.bottoneTetto : inviando ? "Pubblicazione…" : TESTI_POST.bottone}
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
