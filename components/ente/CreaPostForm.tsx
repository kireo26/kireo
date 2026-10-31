"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { TESTI_POST } from "@/lib/ente/post";
import { MAX_GUIDA_MB, TIPO_GUIDA } from "@/lib/ente/media";
import { MAX_LINK_ESTERNO, normalizzaLinkEsterno, nomeAllegato, percorsoAllegato } from "@/lib/post/contenuti";
import { descriviErrore } from "@/lib/erroreSupabase";
import { getAreaBySlug } from "@/data/aree";
import { MAX_AREE_POST, TESTI_AREE_POST } from "@/lib/app/postArea";

const MAX_CORPO = 2000;
const MAX_IMMAGINE_MB = 5;

type TipoPost = "testo" | "immagine" | "file";
const TIPI: { tipo: TipoPost; etichetta: string }[] = [
  { tipo: "testo", etichetta: "Testo" },
  { tipo: "immagine", etichetta: "Immagine" },
  { tipo: "file", etichetta: "File" },
];

// Dal 30/10 i tipi sono di tutti i piani, e il tipo «link social» è uscito
// (20261120100000): ogni post può avere un LINK facoltativo — il sito, un post
// su Instagram, quello che l'ente vuole — e sotto il post lo studente trova un
// bottone che lo apre fuori da KIREO. L'etichetta del bottone la decide
// l'indirizzo, non l'ente: qui non c'è un campo per scriverla, apposta (vedi
// `lib/post/contenuti.ts`). Il file è un PDF nello spazio dell'ente; lo
// studente lo scarica da una route che scrive la traccia prima.
// Il post si pubblica subito (29/10): il tetto è di 3 nelle ultime 24 ore, e
// la pagina passa `avvisoTetto` con l'ora da cui si potrà di nuovo.
// ⚠️ Dopo «Pubblica» il modulo NON lascia il posto a una conferma (Mario,
// 30/10: «una conferma che occupa il posto del modulo è una porta che si
// chiude»). La pagina va a `?pubblicato=<id>`: il post nuovo è in cima alla
// lista con il bordo verde, la conferma sta sopra il modulo, e il modulo si
// rimonta vuoto perché la pagina gli dà una chiave nuova.
export default function CreaPostForm({
  istituzioneId,
  avvisoTetto,
  areeApprovate,
}: {
  istituzioneId: string;
  avvisoTetto: string | null;
  // Le aree che KIREO ha approvato per l'ente (31/10): le sole che un post può
  // portare. null = non lette, e il post si pubblica senza aree.
  areeApprovate: string[] | null;
}) {
  const router = useRouter();
  const fairUseRaggiunto = avvisoTetto !== null;
  const [tipo, setTipo] = useState<TipoPost>("testo");
  const [corpo, setCorpo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [allegato, setAllegato] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [inviando, setInviando] = useState(false);
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [alzatoAHttps, setAlzatoAHttps] = useState(false);
  const [aree, setAree] = useState<string[]>([]);

  function cambiaArea(slug: string) {
    setErrori((e) => {
      const resto = { ...e };
      delete resto.aree;
      return resto;
    });
    if (aree.includes(slug)) {
      setAree(aree.filter((a) => a !== slug));
      return;
    }
    if (aree.length >= MAX_AREE_POST) {
      setErrori((e) => ({ ...e, aree: TESTI_AREE_POST.troppe }));
      return;
    }
    setAree([...aree, slug]);
  }

  // Il link si sistema quando si lascia il campo o si preme «Pubblica», mai
  // mentre si scrive: il campo mostra l'indirizzo che si salverà.
  function sistemaLink(): string | null | false {
    const esito = normalizzaLinkEsterno(link);
    if (!esito.ok) {
      setAlzatoAHttps(false);
      setErrori((e) => ({ ...e, link: TESTI_POST.erroreLink[esito.errore] }));
      return false;
    }
    if (esito.url !== null && esito.url !== link) setLink(esito.url);
    setAlzatoAHttps(esito.alzatoAHttps);
    setErrori((e) => {
      const resto = { ...e };
      delete resto.link;
      return resto;
    });
    return esito.url;
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!corpo.trim()) next.corpo = "Scrivi il testo del post.";
    else if (corpo.length > MAX_CORPO) next.corpo = `Massimo ${MAX_CORPO} caratteri.`;
    if (tipo === "immagine" && !file) next.file = "Carica un'immagine.";
    else if (tipo === "immagine" && file && file.size > MAX_IMMAGINE_MB * 1024 * 1024) next.file = `L'immagine supera i ${MAX_IMMAGINE_MB} MB.`;
    const esitoLink = normalizzaLinkEsterno(link);
    if (!esitoLink.ok) next.link = TESTI_POST.erroreLink[esitoLink.errore];
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
    const linkDaSalvare = sistemaLink();
    if (linkDaSalvare === false) return;

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

      const { data: nuovo, error } = await supabase.from("post_enti").insert({
        istituzione_id: istituzioneId,
        tipo,
        corpo: corpo.trim(),
        immagine_url: tipo === "immagine" ? immagineUrl : null,
        link_esterno: linkDaSalvare,
        allegato_percorso: tipo === "file" ? allegatoPercorso : null,
        allegato_nome: tipo === "file" && allegato ? nomeAllegato(allegato.name) : null,
        aree,
      }).select("id").single();

      if (error) {
        if (error.message?.includes("troppi_post_nelle_24_ore")) {
          setErroreGenerale(TESTI_POST.tettoDalDatabase);
          router.refresh();
        } else if (error.message?.includes("area_post_non_approvata")) {
          setErrori({ aree: TESTI_AREE_POST.nonApprovata });
        } else if (error.message?.includes("troppe_aree_post") || error.message?.includes("post_enti_al_massimo_due_aree")) {
          setErrori({ aree: TESTI_AREE_POST.troppe });
        } else if (error.message?.includes("post_enti_link_esterno_https")) {
          setErrori({ link: TESTI_POST.erroreLink.nonIndirizzo });
        } else {
          console.error("[ente] pubblicazione di un post:", descriviErrore(error));
          setErroreGenerale("Non è stato possibile pubblicare il post. Riprova più tardi.");
        }
        return;
      }

      const id = (nuovo as { id?: string } | null)?.id;
      router.replace(id ? `/ente/bacheca?pubblicato=${id}` : "/ente/bacheca", { scroll: false });
      router.refresh();
    } catch {
      setErroreGenerale("Qualcosa è andato storto. Riprova tra qualche istante.");
    } finally {
      setInviando(false);
    }
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
        <div className="grid grid-cols-3 gap-2">
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

      {tipo === "immagine" && (
        <div>
          <label htmlFor="immagine" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Immagine (max {MAX_IMMAGINE_MB} MB)
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

      <div>
        <label htmlFor="link" className="mb-1.5 block text-sm font-medium text-kireo-light">
          {TESTI_POST.etichettaLink}
        </label>
        <input
          id="link"
          type="text"
          inputMode="url"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setAlzatoAHttps(false);
          }}
          onBlur={() => {
            if (link.trim()) sistemaLink();
          }}
          maxLength={MAX_LINK_ESTERNO}
          placeholder="https://"
          aria-invalid={Boolean(errori.link)}
          className={`${inputClass} ${fieldBorder(Boolean(errori.link))}`}
        />
        {errori.link && <p className="mt-1.5 text-sm text-red-400">{errori.link}</p>}
        {!errori.link && alzatoAHttps && <p className="mt-1.5 text-xs text-kireo-green-light">{TESTI_POST.linkAlzatoAHttps}</p>}
        <p className="mt-1.5 text-xs text-kireo-muted">{TESTI_POST.notaLink}</p>
      </div>

      {/* Le aree (31/10): le sceglie l'ente nel profilo, e qui compaiono solo
          quelle che ha. La riga grigia sta DOVE sarebbe l'elenco, sotto il nome
          del campo, e non in coda alla nota del link: un ente a cui manca un
          passo deve poterlo fare da dove ha scoperto che gli manca. */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-kireo-light">{TESTI_AREE_POST.etichetta}</legend>
        {areeApprovate === null ? (
          <p className="text-xs text-kireo-muted">{TESTI_AREE_POST.nonLette}</p>
        ) : areeApprovate.length === 0 ? (
          <p className="text-xs text-kireo-muted">
            {TESTI_AREE_POST.nessuna}{" "}
            <a href={TESTI_AREE_POST.hrefProfilo} className="text-kireo-orange underline underline-offset-2">
              {TESTI_AREE_POST.vaiAlProfilo}
            </a>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {areeApprovate.map((slug) => (
                <label
                  key={slug}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${
                    aree.includes(slug) ? "border-kireo-green bg-kireo-green/10 text-kireo-light" : "border-white/10 text-kireo-light/80"
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={aree.includes(slug)} onChange={() => cambiaArea(slug)} />
                  {getAreaBySlug(slug)?.nome ?? slug}
                </label>
              ))}
            </div>
            {errori.aree && <p className="mt-1.5 text-sm text-red-400">{errori.aree}</p>}
            <p className="mt-1.5 text-xs text-kireo-muted">{TESTI_AREE_POST.riga}</p>
          </>
        )}
      </fieldset>

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
