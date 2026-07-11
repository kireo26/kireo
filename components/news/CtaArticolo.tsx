import { ButtonLink } from "@/components/Button";
import type { NewsCategoria } from "@/lib/news";

// Un solo blocco CTA per articolo (vedi CLAUDE.md, "Linea editoriale
// News"): contestuale alla categoria. "kireo" (novità della piattaforma)
// non ha un target specifico indicato, ricade sulla CTA studenti.
const CTA_PER_CATEGORIA: Record<NewsCategoria, { titolo: string; testo: string; cta: string; href: string }> = {
  studenti: {
    titolo: "Scopri la tua direzione",
    testo: "Test attitudinali, guide per area e un percorso di orientamento personalizzato: gratuito, sempre.",
    cta: "Inizia il tuo percorso di orientamento",
    href: "/registrazione",
  },
  scuola: {
    titolo: "Il PCTO che si gestisce da solo",
    testo: "Un servizio di orientamento certificato e gratuito per la tua scuola, con giustificativi automatici.",
    cta: "Scopri il servizio per la tua scuola",
    href: "/per-le-scuole",
  },
  kireo: {
    titolo: "Scopri la tua direzione",
    testo: "Test attitudinali, guide per area e un percorso di orientamento personalizzato: gratuito, sempre.",
    cta: "Inizia il tuo percorso di orientamento",
    href: "/registrazione",
  },
};

export default function CtaArticolo({ categoria }: { categoria: NewsCategoria }) {
  const { titolo, testo, cta, href } = CTA_PER_CATEGORIA[categoria];

  return (
    <div className="not-prose my-12 rounded-2xl border border-kireo-green/30 bg-kireo-card p-8 text-center">
      <h2 className="py-0.5 font-heading text-xl font-bold leading-[1.25] text-kireo-light">{titolo}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-kireo-muted">{testo}</p>
      <div className="mt-6">
        <ButtonLink href={href} variant="primary">
          {cta}
        </ButtonLink>
      </div>
    </div>
  );
}
