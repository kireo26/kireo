import { ButtonLink } from "@/components/Button";

export default function CardProssimaTappa() {
  return (
    <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-card p-6">
      <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">La tua prossima tappa</p>
      <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">Tappa 1 — Scopri chi sei</h2>
      <p className="mt-2 text-sm text-kireo-muted">Il test arriva a settembre — intanto esplora le tue aree.</p>
      <ButtonLink href="/app/aree" variant="primary" className="mt-4">
        Esplora le aree
      </ButtonLink>
    </div>
  );
}
