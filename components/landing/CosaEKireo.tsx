import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import { PUBBLICI } from "@/data/cosaEKireo";

// Stessi 3 blocchi (contenuto e stile) della sezione "Per chi è KIREO"
// della Homepage — vedi data/cosaEKireo.ts. Riusato identico dalle landing
// del funnel scuole, così chi arriva da un link email vede la stessa
// descrizione del progetto che troverebbe sul sito pubblico.
export default function CosaEKireo() {
  return (
    <section className="border-t border-white/5 bg-kireo-card/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="Cos'è KIREO" title="Una piattaforma, tre mondi" align="center" />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PUBBLICI.map((p) => (
            <div key={p.tag} className="flex flex-col rounded-2xl border border-white/5 bg-kireo-card p-8">
              <span
                className={`inline-block w-fit rounded-full px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wide ${p.tagClass}`}
              >
                {p.tag}
              </span>
              <h3 className="mt-4 py-0.5 font-heading text-xl font-bold leading-[1.25] text-kireo-light">{p.titolo}</h3>
              <p className="mt-2 text-sm text-kireo-muted">{p.testo}</p>
              <ul className="mt-6 space-y-3">
                {p.lista.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-kireo-light/90">
                    <span className="mt-0.5 text-kireo-orange">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className="mt-auto pt-8 text-sm font-semibold text-kireo-light transition-colors hover:text-kireo-orange"
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
