import Link from "next/link";
import { T, riquadriIndice } from "@/lib/ente/statistiche";
import { caricaStatisticheEnte } from "@/lib/ente/caricaStatistiche";
import { NonLetto } from "@/components/ente/statistiche/Parti";

// L'INDICE DELLE STATISTICHE (29/10, Mario): quattro riquadri e nient'altro.
// La pagina di prima cominciava con un elenco di dieci eventi, e una pagina che
// comincia con un elenco chiede di leggere prima di sapere se vale la pena
// leggere. Il dettaglio sta nelle quattro sezioni, ognuna con il ritorno qui.
// I numeri dei riquadri vengono da `riquadriIndice`, sullo stesso oggetto che le
// sezioni mostrano (`caricaStatisticheEnte`, una lettura sola).
export default async function EnteStatistichePage() {
  const stats = await caricaStatisticheEnte();
  // Non letto non è zero (27/10): con una lettura fallita la pagina non dice
  // niente sugli studenti, perché non li abbiamo guardati.
  const nonLetto = stats === null;

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Statistiche</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Le tue statistiche</h1>
        {/*
          La frase sull'anonimato sta sull'indice e non in una sezione: vale per
          tutta la pagina, e chi arriva la legge prima di entrare da qualche
          parte (Mario, 29/10). La frase di prima («nessun elenco di studenti,
          mai») era falsa da quando esistono gli Interessati: qui niente nomi,
          sotto i 5 un gruppo non si mostra da solo, e i nomi stanno altrove,
          solo per chi li ha dati.
        */}
        <p className="mt-2 text-sm text-kireo-muted">{T.cima}</p>
      </div>

      {nonLetto ? (
        <NonLetto />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {riquadriIndice(stats).map((r) => (
            <Link
              key={r.chiave}
              href={r.href}
              className="block rounded-2xl border border-white/5 bg-kireo-card p-5 transition-colors hover:border-kireo-green/40"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">{r.titolo}</p>
              <p className="mt-3 font-heading text-3xl font-bold text-kireo-light">{r.valore}</p>
              <p className="text-sm text-kireo-light">{r.etichetta}</p>
              <p className="mt-2 text-xs text-kireo-muted">{r.sotto}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
