import Link from "next/link";

export type AreaInteresse = { slug: string; nome: string; icona: string };

// Estratto dal blocco già presente nella vecchia Home minima: stesso
// markup, ora riusabile (Home e pagina Aree).
export default function BloccoLeMieAree({ aree }: { aree: AreaInteresse[] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Le mie aree</h2>
      {aree.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-3">
          {aree.map((area) => (
            <li key={area.slug}>
              <Link
                href={`/aree/${area.slug}`}
                className="flex items-center gap-2 rounded-full border border-white/10 py-1.5 pl-1.5 pr-4 text-sm text-kireo-light transition-colors hover:border-kireo-green"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-xs font-bold text-kireo-orange">
                  {area.icona}
                </span>
                {area.nome}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-kireo-muted">
          Non hai ancora scelto le aree che ti incuriosiscono.{" "}
          <Link href="/app/profilo" className="text-kireo-orange underline underline-offset-2">
            Scegline fino a 3
          </Link>
          .
        </p>
      )}
    </div>
  );
}
