import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import SectionHeading from "@/components/SectionHeading";
import GuidaAreaForm from "@/components/GuidaAreaForm";
import { AREE, getAreaBySlug } from "@/data/aree";

export function generateStaticParams() {
  return AREE.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) return {};
  return {
    title: `${area.nome} — Aree di orientamento — KIREO`,
    description: area.descrizioneBreve,
  };
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) notFound();

  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 sm:pt-28">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-base font-bold text-kireo-orange">
          {area.icona}
        </span>
        <p className="mb-4 mt-6 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
          Area di orientamento
        </p>
        <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
          {area.nome}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-kireo-muted">{area.descrizioneEstesa}</p>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeading eyebrow="Le possibilità" title="Che strade puoi prendere" />
          <ul className="mt-10 space-y-4">
            {area.direzioni.map((d) => (
              <li
                key={d}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-kireo-card p-5 text-sm text-kireo-light/90"
              >
                <span className="mt-0.5 text-kireo-orange">✓</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-20">
        <div className="text-center">
          <h2 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">
            Scarica la guida di orientamento
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-kireo-muted">
            Una guida gratuita su {area.nome.toLowerCase()}: percorsi, competenze richieste e
            domande utili per capire se fa per te.
          </p>
        </div>
        <div className="mt-10">
          <GuidaAreaForm areaNome={area.nome} />
        </div>
      </section>

      <section className="bg-kireo-green">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
            Pronto a scoprire la tua direzione?
          </h2>
          <div className="mt-8">
            <ButtonLink href="/registrazione" variant="outline" className="border-kireo-light/60">
              Inizia il tuo percorso di orientamento
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
