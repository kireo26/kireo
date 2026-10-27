"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// LE VOCI SOTTO «EVENTI» (Mario, 27/10). Per l'ente: In programmazione ·
// Eventi passati · Crea evento. Per l'admin: Da approvare (N) · In
// programmazione · Eventi passati · Rifiutati — stesso componente, un ordine
// diverso perché il mestiere è un altro (`lib/admin/eventiAdmin.ts`). Stanno
// in cima alla sezione e non nella barra laterale, perché devono esserci anche
// sul telefono, dove la barra è una fila di icone senza un secondo livello.
export const SCHEDE_ENTE = [
  { href: "/ente/eventi", label: "In programmazione" },
  { href: "/ente/eventi/passati", label: "Eventi passati" },
  { href: "/ente/eventi/nuovo", label: "Crea evento" },
];

export default function SchedeEventi({ schede }: { schede: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Eventi" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
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
