import { T } from "@/lib/ente/statistiche";
import { sottoDownloadGuida } from "@/lib/ente/guida";
import { caricaStatisticheEnte } from "@/lib/ente/caricaStatistiche";
import { NonLetto, Riquadro, TestaSezione } from "@/components/ente/statistiche/Parti";

// La sezione Guide. Due numeri distinti (Mario, 29/10): gli scaricamenti, tutti,
// anche di chi non ha fatto l'accesso (un contatore senza identità,
// `contatore_scaricamenti_guide`), e gli studenti iscritti a KIREO che le hanno
// scaricate, una volta ciascuno (`scaricamenti_guide_enti`). Tutti e due dalla
// data di `inizio_conteggio_download_guide()`: quelli di prima non sono stati
// registrati, e la riga sotto lo dice. Il dettaglio comprende le guide
// archiviate, con il loro periodo.
export default async function StatisticheGuidePage() {
  const stats = await caricaStatisticheEnte();
  return (
    <div className="space-y-8">
      <TestaSezione titolo={T.guide.titolo} />
      {stats === null ? (
        <NonLetto />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Riquadro etichetta="Scaricamenti delle tue guide" valore={stats.guide.scaricamenti} sotto={sottoDownloadGuida(stats.guide.contati_dal)} />
            <Riquadro etichetta="Scaricamenti questo mese" valore={stats.guide.scaricamenti_mese} />
          </div>
          <p className="text-sm text-kireo-light">{T.guide.riepilogo(stats.guide.scaricamenti, stats.guide.studenti)}</p>
          <p className="text-xs text-kireo-muted">{T.guide.spiega}</p>
          {stats.guide.per_guida.length === 0 ? (
            <p className="text-sm text-kireo-muted">{T.guide.nessuna}</p>
          ) : (
            <ul className="space-y-3">
              {stats.guide.per_guida.map((g) => (
                <li key={g.guida_id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">{g.titolo}</p>
                  <p className="mt-1 text-xs text-kireo-muted">{T.guide.periodo(g)}</p>
                  <p className="mt-2 text-sm text-kireo-light">{T.guide.riga(g)}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
