"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// LE TRE VOCI SOTTO «EVENTI» (Mario, 27/10): In programmazione · Eventi
// passati · Crea evento. Stanno in cima alla sezione e non nella barra
// laterale di `EnteShell`, perché devono esserci anche sul telefono, dove la
// barra è una fila di icone senza spazio per un secondo livello.
const SCHEDE = [
  { href: "/ente/eventi", label: "In programmazione" },
  { href: "/ente/eventi/passati", label: "Eventi passati" },
  { href: "/ente/eventi/nuovo", label: "Crea evento" },
];

export default function SchedeEventi() {
  const pathname = usePathname();
  return (
    <nav aria-label="Eventi" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
      {SCHEDE.map((s) => {
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
