"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VOCI_MENU_ADMIN } from "@/lib/admin/menu";

// Il menu dell'area admin (Mario, 31/10). La voce attiva è quella il cui
// indirizzo apre quello di adesso; «Oggi» solo su /admin esatto.
export default function MenuAdmin() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Area admin" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
      {VOCI_MENU_ADMIN.map((v) => {
        const attiva = v.href === "/admin" ? pathname === "/admin" : pathname === v.href || pathname.startsWith(`${v.href}/`);
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={attiva ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${attiva ? "bg-kireo-green/20 text-kireo-light" : "text-kireo-muted hover:text-kireo-light"}`}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
