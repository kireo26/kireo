import Link from "next/link";
import { pagineTotali } from "@/lib/admin/pagine";

// Avanti e indietro in un elenco dell'admin, tenendo la ricerca.
export default function Paginazione({ base, pagina, totale, q }: { base: string; pagina: number; totale: number | null; q?: string }) {
  const ultima = pagineTotali(totale);
  if (ultima <= 1) return null;
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (p > 1) s.set("pagina", String(p));
    const qs = s.toString();
    return qs ? `${base}?${qs}` : base;
  };
  return (
    <nav aria-label="Pagine" className="mt-4 flex items-center gap-4 text-sm">
      {pagina > 1 && <Link href={href(pagina - 1)} className="text-kireo-orange underline underline-offset-2">← Precedenti</Link>}
      <span className="text-kireo-muted">Pagina {pagina} di {ultima}</span>
      {pagina < ultima && <Link href={href(pagina + 1)} className="text-kireo-orange underline underline-offset-2">Successivi →</Link>}
    </nav>
  );
}
