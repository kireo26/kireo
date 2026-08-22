import type { ProssimaTappa } from "@/lib/percorso/prossimaTappa";

// «Il tuo percorso»: indica il PASSO SUCCESSIVO CONSIGLIATO (guida → test →
// missioni → workshop). Consiglia, non impone — tutto resta aperto, questa è
// solo la prossima cosa suggerita. Componente presentazionale: il testo (i sette
// stati) è deciso a monte da getProssimaTappa, l'unica fonte di verità dello
// stato del percorso.
export default function CardProssimaTappa({ tappa }: { tappa: ProssimaTappa }) {
  return (
    <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-card p-6">
      <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Il tuo percorso</p>
      <p className="text-sm leading-relaxed text-kireo-light/90">{tappa.testo}</p>
    </div>
  );
}
