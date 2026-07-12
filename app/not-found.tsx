import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";

export const metadata: Metadata = {
  title: "Pagina non trovata — KIREO",
};

// Nota: la geometria della bussola è duplicata anche in components/Logo.tsx,
// app/icon.svg e app/apple-icon.tsx. Se cambia lì, aggiornarla anche qui.
export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center sm:pt-32">
      <svg viewBox="0 0 80 80" aria-hidden="true" className="h-20 w-20">
        <g transform="translate(40,40)">
          <circle
            cx="0"
            cy="0"
            r="33"
            fill="none"
            stroke="#2FA57B"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray="165 42.3"
            transform="rotate(-118)"
          />
          <g transform="rotate(40)">
            <path d="M 0,-18 L 9,8 L 0,3 L -9,8 Z" fill="#EF9F27" />
          </g>
        </g>
      </svg>

      <p className="mb-4 mt-8 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Errore 404</p>
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
        Questa pagina non esiste — ma la tua direzione sì
      </h1>
      <p className="mt-4 text-lg text-kireo-muted">
        Il link che hai seguito potrebbe essere sbagliato o non più disponibile. Ripartiamo da qui.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" variant="primary">
          Torna alla Home
        </ButtonLink>
        <ButtonLink href="/per-gli-studenti" variant="outline">
          Scopri le Aree di orientamento
        </ButtonLink>
      </div>
    </section>
  );
}
