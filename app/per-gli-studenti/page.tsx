import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import Card from "@/components/Card";
import SectionHeading from "@/components/SectionHeading";
import { AREE } from "@/data/aree";

export const metadata: Metadata = {
  title: "Per gli studenti — KIREO",
  description:
    "Un percorso di orientamento personalizzato e gratuito che fa emergere le tue attitudini e ti mostra le direzioni coerenti con te.",
};

const PUNTI = [
  {
    title: "Percorso su misura",
    description: "Test attitudinali, guide, webinar e workshop pensati per far emergere chi sei davvero.",
  },
  {
    title: "Orientatori esperti",
    description: "Confronto diretto con professionisti che ti aiutano a leggere i risultati del tuo percorso.",
  },
  {
    title: "Ore PCTO certificate",
    description: "Ogni attività di orientamento matura automaticamente ore PCTO per la tua scuola.",
  },
  {
    title: "Aree di orientamento",
    description: "Esplora 16 aree — dall'informatica alla sanità, dall'arte all'ingegneria — e scopri dove ti porta la tua direzione.",
  },
];

export default function PerGliStudenti() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Per gli studenti
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            Scopri chi sei. Scegli con chiarezza.
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            Un percorso di orientamento personalizzato e gratuito che fa emergere le tue attitudini
            e ti mostra le direzioni coerenti con te — studio o lavoro.
          </p>
          <div className="mt-8">
            <ButtonLink href="/registrazione" variant="primary">
              Inizia il tuo percorso →
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading eyebrow="Cosa trovi in KIREO" title="Tutto quello che ti serve per orientarti" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PUNTI.map((p) => (
              <Card key={p.title} title={p.title} description={p.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="Esplora" title="Le aree di orientamento" align="center" />
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AREE.map((area) => (
            <Link
              key={area.slug}
              href={`/aree/${area.slug}`}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5 text-center transition-colors hover:border-kireo-orange/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-xs font-bold text-kireo-orange">
                {area.icona}
              </span>
              <span className="font-heading text-sm font-semibold leading-[1.25] text-kireo-light">
                {area.nome}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-12 text-center">
          <ButtonLink href="/registrazione" variant="primary">
            Inizia il tuo percorso di orientamento
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
