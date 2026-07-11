import type { VoceIndice } from "@/lib/news";

// Mostrato solo per articoli con almeno 3 sezioni H2.
export default function IndiceArticolo({ voci }: { voci: VoceIndice[] }) {
  if (voci.length < 3) return null;

  return (
    <nav aria-label="Indice dell'articolo" className="not-prose mb-10 rounded-2xl border border-white/5 bg-kireo-card p-6">
      <p className="font-sans text-sm font-semibold uppercase tracking-wide text-kireo-muted">In questo articolo</p>
      <ul className="mt-4 space-y-2">
        {voci.map((voce) => (
          <li key={voce.id}>
            <a href={`#${voce.id}`} className="text-sm text-kireo-light/90 transition-colors hover:text-kireo-orange">
              {voce.testo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
