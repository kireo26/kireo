"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { ButtonLink } from "./Button";
import { AREE } from "@/data/aree";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/per-gli-studenti", label: "Per gli studenti" },
  { href: "/per-le-scuole", label: "Per le scuole" },
  { href: "/per-i-docenti", label: "Per i docenti" },
];

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
  const [open, setOpen] = useState(false);
  const [areeOpen, setAreeOpen] = useState(false);
  const [areeOpenMobile, setAreeOpenMobile] = useState(false);
  const areeRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (areeRef.current && !areeRef.current.contains(e.target as Node)) {
        setAreeOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAreeOpen(false);
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
            href="/contatti"
            className="font-sans text-sm font-medium text-kireo-light/90 transition-colors hover:text-kireo-orange"
          >
            Contatti
          </Link>
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/accedi"
            className="font-sans text-sm font-medium text-kireo-light/90 transition-colors hover:text-kireo-orange"
          >
            Accedi
          </Link>
          <ButtonLink href="/registrazione" variant="primary">
            Inizia ora
          </ButtonLink>
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
                href="/contatti"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2 py-3 font-sans text-base font-medium text-kireo-light hover:bg-white/5"
              >
                Contatti
              </Link>
            </li>
          </ul>
          <div className="mt-4 flex flex-col gap-3">
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
          </div>
        </nav>
      )}
    </header>
  );
}
