import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { getPassoCorrente } from "@/lib/percorso/passoCorrente";
import { APERTURA_PERCORSO, CHIUSURA_PERCORSO, TITOLO_PERCORSO, passiConProsa } from "@/lib/percorso/testoPercorso";

// La pagina che racconta il percorso: cinque passi, in fila, con la prosa che
// spiega cos'è ciascuno.
//
// L'ELENCO E L'ORDINE VENGONO DA `PASSI_PERCORSO`, la stessa costante che ordina
// la barra laterale. La prosa viene da `testoPercorso.ts`. Qui non c'è nessun
// elenco scritto a mano: questa pagina e la barra non possono dire due cose
// diverse su quali passi ci sono e in che ordine.
//
// E NON NOMINA NESSUNA SOGLIA. Le condizioni le dicono le pagine di ciascun
// passo, generate dalla regola vera — vedi il blocco in testa a
// `testoPercorso.ts` per il perché, e `npm run test:percorsopagina` per la
// guardia che lo pretende.
export default async function PaginaPercorso() {
  const contesto = await getAppContext();
  const { chiave, tappa } = await getPassoCorrente(contesto.userId);
  const passi = passiConProsa();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="py-0.5 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">{TITOLO_PERCORSO}</h1>
        <p className="mt-3 max-w-2xl text-kireo-light/90">{APERTURA_PERCORSO}</p>
      </header>

      <ol className="space-y-4">
        {passi.map((passo) => {
          const eIlPasso = passo.chiave === chiave;
          return (
            <li key={passo.chiave}>
              <Link
                href={passo.href}
                className={`block rounded-2xl border p-5 transition-colors ${
                  eIlPasso ? "border-kireo-orange/50 bg-kireo-card" : "border-white/10 bg-kireo-card hover:border-white/20"
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={`flex-none font-heading text-sm font-bold ${eIlPasso ? "text-kireo-orange" : "text-kireo-muted"}`}
                    aria-hidden="true"
                  >
                    {passo.numero}
                  </span>
                  <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{passo.titolo}</h2>
                  {eIlPasso && (
                    <span className="ml-auto flex-none rounded-full bg-kireo-orange/15 px-2.5 py-1 text-[11px] font-semibold text-kireo-orange">
                      sei qui
                    </span>
                  )}
                </div>
                <p className="mt-2 pl-7 text-sm text-kireo-light/80">{passo.testo}</p>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="max-w-2xl text-sm text-kireo-muted">{CHIUSURA_PERCORSO}</p>

      {/* Il passo successivo con il suo bottone: è l'unica cosa in pagina che
          dipende da dove sta QUESTO studente, e viene da `prossimaTappa` — la
          stessa fonte della card della home, non una seconda regola. */}
      {tappa && (
        <div className="rounded-2xl border border-white/10 bg-kireo-card p-5">
          <p className="text-sm text-kireo-light">{tappa.testo}</p>
          <Link
            href={tappa.href}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-kireo-green px-5 py-2.5 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
          >
            {tappa.cta}
          </Link>
        </div>
      )}
    </div>
  );
}
