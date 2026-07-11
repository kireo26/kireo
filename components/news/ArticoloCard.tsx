import Link from "next/link";
import CategoriaBadge from "./CategoriaBadge";
import type { NewsArticolo } from "@/lib/news";
import { formattaData } from "@/lib/formato";

export default function ArticoloCard({
  articolo,
  evidenza = false,
}: {
  articolo: NewsArticolo;
  evidenza?: boolean;
}) {
  return (
    <Link
      href={`/news/${articolo.slug}`}
      className="flex flex-col rounded-2xl border border-white/5 bg-kireo-card p-6 transition-colors hover:border-kireo-green/40 sm:p-8"
    >
      <CategoriaBadge categoria={articolo.category} />
      <h3
        className={`mt-4 py-0.5 font-heading font-bold leading-[1.25] text-kireo-light ${
          evidenza ? "text-2xl sm:text-3xl" : "text-lg"
        }`}
      >
        {articolo.title}
      </h3>
      <p className={`mt-2 text-sm text-kireo-muted ${evidenza ? "line-clamp-3 sm:text-base" : "line-clamp-3"}`}>
        {articolo.description}
      </p>
      <div className="mt-auto flex items-center gap-3 pt-6 text-xs text-kireo-muted">
        <time dateTime={articolo.publishedAt}>{formattaData(articolo.publishedAt)}</time>
        <span aria-hidden="true">·</span>
        <span>{articolo.readingTime} min di lettura</span>
      </div>
    </Link>
  );
}
