import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";

export default async function EnteStatistichePage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const [{ data: stats }, { data: statsEventi }] = await Promise.all([
    supabase.from("stats_istituzione").select("*").eq("istituzione_id", contesto.istituzioneId).maybeSingle(),
    supabase.from("stats_eventi_istituzione").select("*").eq("istituzione_id", contesto.istituzioneId).order("data_inizio", { ascending: false }),
  ]);

  const nessunDato =
    !stats ||
    (stats.studenti_nel_recinto === 0 &&
      stats.iscritti_newsletter === 0 &&
      stats.guide_pubblicate === 0 &&
      (!statsEventi || statsEventi.length === 0));

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Statistiche</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Le tue statistiche</h1>
        <p className="mt-2 text-sm text-kireo-muted">Dati in forma aggregata e anonima: nessun elenco di studenti, mai.</p>
      </div>

      {nessunDato ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non ci sono ancora interazioni da mostrare. Torna qui dopo aver pubblicato eventi e guide.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Studenti raggiunti", valore: stats?.studenti_nel_recinto ?? 0 },
              { label: "Iscritti newsletter", valore: stats?.iscritti_newsletter ?? 0 },
              { label: "Download guida", valore: stats?.download_guida ?? 0 },
              { label: "Guide pubblicate", valore: stats?.guide_pubblicate ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/5 bg-kireo-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{s.label}</p>
                <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">{s.valore}</p>
              </div>
            ))}
          </div>

          {statsEventi && statsEventi.length > 0 && (
            <div>
              <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Per evento</h2>
              <ul className="mt-4 space-y-3">
                {statsEventi.map((s) => (
                  <li key={s.evento_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
                    <div>
                      <p className="font-heading text-sm font-semibold text-kireo-light">{s.titolo}</p>
                      <p className="mt-1 text-xs text-kireo-muted">
                        {new Date(s.data_inizio).toLocaleDateString("it-IT", { dateStyle: "long" })}
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm text-kireo-light">
                      <span>{s.iscritti} iscritti</span>
                      <span>{s.partecipati} partecipati</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
