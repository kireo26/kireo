import Link from "next/link";
import type { Restituzione } from "@/lib/escape/restituzione";

// Esito trasparente della missione (v2): non un riassunto, ma una restituzione
// in quattro momenti (cosa hai costruito / come hai deciso / le occasioni / le
// ipotesi), tutta in linguaggio ipotetico. Le aree mostrano i 4 punteggi
// aggregati 0-100, MAI i numeri grezzi valore/peso delle singole prove.

export type AreaEsito = {
  slug: string;
  nome: string;
  status: "emergente" | "confermata" | "da_verificare";
  interest: number;
  performance: number;
  self_efficacy: number;
  curiosity: number;
};

const STATUS_LABEL: Record<AreaEsito["status"], { testo: string; classe: string }> = {
  emergente: { testo: "Ipotesi che sta emergendo", classe: "border-white/15 text-kireo-muted" },
  confermata: { testo: "Ipotesi che si va confermando", classe: "border-kireo-green/40 text-kireo-green-light" },
  da_verificare: { testo: "Da verificare — segnali contrastanti", classe: "border-kireo-orange/40 text-kireo-orange" },
};

const DIMENSIONI: { chiave: keyof Pick<AreaEsito, "interest" | "performance" | "self_efficacy" | "curiosity">; label: string }[] = [
  { chiave: "interest", label: "Interesse" },
  { chiave: "performance", label: "Bravura" },
  { chiave: "self_efficacy", label: "Fiducia in te" },
  { chiave: "curiosity", label: "Curiosità" },
];

function Barra({ label, valore }: { label: string; valore: number }) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-kireo-muted">{label}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-kireo-green" style={{ width: `${valore}%` }} />
      </div>
    </div>
  );
}

function Blocco({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h3 className="font-heading text-base font-semibold text-kireo-light">{titolo}</h3>
      <div className="mt-2 text-sm leading-relaxed text-kireo-light/90">{children}</div>
    </div>
  );
}

export default function EsitoMissione({
  titolo,
  restituzione,
  aree,
  motivazioni,
}: {
  titolo: string;
  restituzione: Restituzione;
  aree: AreaEsito[];
  motivazioni: string[];
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">La proposta è partita</h2>
        <p className="mt-1 text-sm text-kireo-muted">
          Ecco cosa abbiamo notato in «{titolo}» — sono <strong>ipotesi</strong>, non un giudizio. Più missioni fai, più diventano nitide.
        </p>
      </div>

      {restituzione.costruito && <Blocco titolo="Cosa hai costruito">{restituzione.costruito}</Blocco>}
      {restituzione.metodo && <Blocco titolo="Come hai deciso">{restituzione.metodo}</Blocco>}

      {restituzione.occasioni.length > 0 && (
        <Blocco titolo="Le occasioni">
          <ul className="space-y-2">
            {restituzione.occasioni.map((o, i) => (
              <li key={i} className="rounded-lg bg-white/5 px-3 py-2">{o}</li>
            ))}
          </ul>
        </Blocco>
      )}

      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
        <h3 className="font-heading text-base font-semibold text-kireo-light">Le ipotesi</h3>
        {restituzione.ipotesi && <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">{restituzione.ipotesi}</p>}
        {aree.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessun segnale d&apos;area registrato per questa missione.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {aree.map((a) => (
              <div key={a.slug} className="rounded-2xl border border-white/5 bg-kireo-dark p-5">
                <h4 className="font-heading text-base font-semibold text-kireo-light">{a.nome}</h4>
                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] ${STATUS_LABEL[a.status].classe}`}>{STATUS_LABEL[a.status].testo}</span>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {DIMENSIONI.map((d) => (
                    <Barra key={d.chiave} label={d.label} valore={a[d.chiave]} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {restituzione.notaVerifica && (
          <p className="mt-4 rounded-lg border border-kireo-orange/30 bg-kireo-orange/5 px-3 py-2 text-sm text-kireo-light/90">{restituzione.notaVerifica}</p>
        )}
      </div>

      {motivazioni.length > 0 && (
        <details className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <summary className="cursor-pointer font-heading text-base font-semibold text-kireo-light">Perché lo diciamo</summary>
          <ul className="mt-3 space-y-2 text-sm text-kireo-light/90">
            {motivazioni.map((m, i) => (
              <li key={i} className="rounded-lg bg-white/5 px-3 py-2">{m}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/app/escape" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">
          Torna alle missioni
        </Link>
        <Link href="/app" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">
          Vai al tuo profilo
        </Link>
      </div>
    </div>
  );
}
