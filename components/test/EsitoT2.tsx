import Link from "next/link";
import type { AsseStile } from "@/lib/escape/tipi";
import type { Profilo } from "@/lib/test/profili";

// Esito di T2 «Come ti muovi»: il profilo di stile come IPOTESI, mai un verdetto.
// Quattro blocchi: come ti sei mosso (profilo + formula), le quattro dimensioni
// (barre relative, MAI un numero a schermo), il punto cieco (prezzo di una
// qualità), il perché lo diciamo (a scomparsa, motivazioni per dimensione). In
// più, se emerge, il blocco della divergenza test↔missioni (tono mai colpevole).
//
// Regola di linguaggio non negoziabile: mai «sei un…», sempre «ti sei mosso
// da…»; la formula sulla provvisorietà è obbligatoria.

export const ETICHETTE_ASSE: Record<AsseStile, { nome: string; descrizione: string }> = {
  analitico: { nome: "Analitico", descrizione: "capire a fondo prima di decidere" },
  relazionale: { nome: "Relazionale", descrizione: "tenere le persone al centro" },
  creativo: { nome: "Creativo", descrizione: "aprire strade nuove" },
  operativo: { nome: "Operativo", descrizione: "portare le cose a destinazione" },
};

export type AsseEsito = { asse: AsseStile; valore: number };
export type SpiegazioneAsse = { asse: AsseStile; motivazioni: string[] };
export type Divergenza = { asseTest: AsseStile; asseMissioni: AsseStile } | null;

export default function EsitoT2({
  profilo,
  assi,
  spiegazioni,
  divergenza,
  prossima,
}: {
  profilo: Profilo;
  assi: AsseEsito[];
  spiegazioni: SpiegazioneAsse[];
  divergenza: Divergenza;
  prossima: { cta: string; href: string };
}) {
  const max = Math.max(1, ...assi.map((a) => a.valore));
  const ordinati = [...assi].sort((a, b) => b.valore - a.valore);

  return (
    <div className="space-y-5">
      {/* 1 — Come ti sei mosso */}
      <div className="rounded-2xl border border-kireo-green/30 bg-kireo-green/5 p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Come ti sei mosso</h2>
        <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">
          Da come ti muovi finora, nei test e nelle missioni, ti sei mosso da <strong className="font-semibold text-kireo-light">{profilo.nome}</strong>. {profilo.comeTiMuovi}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-kireo-light/70">
          È un&apos;ipotesi basata su come hai risposto oggi. Le missioni serviranno a capire se regge.
        </p>
      </div>

      {/* 2 — Le quattro dimensioni (barre relative, nessun numero) */}
      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Le quattro dimensioni</h2>
        <p className="mt-1 text-sm text-kireo-muted">Non sono voti: raccontano solo verso cosa hai teso di più, oggi.</p>
        <div className="mt-5 space-y-4">
          {ordinati.map((a) => (
            <div key={a.asse}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-kireo-light">{ETICHETTE_ASSE[a.asse].nome}</span>
                <span className="text-xs text-kireo-muted">{ETICHETTE_ASSE[a.asse].descrizione}</span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-kireo-green" style={{ width: `${Math.round((a.valore / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 — Il punto cieco */}
      <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-6 sm:p-8">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Il tuo punto cieco</h2>
        <p className="mt-2 text-sm leading-relaxed text-kireo-light/90">{profilo.puntoCieco}</p>
      </div>

      {/* Blocco divergenza test↔missioni (solo se emerge) — mai colpevole */}
      {divergenza && (
        <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-6 sm:p-8">
          <span className="inline-block rounded-full border border-kireo-orange/40 px-2 py-0.5 text-[11px] text-kireo-orange">Da verificare</span>
          <p className="mt-3 text-sm leading-relaxed text-kireo-light/90">
            Nel test ti sei mosso soprattutto in modo <strong className="font-semibold text-kireo-light">{ETICHETTE_ASSE[divergenza.asseTest].nome.toLowerCase()}</strong>, ma nelle missioni che hai fatto finora è emerso di più il lato <strong className="font-semibold text-kireo-light">{ETICHETTE_ASSE[divergenza.asseMissioni].nome.toLowerCase()}</strong>.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-kireo-light/70">
            Non è una contraddizione da correggere: il modo in cui rispondi a mente fredda e quello con cui agisci davanti a un problema vero possono raccontare due lati dello stesso te. Le prossime missioni aiuteranno a capire quale pesa di più — senza fretta.
          </p>
        </div>
      )}

      {/* 4 — Perché lo diciamo (a scomparsa) */}
      {spiegazioni.some((s) => s.motivazioni.length > 0) && (
        <details className="group rounded-2xl border border-white/5 bg-kireo-card p-6">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-kireo-light">
            Perché lo diciamo
            <span className="text-kireo-muted transition group-open:rotate-180">▾</span>
          </summary>
          <p className="mt-3 text-xs text-kireo-muted">Ogni ipotesi nasce da come hai risposto. Ecco i passaggi che l&apos;hanno fatta emergere.</p>
          <div className="mt-4 space-y-4">
            {spiegazioni
              .filter((s) => s.motivazioni.length > 0)
              .map((s) => (
                <div key={s.asse}>
                  <h3 className="text-sm font-semibold text-kireo-light">{ETICHETTE_ASSE[s.asse].nome}</h3>
                  <ul className="mt-2 space-y-2 text-sm text-kireo-light/90">
                    {s.motivazioni.map((m, i) => (
                      <li key={i} className="rounded-lg bg-white/5 px-3 py-2">{m}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </details>
      )}

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
