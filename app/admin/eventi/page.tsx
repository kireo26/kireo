import { requireAdmin } from "@/lib/admin/context";
import Ricerca from "@/components/admin/Ricerca";
import { caricaEventiAdmin } from "@/lib/admin/caricaEventiAdmin";
import { AVVISO_SCADUTO, cercaEventiAdmin, dividiEventiAdmin, motivoRifiuto } from "@/lib/admin/eventiAdmin";
import { LetturaFallita, Righe, Vuoto } from "./ElencoAdmin";

// TUTTI: ogni evento proposto (le bozze no: sono di chi le sta scrivendo), dal
// più recente. Un rifiutato porta la sua nota, una proposta con la data
// passata lo dice.
export default async function AdminEventiTuttiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await requireAdmin();
  const { eventi, aree, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return <LetturaFallita />;
  const { scaduti } = dividiEventiAdmin(eventi);
  const idScaduti = new Set(scaduti.map((e) => e.id));
  const tutti = cercaEventiAdmin(eventi, q)
    .filter((e) => e.stato !== "bozza")
    .sort((a, b) => b.data_inizio.localeCompare(a.data_inizio));
  return (
    <div className="space-y-4">
      <Ricerca base="/admin/eventi" q={q} segnaposto="Cerca per titolo o nome dell'ente" />
      <p className="text-sm text-kireo-light">In tutto: {tutti.length}</p>
      {tutti.length === 0 ? (
        <Vuoto testo="Nessun evento." />
      ) : (
        <Righe
          eventi={tutti}
          aree={aree}
          esito={(e) => (e.stato === "rifiutato" ? motivoRifiuto(e) : idScaduti.has(e.id) ? AVVISO_SCADUTO : null)}
        />
      )}
    </div>
  );
}
