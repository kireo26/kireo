import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getProssimiEventi, getEventiPassati, getAreeDegliEventi, getIscrizioniStudenteConOrigine } from "@/lib/app/eventi";
import ListaEventiProssimi from "@/components/app/ListaEventiProssimi";

export default async function AgendaAppPage() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const [prossimi, passati, iscrizioni] = await Promise.all([
    getProssimiEventi(supabase),
    getEventiPassati(supabase),
    getIscrizioniStudenteConOrigine(supabase, contesto.userId),
  ]);
  const areeDegliEventi = await getAreeDegliEventi(
    supabase,
    [...prossimi, ...passati].map((e) => e.id),
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Agenda</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">I prossimi eventi</h1>
        <p className="mt-2 text-kireo-muted">
          Webinar, workshop e incontri di orientamento, per esplorare da vicino le aree che ti interessano.
        </p>
      </div>

      {prossimi.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center">
          <p className="text-kireo-muted">Il calendario si sta riempiendo. Torna a trovarci presto.</p>
        </div>
      ) : (
        <ListaEventiProssimi eventi={prossimi} areeDegliEventi={areeDegliEventi} iscrizioni={iscrizioni} userId={contesto.userId} />
      )}

      {passati.length > 0 && (
        <div>
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Eventi passati</h2>
          <ul className="mt-4 space-y-3">
            {passati.map((e) => (
              <li key={e.id} className="rounded-xl border border-white/5 bg-kireo-card/60 p-4 opacity-70">
                <p className="font-heading text-sm font-semibold text-kireo-light">{e.titolo}</p>
                <p className="mt-1 text-xs text-kireo-muted">
                  {new Date(e.data_inizio).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
