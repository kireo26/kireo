import Link from "next/link";

// Esito trasparente della missione: profilo AGGREGATO (i punteggi 0-100 delle
// 4 dimensioni) + le motivazioni leggibili delle prove. MAI i numeri grezzi
// valore/peso delle singole prove (decisione anti-gaming). Linguaggio sempre
// ipotetico: sono ipotesi, non verdetti.

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

export default function EsitoMissione({ titolo, aree, motivazioni }: { titolo: string; aree: AreaEsito[]; motivazioni: string[] }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Missione completata</h2>
        <p className="mt-1 text-sm text-kireo-muted">
          Ecco cosa abbiamo notato in «{titolo}» — sono <strong>ipotesi</strong>, non un giudizio. Puoi rimetterle in discussione, e più missioni fai più diventano nitide.
        </p>
      </div>

      {aree.length === 0 ? (
        <p className="text-sm text-kireo-muted">Nessun segnale d&apos;area registrato per questa missione.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {aree.map((a) => (
            <div key={a.slug} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-base font-semibold text-kireo-light">{a.nome}</h3>
              </div>
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

      {motivazioni.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <h3 className="font-heading text-base font-semibold text-kireo-light">Perché lo diciamo</h3>
          <ul className="mt-3 space-y-2 text-sm text-kireo-light/90">
            {motivazioni.map((m, i) => (
              <li key={i} className="rounded-lg bg-white/5 px-3 py-2">{m}</li>
            ))}
          </ul>
        </div>
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
