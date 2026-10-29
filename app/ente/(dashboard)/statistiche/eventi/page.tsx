import { T } from "@/lib/ente/statistiche";
import { caricaStatisticheEnte } from "@/lib/ente/caricaStatistiche";
import { NonLetto, Riquadro, RigaEvento, TestaSezione } from "@/components/ente/statistiche/Parti";

// La sezione Eventi delle statistiche: i totali, poi gli elenchi divisi fra in
// programma e passati. Stessa lettura dell'indice (`caricaStatisticheEnte`).
export default async function StatisticheEventiPage() {
  const stats = await caricaStatisticheEnte();
  return (
    <div className="space-y-8">
      <TestaSezione titolo={T.eventi.titolo} />
      {stats === null ? (
        <NonLetto />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Riquadro etichetta="In programma" valore={stats.eventi.in_programma} />
            <Riquadro etichetta="Passati" valore={stats.eventi.passati} />
            <Riquadro etichetta="Iscritti" valore={stats.eventi.iscritti} />
            <Riquadro etichetta="Collegati alle dirette" valore={stats.eventi.collegati} />
            <Riquadro etichetta="Con presenza certificata" valore={stats.eventi.certificate} />
          </div>
          {stats.eventi.iscritti_dirette_finite > 0 && (
            <p className="text-sm text-kireo-muted">{T.eventi.collegatiSuIscritti(stats.eventi.iscritti_collegati, stats.eventi.iscritti_dirette_finite)}</p>
          )}
          {stats.eventi.permanenza_media_pct != null && stats.eventi.permanenza_su > 0 && (
            <p className="text-sm text-kireo-muted">{T.eventi.permanenza(stats.eventi.permanenza_media_pct, stats.eventi.permanenza_su)}</p>
          )}
          {(
            [
              [T.eventi.inProgramma, stats.eventi.lista.filter((e) => !e.passato).reverse(), T.eventi.nessunoInProgramma],
              [T.eventi.passati, stats.eventi.lista.filter((e) => e.passato), T.eventi.nessunoPassato],
            ] as const
          ).map(([titolo, lista, vuoto]) => (
            <div key={titolo}>
              <h2 className="font-heading text-lg font-semibold text-kireo-light">{titolo}</h2>
              {lista.length === 0 ? (
                <p className="mt-2 text-sm text-kireo-muted">{vuoto}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {lista.map((s) => (
                    <RigaEvento key={s.evento_id} s={s} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
