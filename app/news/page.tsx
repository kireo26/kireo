import type { Metadata } from "next";
import Link from "next/link";
import ArticoloCard from "@/components/news/ArticoloCard";
import FiltroCategorie from "@/components/news/FiltroCategorie";
import Paginazione from "@/components/news/Paginazione";
import { getTuttiGliArticoli, CATEGORIE_NEWS, type NewsCategoria } from "@/lib/news";
import { getAreaBySlug } from "@/data/aree";
import { SITE_URL } from "@/lib/site";

const PER_PAGINA = 12;

export const metadata: Metadata = {
  title: "News — KIREO",
  description:
    "Guide, approfondimenti e novità su orientamento post-diploma, PCTO e scuola, per studenti, docenti e famiglie.",
  alternates: { canonical: `${SITE_URL}/news` },
  openGraph: {
    title: "News — KIREO",
    description: "Guide, approfondimenti e novità su orientamento post-diploma, PCTO e scuola.",
    url: `${SITE_URL}/news`,
    images: [{ url: `${SITE_URL}/news/opengraph-image`, width: 1200, height: 630 }],
  },
};

function isCategoriaValida(valore: string | undefined): valore is NewsCategoria {
  return valore !== undefined && valore in CATEGORIE_NEWS;
}

export default async function NewsIndex({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; pagina?: string; area?: string }>;
}) {
  const params = await searchParams;
  const categoriaAttiva = isCategoriaValida(params.categoria) ? params.categoria : null;
  const paginaRichiesta = Number(params.pagina) || 1;
  const areaAttiva = params.area ? getAreaBySlug(params.area) : null;

  const tutti = getTuttiGliArticoli();
  let filtrati = categoriaAttiva ? tutti.filter((a) => a.category === categoriaAttiva) : tutti;
  if (areaAttiva) filtrati = filtrati.filter((a) => a.aree?.includes(areaAttiva.slug));

  const [inEvidenza, ...resto] = filtrati;
  const totalePagine = Math.max(1, Math.ceil(resto.length / PER_PAGINA));
  const paginaCorrente = Math.min(Math.max(1, paginaRichiesta), totalePagine);
  const paginati = resto.slice((paginaCorrente - 1) * PER_PAGINA, paginaCorrente * PER_PAGINA);

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-20 sm:pt-28">
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">News</p>
        <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
          Guide, approfondimenti e novità KIREO
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-kireo-muted">
          Orientamento post-diploma, PCTO e scuola: contenuti per studenti, docenti e chi lavora
          nell&apos;orientamento.
        </p>

        <div className="mt-8">
          <FiltroCategorie categoriaAttiva={categoriaAttiva} />
        </div>

        {areaAttiva && (
          <div className="mt-4 flex items-center gap-2 text-sm text-kireo-muted">
            Filtrati per area:
            <span className="rounded-full bg-kireo-green/15 px-3 py-1 font-medium text-kireo-green-light">
              {areaAttiva.nome}
            </span>
            <Link href="/news" className="text-kireo-orange underline underline-offset-2">
              Rimuovi filtro
            </Link>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        {filtrati.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center text-kireo-muted">
            {areaAttiva ? "I primi articoli di quest'area arrivano presto." : "Nessun articolo in questa categoria, per ora."}
          </p>
        ) : (
          <>
            {paginaCorrente === 1 && inEvidenza && (
              <div className="mb-10">
                <ArticoloCard articolo={inEvidenza} evidenza />
              </div>
            )}

            {paginati.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {paginati.map((articolo) => (
                  <ArticoloCard key={articolo.slug} articolo={articolo} />
                ))}
              </div>
            )}

            <Paginazione
              paginaCorrente={paginaCorrente}
              totalePagine={totalePagine}
              categoria={categoriaAttiva}
              area={areaAttiva?.slug ?? null}
            />
          </>
        )}
      </section>
    </>
  );
}
