"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Logo from "./Logo";
import { Button, ButtonLink } from "./Button";
import { createClient } from "@/lib/supabase/client";
import { AREE } from "@/data/aree";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/per-gli-studenti", label: "Per gli studenti" },
  { href: "/per-le-scuole", label: "Per le scuole" },
  { href: "/per-i-docenti", label: "Per i docenti" },
];

// Nome e iniziali si leggono da user_metadata (già nella sessione, nessuna
// query a `profiles`): stessi campi salvati al signup e già usati in /app.
function nomeUtente(user: User): string {
  const meta = user.user_metadata as Record<string, unknown>;
  if (typeof meta?.nome === "string" && meta.nome) return meta.nome;
  return user.email ?? "Utente";
}

function inizialiUtente(user: User): string {
  const meta = user.user_metadata as Record<string, unknown>;
  const nome = typeof meta?.nome === "string" ? meta.nome : "";
  const cognome = typeof meta?.cognome === "string" ? meta.cognome : "";
  const iniziali = `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase();
  if (iniziali.trim()) return iniziali;
  return (user.email ?? "?").charAt(0).toUpperCase();
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [areeOpen, setAreeOpen] = useState(false);
  const [areeOpenMobile, setAreeOpenMobile] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const areeRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);

  // Un'unica sottoscrizione legge la sessione corrente (fired subito con lo
  // stato già in memoria, nessuna chiamata di rete) e resta aggiornata su
  // login/logout — niente getSession()/getUser() aggiuntivi in parallelo.
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserMenuOpen(false);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (areeRef.current && !areeRef.current.contains(e.target as Node)) {
        setAreeOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAreeOpen(false);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Misura l'altezza della barra superiore per sapere quanto spazio resta
  // al drawer mobile sotto di essa (usato nel calc() del max-height sotto).
  useEffect(() => {
    const topBar = topBarRef.current;
    const header = headerRef.current;
    if (!topBar || !header) return;

    const setHeight = () => {
      header.style.setProperty("--kireo-topbar-h", `${topBar.offsetHeight}px`);
    };
    setHeight();

    const observer = new ResizeObserver(setHeight);
    observer.observe(topBar);
    return () => observer.disconnect();
  }, []);

  // Blocca lo scroll della pagina mentre il drawer mobile è aperto e lo
  // ripristina sempre alla chiusura — incluso quando si chiude per
  // navigazione verso un'altra pagina (l'Header vive nel layout root e non
  // viene smontato dal routing lato client, quindi il cleanup scatta anche
  // in quel caso).
  useEffect(() => {
    if (!open) return;

    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const prevHtmlOverflow = htmlStyle.overflow;
    const prevBodyOverflow = bodyStyle.overflow;

    htmlStyle.overflow = "hidden";
    bodyStyle.overflow = "hidden";

    return () => {
      htmlStyle.overflow = prevHtmlOverflow;
      bodyStyle.overflow = prevBodyOverflow;
    };
  }, [open]);

  // L'area /app ha una propria navigazione (components/app/AppShell.tsx):
  // l'header pubblico non deve comparire lì, per non duplicare i controlli.
  if (pathname?.startsWith("/app")) {
    return null;
  }

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-white/5 bg-kireo-dark/90 backdrop-blur">
      <div ref={topBarRef} className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigazione principale">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-sans text-sm font-medium text-kireo-light/90 transition-colors hover:text-kireo-orange"
            >
              {link.label}
            </Link>
          ))}

          <div ref={areeRef} className="relative">
            <button
              type="button"
              onClick={() => setAreeOpen((v) => !v)}
              aria-expanded={areeOpen}
              aria-haspopup="true"
              className="flex items-center gap-1 font-sans text-sm font-medium text-kireo-light/90 transition-colors hover:text-kireo-orange"
            >
              Aree di orientamento
              <ChevronIcon open={areeOpen} />
            </button>

            {areeOpen && (
              <div className="absolute left-1/2 top-full z-50 mt-3 max-h-[80vh] w-[min(90vw,56rem)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-kireo-card p-6 shadow-2xl">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {AREE.map((area) => (
                    <Link
                      key={area.slug}
                      href={`/aree/${area.slug}`}
                      onClick={() => setAreeOpen(false)}
                      className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-xs font-bold text-kireo-orange">
                        {area.icona}
                      </span>
                      <span>
                        <span className="block font-heading text-sm font-semibold leading-[1.25] text-kireo-light">
                          {area.nome}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-kireo-muted">
                          {area.descrizioneBreve}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/news"
            className="font-sans text-sm font-medium text-kireo-light/90 transition-colors hover:text-kireo-orange"
          >
            News
          </Link>

          <Link
            href="/contatti"
            className="font-sans text-sm font-medium text-kireo-light/90 transition-colors hover:text-kireo-orange"
          >
            Contatti
          </Link>
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          {user === undefined ? null : user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/5"
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-kireo-green/20 font-heading text-xs font-bold text-kireo-green-light">
                  {inizialiUtente(user)}
                </span>
                <span className="max-w-[10rem] truncate font-sans text-sm font-medium text-kireo-light/90">
                  {nomeUtente(user)}
                </span>
                <ChevronIcon open={userMenuOpen} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-52 rounded-xl border border-white/10 bg-kireo-card p-2 shadow-2xl">
                  <Link
                    href="/app"
                    onClick={() => setUserMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 font-sans text-sm text-kireo-light transition-colors hover:bg-white/5"
                  >
                    La mia area
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded-lg px-3 py-2 text-left font-sans text-sm text-kireo-light transition-colors hover:bg-white/5"
                  >
                    Esci
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/accedi"
                className="font-sans text-sm font-medium text-kireo-light/90 transition-colors hover:text-kireo-orange"
              >
                Accedi
              </Link>
              <ButtonLink href="/registrazione" variant="primary">
                Inizia ora
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-kireo-light md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Chiudi il menu" : "Apri il menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" aria-hidden="true">
            {open ? (
              <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Navigazione mobile"
          className="max-h-[calc(100dvh_-_var(--kireo-topbar-h,_4rem))] overflow-y-auto overscroll-contain border-t border-white/5 px-6 pb-6 [-webkit-overflow-scrolling:touch] md:hidden"
        >
          <ul className="flex flex-col gap-1 pt-4">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-3 font-sans text-base font-medium text-kireo-light hover:bg-white/5"
                >
                  {link.label}
                </Link>
              </li>
            ))}

            <li>
              <button
                type="button"
                onClick={() => setAreeOpenMobile((v) => !v)}
                aria-expanded={areeOpenMobile}
                className="flex w-full items-center justify-between rounded-lg px-2 py-3 font-sans text-base font-medium text-kireo-light hover:bg-white/5"
              >
                Aree di orientamento
                <ChevronIcon open={areeOpenMobile} />
              </button>
              {areeOpenMobile && (
                <ul className="mt-1 space-y-1 pb-2 pl-4">
                  {AREE.map((area) => (
                    <li key={area.slug}>
                      <Link
                        href={`/aree/${area.slug}`}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-2 py-2 font-sans text-sm text-kireo-light/90 hover:bg-white/5"
                      >
                        {area.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

            <li>
              <Link
                href="/news"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2 py-3 font-sans text-base font-medium text-kireo-light hover:bg-white/5"
              >
                News
              </Link>
            </li>

            <li>
              <Link
                href="/contatti"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2 py-3 font-sans text-base font-medium text-kireo-light hover:bg-white/5"
              >
                Contatti
              </Link>
            </li>
          </ul>
          <div className="mt-4 flex flex-col gap-3">
            {user === undefined ? null : user ? (
              <>
                <Link
                  href="/app"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg px-2 py-3 text-center font-sans text-base font-medium text-kireo-light hover:bg-white/5"
                >
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-kireo-green/20 font-heading text-xs font-bold text-kireo-green-light">
                    {inizialiUtente(user)}
                  </span>
                  La mia area
                </Link>
                <Button type="button" variant="outline" className="w-full" onClick={handleLogout}>
                  Esci
                </Button>
              </>
            ) : (
              <>
                <Link
                  href="/accedi"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-3 text-center font-sans text-base font-medium text-kireo-light hover:bg-white/5"
                >
                  Accedi
                </Link>
                <ButtonLink href="/registrazione" variant="primary" className="w-full">
                  Inizia ora
                </ButtonLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
