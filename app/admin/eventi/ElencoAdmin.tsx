import RigaEventoEnte from "@/components/ente/RigaEventoEnte";
import { areaEventoEnte } from "@/lib/ente/eventiEnte";
import type { EventoAdmin } from "@/lib/admin/eventiAdmin";

// Le parti comuni alle quattro schede: il messaggio di una lettura fallita,
// quello di un elenco vuoto, e la lista delle righe.
export function LetturaFallita() {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-300">
      Non siamo riusciti a leggere gli eventi: è un problema nostro. Ricarica la pagina fra un momento.
    </div>
  );
}

export function Vuoto({ testo }: { testo: string }) {
  return <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">{testo}</div>;
}

export function Righe({
  eventi,
  aree,
  esito,
}: {
  eventi: EventoAdmin[];
  aree: Record<string, string[]>;
  esito?: (e: EventoAdmin) => string | null;
}) {
  return (
    <ul className="space-y-3">
      {eventi.map((e) => (
        <RigaEventoEnte key={e.id} evento={e} ente={e.ente} area={areaEventoEnte(e, aree[e.id] ?? [])} esito={esito?.(e) ?? null} />
      ))}
    </ul>
  );
}
