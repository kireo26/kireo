import Link from "next/link";

// Esito del test: le 3-5 aree emerse, in linguaggio ipotetico e con le
// motivazioni leggibili, MAI i punteggi grezzi (stessa regola delle missioni).
// La formula sulla provvisorietà è obbligatoria e non negoziabile. Per ora il
// risultato non sblocca né nasconde niente: tutto resta visibile.

export type AreaEsitoTest = {
  slug: string;
  nome: string;
  status: "emergente" | "confermata" | "da_verificare";
  motivazioni: string[];
};

const STATUS_LABEL: Record<AreaEsitoTest["status"], { testo: string; classe: string }> = {
  emergente: { testo: "Ipotesi che sta emergendo", classe: "border-white/15 text-kireo-muted" },
  confermata: { testo: "Ipotesi che si va confermando", classe: "border-kireo-green/40 text-kireo-green-light" },
  da_verificare: { testo: "Da verificare — segnali contrastanti", classe: "border-kireo-orange/40 text-kireo-orange" },
};

export default function EsitoTest({ titolo, aree, prossima }: { titolo: string; aree: AreaEsitoTest[]; prossima: { cta: string; href: string } }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Le aree da cui parti</h2>
        <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">
          Da come hai risposto a «{titolo}», queste sono le aree verso cui sembri orientarti di più. È un&apos;ipotesi basata su come hai risposto oggi. Le missioni serviranno a capire se regge.
        </p>
      </div>

      {aree.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <p className="text-sm text-kireo-muted">
            Le tue risposte non hanno fatto emergere un&apos;area netta più delle altre — capita, e va benissimo. Esplora le aree di orientamento e prova una missione: da lì il quadro si fa più nitido.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {aree.map((a) => (
            <div key={a.slug} className="rounded-2xl border border-white/5 bg-kireo-card p-6">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-heading text-base font-semibold text-kireo-light">{a.nome}</h3>
                <Link href={`/aree/${a.slug}`} className="flex-none text-[11px] text-kireo-green-light hover:underline">Scopri →</Link>
              </div>
              <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] ${STATUS_LABEL[a.status].classe}`}>{STATUS_LABEL[a.status].testo}</span>
              {a.motivazioni.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm text-kireo-light/90">
                  {a.motivazioni.map((m, i) => (
                    <li key={i} className="rounded-lg bg-white/5 px-3 py-2">{m}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 px-4 py-3 text-sm text-kireo-light/90">
        È un&apos;ipotesi basata su come hai risposto oggi. Le missioni serviranno a capire se regge.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link href={prossima.href} className="rounded-full bg-kireo-green px-5 py-2 text-sm font-semibold text-white hover:bg-kireo-green-light">
          {prossima.cta} →
        </Link>
        <Link href="/app/aree" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">
          Esplora le aree
        </Link>
        <Link href="/app" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">
          Vai al tuo profilo
        </Link>
      </div>
    </div>
  );
}
