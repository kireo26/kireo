"use client";

import { useState } from "react";
import Link from "next/link";
import type { PostBacheca } from "@/lib/app/bacheca";
import { formattaData } from "@/lib/formato";
import { createClient } from "@/lib/supabase/client";
import { descriviErrore } from "@/lib/erroreSupabase";
import { TESTI_CONTENUTI, immagineDelPost, piattaformaDelLink } from "@/lib/post/contenuti";

// ⚠️ NIENTE IFRAME, NÉ PRIMA NÉ DOPO UN CLIC (30/10). Fino a oggi un link social
// caricava la pagina di Instagram o TikTok al primo clic, cioè si faceva
// vedere a Meta con un gesto che nessuno aveva detto essere un consenso. Ora è
// una scheda scritta dall'ente e un link che apre il post sulla piattaforma, in
// un'altra scheda, quando lo studente lo sceglie. Il perché per intero sta in
// `lib/post/contenuti.ts`: se torna la tentazione di «un'anteprima vera», è lì
// che va letta.

const BASE_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

function SchedaLink({ post }: { post: PostBacheca }) {
  const piattaforma = piattaformaDelLink(post.embed_url);
  const immagine = immagineDelPost(post.immagine_url, BASE_SUPABASE);
  if (!post.embed_url || !piattaforma) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-kireo-dark/60">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {immagine && <img src={immagine} alt="" className="max-h-72 w-full object-cover" />}
      <div className="space-y-1 p-4">
        <p className="text-xs uppercase tracking-wide text-kireo-muted">{piattaforma}</p>
        <p className="font-heading text-sm font-semibold text-kireo-light">{post.link_titolo ?? TESTI_CONTENUTI.linkSenzaScheda(piattaforma)}</p>
        {post.link_riga && <p className="text-sm text-kireo-light/80">{post.link_riga}</p>}
        <a
          href={post.embed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm font-medium text-kireo-orange underline underline-offset-2"
        >
          {TESTI_CONTENUTI.apriSu(piattaforma)}
        </a>
        <p className="text-xs text-kireo-muted">{TESTI_CONTENUTI.fuoriDaKireo}</p>
      </div>
    </div>
  );
}

// Il file si scarica dal server, che scrive la traccia PRIMA di mandarlo: la
// strada della guida (`app/api/scarica-allegato/[postId]`). Una POST nativa e
// niente JavaScript dopo, perché il PDF può sostituire la pagina.
function FileAllegato({ post }: { post: PostBacheca }) {
  if (!post.allegato_nome) return null;
  return (
    <form method="post" action={`/api/scarica-allegato/${post.id}`} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-kireo-dark/60 p-4">
      <input type="hidden" name="ritorno" value="/app/bacheca" />
      <span className="text-sm text-kireo-light">📄 {post.allegato_nome}</span>
      <button type="submit" className="text-sm font-medium text-kireo-orange underline underline-offset-2">
        {TESTI_CONTENUTI.scaricaFile}
      </button>
    </form>
  );
}

// «Salva»: la copia la scrive il database (`salva_post`), e togliere cancella
// la propria riga contando quante ne ha tolte (zero è un rifiuto, il modo 11).
// `salvatoIniziale` null vuol dire «non letto»: il bottone non afferma niente.
function SalvaPost({ postId, salvatoIniziale }: { postId: string; salvatoIniziale: boolean | null }) {
  const [salvato, setSalvato] = useState(salvatoIniziale);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  if (salvato === null) return null;

  async function cambia() {
    setLavoro(true);
    setErrore(null);
    try {
      const supabase = createClient();
      if (!salvato) {
        const { data, error } = await supabase.rpc("salva_post", { p_post: postId });
        const stato = (data as { stato?: string } | null)?.stato;
        if (error || (stato !== "salvato" && stato !== "gia_salvato")) {
          if (error) console.error("[bacheca] salva_post:", descriviErrore(error));
          setErrore(stato === "non_visibile" ? TESTI_CONTENUTI.salvaNonVisibile : TESTI_CONTENUTI.salvaNonRiuscito);
          return;
        }
        setSalvato(true);
      } else {
        const { data, error } = await supabase.from("post_salvati").delete().eq("post_id", postId).select("id");
        if (error || !data || data.length === 0) {
          if (error) console.error("[bacheca] togli un salvataggio:", descriviErrore(error));
          setErrore(TESTI_CONTENUTI.togliNonRiuscito);
          return;
        }
        setSalvato(false);
      }
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={cambia} disabled={lavoro} className="text-xs font-medium text-kireo-orange underline underline-offset-2 disabled:opacity-50">
        {salvato ? TESTI_CONTENUTI.salvato : TESTI_CONTENUTI.salva}
      </button>
      {salvato && <p className="mt-1 text-xs text-kireo-muted">{TESTI_CONTENUTI.salvatoDove}</p>}
      {errore && <p className="mt-1 text-xs text-red-400">{errore}</p>}
    </div>
  );
}

export default function FeedPost({ post, salvato }: { post: PostBacheca; salvato: boolean | null }) {
  const immagine = immagineDelPost(post.immagine_url, BASE_SUPABASE);
  return (
    <li className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/istituzioni/${post.istituzione_slug}`} className="font-heading text-sm font-semibold text-kireo-light hover:underline">
          {post.istituzione_nome}
        </Link>
        <span className="text-xs text-kireo-muted">{formattaData(post.pubblicato_il, "medium")}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-kireo-light/90">{post.corpo}</p>
      {post.tipo === "immagine" && immagine && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={immagine} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
      )}
      {post.tipo === "link_social" && <SchedaLink post={post} />}
      {post.tipo === "file" && <FileAllegato post={post} />}
      <SalvaPost postId={post.id} salvatoIniziale={salvato} />
    </li>
  );
}
