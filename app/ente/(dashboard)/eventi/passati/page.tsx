import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import RigaEventoEnte from "@/components/ente/RigaEventoEnte";
import { caricaCertificatiDocenti, caricaEventiEnte } from "@/lib/ente/caricaEventiEnte";
import { areaEventoEnte, dividiEventiEnte, esitoEventoPassato } from "@/lib/ente/eventiEnte";

// EVENTI PASSATI (Mario, 27/10): gli stessi campi della programmazione, dal più
// recente, più una riga su com'è andata (`esitoEventoPassato`). Niente ore: le
// ore di un incontro passato le dice la pagina dell'evento, e un'etichetta qui
// si leggerebbe come «quante ne hanno avute i ragazzi», che non è.
export default async function EnteEventiPassatiPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();
  const { eventi, aree, letturaFallita } = await caricaEventiEnte(supabase, contesto.istituzioneId);
  const { passati } = dividiEventiEnte(eventi);
  const docenti = passati.filter((e) => e.pubblico === "docenti" && e.tipo !== "webinar" && e.stato === "approvato").map((e) => e.id);
  const certificati = await caricaCertificatiDocenti(supabase, docenti);

  if (letturaFallita) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-300">
        Non siamo riusciti a leggere i tuoi eventi: è un problema nostro. Ricarica la pagina fra un momento.
      </div>
    );
  }
  if (passati.length === 0) {
    return <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">Nessun evento passato.</div>;
  }
  return (
    <ul className="space-y-3">
      {passati.map((e) => (
        <RigaEventoEnte
          key={e.id}
          evento={e}
          area={areaEventoEnte(e, aree[e.id] ?? [])}
          esito={esitoEventoPassato(e, certificati === null ? null : (certificati.get(e.id) ?? 0))}
        />
      ))}
    </ul>
  );
}
