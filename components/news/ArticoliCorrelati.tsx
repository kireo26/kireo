import type { NewsArticolo } from "@/lib/news";
import ArticoloCard from "./ArticoloCard";

export default function ArticoliCorrelati({ articoli }: { articoli: NewsArticolo[] }) {
  if (articoli.length === 0) return null;

  return (
    <section className="not-prose mt-20 border-t border-white/5 pt-12">
      <h2 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">Articoli correlati</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {articoli.map((articolo) => (
          <ArticoloCard key={articolo.slug} articolo={articolo} />
        ))}
      </div>
    </section>
  );
}
