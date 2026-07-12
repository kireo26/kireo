"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "../Logo";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/app", label: "Home", shortLabel: "Home", icon: IconHome },
  { href: "/app/aree", label: "Aree", shortLabel: "Aree", icon: IconAree },
  { href: "/app/agenda", label: "Agenda", shortLabel: "Agenda", icon: IconAgenda },
  { href: "/app/attivita", label: "Le mie attività", shortLabel: "Attività", icon: IconAttivita },
  { href: "/app/profilo", label: "Profilo", shortLabel: "Profilo", icon: IconProfilo },
];

function isAttivo(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9" />
    </svg>
  );
}

function IconAree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="m14.5 9.5-5 2-2 5 5-2 2-5Z" />
    </svg>
  );
}

function IconAgenda({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function IconAttivita({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" d="M5 6h14M5 12h14M5 18h9" />
    </svg>
  );
}

function IconProfilo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const sezioneCorrente = NAV_ITEMS.find((item) => isAttivo(pathname, item.href))?.label ?? "";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-kireo-dark md:flex">
      <aside className="hidden w-60 flex-none flex-col border-r border-white/5 px-4 py-6 md:flex">
        <div className="px-2 pb-8">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Navigazione area personale">
          {NAV_ITEMS.map((item) => {
            const attivo = isAttivo(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={attivo ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  attivo ? "bg-kireo-green/15 text-kireo-orange" : "text-kireo-light/90 hover:bg-white/5"
                }`}
              >
                <item.icon className="h-5 w-5 flex-none" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-kireo-light/70 transition-colors hover:bg-white/5 hover:text-kireo-light"
        >
          <IconLogout className="h-5 w-5 flex-none" />
          Esci
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:hidden">
          <span className="font-heading text-base font-semibold text-kireo-light">{sezioneCorrente}</span>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Esci"
            className="flex h-9 w-9 items-center justify-center rounded-full text-kireo-light/80 transition-colors hover:bg-white/5"
          >
            <IconLogout className="h-5 w-5" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-10">{children}</main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-kireo-dark/95 backdrop-blur md:hidden"
          aria-label="Navigazione area personale"
        >
          {NAV_ITEMS.map((item) => {
            const attivo = isAttivo(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={attivo ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  attivo ? "text-kireo-orange" : "text-kireo-light/70"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.shortLabel}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
