import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";

export default async function ScuolaStatistichePage() {
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const [{ data: stats }, { data: statsAree }] = await Promise.all([
    supabase.from("stats_scuola").select("studenti_verificati, partecipazioni_totali, ore_pcto_totali").eq("scuola_profilo_id", contesto.scuolaProfiloId).maybeSingle(),
    supabase.from("stats_scuola_aree").select("area_slug, partecipazioni").eq("scuola_profilo_id", contesto.scuolaProfiloId).order("partecipazioni", { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Statistiche</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">La tua scuola in numeri</h1>
        <p className="mt-2 text-kireo-muted">Dati in forma aggregata: nessun dettaglio individuale sui singoli studenti.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Studenti verificati</p>
          <p className="mt-1 font-heading text-3xl font-bold text-kireo-light">{stats?.studenti_verificati ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Partecipazioni certificate</p>
          <p className="mt-1 font-heading text-3xl font-bold text-kireo-light">{stats?.partecipazioni_totali ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Ore PCTO totali</p>
          <p className="mt-1 font-heading text-3xl font-bold text-kireo-light">{stats?.ore_pcto_totali ?? 0}</p>
        </div>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Distribuzione per area</h2>
        {!statsAree || statsAree.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Ancora nessuna partecipazione certificata da distribuire per area.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {statsAree.map((riga) => (
              <li key={riga.area_slug} className="flex items-center justify-between rounded-xl border border-white/5 bg-kireo-card p-4">
                <span className="text-sm text-kireo-light/90">{getAreaBySlug(riga.area_slug)?.nome ?? riga.area_slug}</span>
                <span className="font-heading text-sm font-semibold text-kireo-light">{riga.partecipazioni}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
