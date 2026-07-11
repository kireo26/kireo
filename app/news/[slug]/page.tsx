import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import CategoriaBadge from "@/components/news/CategoriaBadge";
import IndiceArticolo from "@/components/news/IndiceArticolo";
import ArticoliCorrelati from "@/components/news/ArticoliCorrelati";
import CtaArticolo from "@/components/news/CtaArticolo";
import { formattaData } from "@/lib/formato";
import { getArticoloBySlug, getArticoliCorrelati, getTuttiGliArticoli, estraiIndice } from "@/lib/news";
import { SITE_URL } from "@/lib/site";

// Solo i percorsi generati in build: una bozza (draft) richiesta
// direttamente per URL in produzione risulta 404, non renderizzata on-demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return getTuttiGliArticoli().map((articolo) => ({ slug: articolo.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const articolo = getArticoloBySlug(slug);
  if (!articolo) return {};

  const url = `${SITE_URL}/news/${articolo.slug}`;
  const immagine = articolo.ogImage ? `${SITE_URL}${articolo.ogImage}` : `${SITE_URL}/news/opengraph-image`;

  return {
    title: `${articolo.title} — KIREO`,
    description: articolo.description,
    alternates: { canonical: url },
    openGraph: {
      title: articolo.title,
      description: articolo.description,
      url,
      type: "article",
      publishedTime: articolo.publishedAt,
      modifiedTime: articolo.updatedAt,
      authors: [articolo.author],
      images: [{ url: immagine, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: articolo.title,
      description: articolo.description,
      images: [immagine],
    },
  };
}

export default async function ArticoloPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const articolo = getArticoloBySlug(slug);
  if (!articolo) notFound();

  const indice = estraiIndice(articolo.content);
  const correlati = getArticoliCorrelati(articolo);
  const url = `${SITE_URL}/news/${articolo.slug}`;
  const immagine = articolo.ogImage ? `${SITE_URL}${articolo.ogImage}` : `${SITE_URL}/news/opengraph-image`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: articolo.title,
    description: articolo.description,
    datePublished: articolo.publishedAt,
    dateModified: articolo.updatedAt,
    author: { "@type": "Organization", name: articolo.author },
    publisher: {
      "@type": "Organization",
      name: "KIREO",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: immagine,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-2xl px-6 pb-12 pt-20 sm:pt-28">
        <Link href="/news" className="text-sm text-kireo-muted transition-colors hover:text-kireo-orange">
          ← Tutte le news
        </Link>

        <div className="mt-6">
          <CategoriaBadge categoria={articolo.category} />
        </div>
        <h1 className="mt-4 py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          {articolo.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-kireo-muted">
          <span>{articolo.author}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={articolo.publishedAt}>{formattaData(articolo.publishedAt)}</time>
          <span aria-hidden="true">·</span>
          <span>{articolo.readingTime} min di lettura</span>
        </div>

        <div className="mt-10">
          <IndiceArticolo voci={indice} />
        </div>

        <div className="prose prose-invert max-w-none sm:prose-lg prose-headings:font-heading prose-headings:font-bold prose-headings:leading-[1.25] prose-headings:text-kireo-light prose-p:leading-relaxed prose-p:text-kireo-light/90 prose-a:text-kireo-orange prose-strong:text-kireo-light prose-li:leading-relaxed prose-li:text-kireo-light/90 prose-blockquote:border-kireo-orange prose-blockquote:text-kireo-muted">
          <MDXRemote
            source={articolo.content}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] } }}
          />
        </div>

        <CtaArticolo categoria={articolo.category} />
      </article>

      <div className="mx-auto max-w-4xl px-6">
        <ArticoliCorrelati articoli={correlati} />
      </div>
    </>
  );
}
