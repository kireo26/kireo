import Link from "next/link";

// Esito di T3 «Più a fondo»: l'ordine definitivo tra le aree candidate (dal
// torneo), in linguaggio ipotetico e senza numeri grezzi, più il PONTE alla
// missione più coerente — che NOMINA, non impone (i cancelli sono la Fase 4:
// tutto resta visibile e giocabile). La formula di provvisorietà è obbligatoria.

export type RigaEsitoT3 = {
  slug: string;
  nome: string;
  status: "emergente" | "confermata" | "da_verificare";
  // La motivazione del confronto vinto (perché quest'area è finita qui). Assente
  // se l'area non ha vinto nessun incontro (T3 alza, non abbassa).
  motivazione?: string;
};

const STATUS_LABEL: Record<RigaEsitoT3["status"], { testo: string; classe: string }> = {
  emergente: { testo: "Ipotesi che sta emergendo", classe: "border-white/15 text-kireo-muted" },
  confermata: { testo: "Ipotesi che si va confermando", classe: "border-kireo-green/40 text-kireo-green-light" },
  da_verificare: { testo: "Da verificare — segnali contrastanti", classe: "border-kireo-orange/40 text-kireo-orange" },
};

export default function EsitoT3({ righe, missione }: { righe: RigaEsitoT3[]; missione: { slug: string; titolo: string } | null }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Messe una contro l&apos;altra</h2>
        <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">
          Hai scelto tra cose che ti attiravano entrambe. Da quelle rinunce è venuto fuori quest&apos;ordine tra le tue aree. È un&apos;ipotesi basata su come hai risposto oggi. Le missioni serviranno a capire se regge.
        </p>
      </div>

      {righe.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <p className="text-sm text-kireo-muted">
            I confronti non hanno fatto emergere un ordine netto — capita. Prova una missione: mettersi in gioco dice più di una scelta a tavolino.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {righe.map((r, i) => (
            <li key={r.slug} className="flex items-start gap-4 rounded-2xl border border-white/5 bg-kireo-card p-5">
              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/5 font-heading text-sm font-semibold text-kireo-light">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-base font-semibold text-kireo-light">{r.nome}</h3>
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${STATUS_LABEL[r.status].classe}`}>{STATUS_LABEL[r.status].testo}</span>
                </div>
                {r.motivazione && <p className="mt-2 text-sm leading-relaxed text-kireo-light/80">{r.motivazione}</p>}
              </div>
              <Link href={`/aree/${r.slug}`} className="mt-0.5 flex-none text-[11px] text-kireo-green-light hover:underline">Scopri →</Link>
            </li>
          ))}
        </ol>
      )}

      <p className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 px-4 py-3 text-sm text-kireo-light/90">
        È un&apos;ipotesi basata su come hai risposto oggi. Le missioni serviranno a capire se regge.
      </p>

      {/* Il ponte alla missione: nomina, non impone. Nessun cancello (Fase 4). */}
      {missione && (
        <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Da qui, dove provare</h2>
          <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">
            La missione che ti somiglia di più è <strong className="font-semibold text-kireo-light">«{missione.titolo}»</strong>. Provala, e vediamo se l&apos;ipotesi regge. Non sei obbligato: le altre restano tutte aperte.
          </p>
          <div className="mt-4">
            <Link href={`/app/escape/${missione.slug}`} className="inline-block rounded-full bg-kireo-green px-5 py-2 text-sm font-semibold text-white hover:bg-kireo-green-light">
              Vai alla missione →
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/app/escape" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">
          Tutte le missioni
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
