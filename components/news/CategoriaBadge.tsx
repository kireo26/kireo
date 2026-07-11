import { CATEGORIE_NEWS, type NewsCategoria } from "@/lib/news";

export default function CategoriaBadge({ categoria }: { categoria: NewsCategoria }) {
  const { label, badgeClass } = CATEGORIE_NEWS[categoria];
  return (
    <span
      className={`inline-block w-fit rounded-full px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wide ${badgeClass}`}
    >
      {label}
    </span>
  );
}
