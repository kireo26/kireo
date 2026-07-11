import Link from "next/link";
import type { NewsCategoria } from "@/lib/news";

function costruisciHref(pagina: number, categoria: NewsCategoria | null) {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return `/news${query ? `?${query}` : ""}`;
}

export default function Paginazione({
  paginaCorrente,
  totalePagine,
  categoria,
}: {
  paginaCorrente: number;
  totalePagine: number;
  categoria: NewsCategoria | null;
}) {
  if (totalePagine <= 1) return null;

  const linkClass = "rounded-full px-5 py-2 font-sans text-sm font-medium transition-colors";

  return (
    <nav aria-label="Paginazione articoli" className="mt-12 flex items-center justify-center gap-4">
      {paginaCorrente > 1 ? (
        <Link href={costruisciHref(paginaCorrente - 1, categoria)} className={`${linkClass} bg-kireo-card text-kireo-light hover:bg-white/10`}>
          ← Precedente
        </Link>
      ) : (
        <span className={`${linkClass} cursor-not-allowed bg-kireo-card/50 text-kireo-muted`}>← Precedente</span>
      )}

      <span className="text-sm text-kireo-muted">
        Pagina {paginaCorrente} di {totalePagine}
      </span>

      {paginaCorrente < totalePagine ? (
        <Link href={costruisciHref(paginaCorrente + 1, categoria)} className={`${linkClass} bg-kireo-card text-kireo-light hover:bg-white/10`}>
          Successiva →
        </Link>
      ) : (
        <span className={`${linkClass} cursor-not-allowed bg-kireo-card/50 text-kireo-muted`}>Successiva →</span>
      )}
    </nav>
  );
}
