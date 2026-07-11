import Link from "next/link";
import { CATEGORIE_NEWS, type NewsCategoria } from "@/lib/news";

// Componente server: i filtri sono semplici link che cambiano il query
// param ?categoria, niente JS lato client necessario.
export default function FiltroCategorie({ categoriaAttiva }: { categoriaAttiva: NewsCategoria | null }) {
  const opzioni: { value: NewsCategoria | null; label: string }[] = [
    { value: null, label: "Tutti" },
    ...(Object.entries(CATEGORIE_NEWS) as [NewsCategoria, { label: string }][]).map(([value, { label }]) => ({
      value,
      label,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per categoria">
      {opzioni.map((opzione) => {
        const attivo = opzione.value === categoriaAttiva;
        const href = opzione.value ? `/news?categoria=${opzione.value}` : "/news";
        return (
          <Link
            key={opzione.label}
            href={href}
            aria-current={attivo ? "true" : undefined}
            className={`rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors ${
              attivo ? "bg-kireo-green text-kireo-light" : "bg-kireo-card text-kireo-light/80 hover:bg-white/10"
            }`}
          >
            {opzione.label}
          </Link>
        );
      })}
    </div>
  );
}
