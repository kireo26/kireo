"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { ButtonLink } from "./Button";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/come-funziona", label: "Come funziona" },
  { href: "/per-le-scuole", label: "Per le scuole" },
  { href: "/per-le-istituzioni", label: "Per le istituzioni" },
  { href: "/per-i-docenti", label: "Per i docenti" },
  { href: "/contatti", label: "Contatti" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-kireo-dark/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
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
        </nav>

        <div className="hidden md:block">
          <ButtonLink href="/" variant="primary">
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
          className="border-t border-white/5 px-6 pb-6 md:hidden"
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
          </ul>
          <div className="mt-4">
            <ButtonLink href="/" variant="primary" className="w-full">
              Inizia ora
            </ButtonLink>
          </div>
        </nav>
      )}
    </header>
  );
}
