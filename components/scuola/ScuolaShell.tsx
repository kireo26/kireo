"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: (props: { className?: string }) => React.ReactElement;
  soloReferente?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/scuola", label: "Home", shortLabel: "Home", icon: IconHome },
  { href: "/scuola/studenti", label: "Studenti", shortLabel: "Studenti", icon: IconStudenti, soloReferente: true },
  { href: "/scuola/classi", label: "Classi", shortLabel: "Classi", icon: IconClassi },
  { href: "/scuola/staff", label: "Staff", shortLabel: "Staff", icon: IconStaff, soloReferente: true },
  { href: "/scuola/eventi", label: "Eventi", shortLabel: "Eventi", icon: IconEventi },
  { href: "/scuola/comunicazioni", label: "Comunicazioni", shortLabel: "Comunica.", icon: IconComunicazioni },
  { href: "/scuola/statistiche", label: "Statistiche", shortLabel: "Stats", icon: IconStatistiche },
];

function isAttivo(pathname: string, href: string) {
  return href === "/scuola" ? pathname === "/scuola" : pathname.startsWith(href);
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m4 11 8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function IconStudenti({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="9" cy="8" r="3" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M3 20c0.8-3 3-4.5 6-4.5S14.2 17 15 20" />
      <circle cx="17" cy="9" r="2.3" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M15.5 15.2c2.4.3 3.8 1.6 4.4 3.8" />
    </svg>
  );
}

function IconClassi({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconStaff({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
      <path strokeWidth="2" strokeLinecap="round" d="M16 4.5c1 .4 1.7 1.4 1.7 2.5S17 9.1 16 9.5" />
    </svg>
  );
}

function IconEventi({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function IconComunicazioni({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
    </svg>
  );
}

function IconStatistiche({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeWidth="2" strokeLinecap="round" d="M5 20V10M12 20V4M19 20v-7" />
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

export default function ScuolaShell({
  nomeScuola,
  ruoloStaff,
  children,
}: {
  nomeScuola: string;
  ruoloStaff: "referente" | "tutor";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const voci = NAV_ITEMS.filter((item) => !item.soloReferente || ruoloStaff === "referente");
  const sezioneCorrente = voci.find((item) => isAttivo(pathname, item.href))?.label ?? "";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-kireo-dark md:flex">
      <aside className="hidden w-60 flex-none flex-col border-r border-white/5 px-4 py-6 md:flex">
        <div className="px-2 pb-2">
          <Logo />
        </div>
        <p className="truncate px-2 pb-0.5 text-xs text-kireo-light/80">{nomeScuola}</p>
        <p className="px-2 pb-6 text-[11px] uppercase tracking-wide text-kireo-muted">
          {ruoloStaff === "referente" ? "Referente" : "Tutor"}
        </p>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Navigazione area scuola">
          {voci.map((item) => {
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
          className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-white/10 bg-kireo-dark/95 backdrop-blur md:hidden"
          aria-label="Navigazione area scuola"
        >
          {voci.map((item) => {
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
