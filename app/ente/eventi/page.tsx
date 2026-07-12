import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import CreaEventoForm from "@/components/ente/CreaEventoForm";

const ETICHETTA_STATO: Record<string, { label: string; classe: string }> = {
  bozza: { label: "Bozza", classe: "bg-white/10 text-kireo-light" },
  in_approvazione: { label: "In approvazione", classe: "bg-kireo-orange/15 text-kireo-orange" },
  approvato: { label: "Approvato", classe: "bg-kireo-green/15 text-kireo-green-light" },
  rifiutato: { label: "Rifiutato", classe: "bg-red-500/15 text-red-300" },
};

export default async function EnteEventiPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const { data: eventi } = await supabase
    .from("eventi")
    .select("id, titolo, tipo, data_inizio, stato")
    .eq("organizzatore_id", contesto.istituzioneId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Eventi</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">I tuoi eventi</h1>
      </div>

      {!eventi || eventi.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non hai ancora proposto nessun evento. Crea il primo qui sotto.
        </div>
      ) : (
        <ul className="space-y-3">
          {eventi.map((e) => {
            const stato = ETICHETTA_STATO[e.stato] ?? ETICHETTA_STATO.bozza;
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4">
                <div>
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stato.classe}`}>
                    {stato.label}
                  </span>
                  <span className="font-heading text-sm font-semibold text-kireo-light">{e.titolo}</span>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {new Date(e.data_inizio).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Proponi un nuovo evento</h2>
        <div className="mt-4">
          <CreaEventoForm istituzioneId={contesto.istituzioneId} />
        </div>
      </div>
    </div>
  );
}
