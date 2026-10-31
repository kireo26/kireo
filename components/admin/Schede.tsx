"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Le schede di un elenco dell'admin (Eventi, Post, Newsletter). La scheda
// attiva è quella dell'indirizzo di adesso; la ricerca non si porta da una
// scheda all'altra, perché ogni scheda è un elenco suo.
export default function Schede({ etichetta, schede }: { etichetta: string; schede: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={etichetta} className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
      {schede.map((s) => {
        const attiva = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={attiva ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${attiva ? "bg-kireo-green/20 text-kireo-light" : "text-kireo-muted hover:text-kireo-light"}`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
