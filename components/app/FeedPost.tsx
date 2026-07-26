"use client";

import { useState } from "react";
import Link from "next/link";
import type { PostBacheca } from "@/lib/app/bacheca";

function estraiEmbedIframeUrl(embedUrl: string): string | null {
  if (/instagram\.com/i.test(embedUrl)) {
    return `${embedUrl.replace(/\/$/, "")}/embed`;
  }
  const matchTikTok = embedUrl.match(/tiktok\.com\/[^/]+\/video\/(\d+)/i);
  if (matchTikTok) {
    return `https://www.tiktok.com/embed/v2/${matchTikTok[1]}`;
  }
  return null;
}

// L'iframe Instagram/TikTok si carica SOLO al click dello studente: prima
// solo un'anteprima statica neutra (placeholder brand), mai un embed
// automatico al caricamento della pagina.
function AnteprimaEmbed({ embedUrl }: { embedUrl: string }) {
  const [caricato, setCaricato] = useState(false);
  const iframeUrl = estraiEmbedIframeUrl(embedUrl);

  if (caricato && iframeUrl) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-white/5">
        <iframe src={iframeUrl} className="h-[500px] w-full" title="Post social" loading="lazy" allowFullScreen />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setCaricato(true)}
      className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-gradient-to-br from-kireo-green/20 to-kireo-orange/10 py-10 text-center transition-colors hover:border-kireo-orange/40"
    >
      <span className="text-2xl">▶</span>
      <span className="text-sm font-medium text-kireo-light">Clicca per caricare il post</span>
      <span className="text-xs text-kireo-muted">{/instagram\.com/i.test(embedUrl) ? "Instagram" : "TikTok"}</span>
    </button>
  );
}

export default function FeedPost({ post }: { post: PostBacheca }) {
  return (
    <li className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/istituzioni/${post.istituzione_slug}`} className="font-heading text-sm font-semibold text-kireo-light hover:underline">
          {post.istituzione_nome}
        </Link>
        <span className="text-xs text-kireo-muted">{new Date(post.created_at).toLocaleDateString("it-IT", { dateStyle: "medium" })}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-kireo-light/90">{post.corpo}</p>
      {post.tipo === "immagine" && post.immagine_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.immagine_url} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
      )}
      {post.tipo === "link_social" && post.embed_url && <AnteprimaEmbed embedUrl={post.embed_url} />}
    </li>
  );
}
