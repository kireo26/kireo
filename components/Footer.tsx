import Link from "next/link";
import Logo from "./Logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/come-funziona", label: "Come funziona" },
  { href: "/per-le-scuole", label: "Per le scuole" },
  { href: "/contatti", label: "Contatti" },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-kireo-dark">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 py-0.5 font-heading text-lg leading-[1.25] text-kireo-light">
              Orientamento. Direzione. Futuro.
            </p>
            <p className="mt-2 text-sm text-kireo-muted">
              KIREO connette studenti diplomandi con università, ITS Academy, accademie e corsi
              professionalizzanti in tutta Italia.
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-kireo-muted">
                Naviga
              </h3>
              <ul className="mt-4 space-y-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-kireo-light/90 hover:text-kireo-orange"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-kireo-muted">
                Legale
              </h3>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="/privacy" className="text-sm text-kireo-light/90 hover:text-kireo-orange">
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 text-xs text-kireo-muted">
          © {new Date().getFullYear()} KIREO. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
}
