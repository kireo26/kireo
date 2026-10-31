import { requireAdmin } from "@/lib/admin/context";
import { caricaEventiAdmin } from "@/lib/admin/caricaEventiAdmin";
import Ricerca from "@/components/admin/Ricerca";
import { cercaEventiAdmin, dividiEventiAdmin, motivoRifiuto } from "@/lib/admin/eventiAdmin";
import { LetturaFallita, Righe, Vuoto } from "../ElencoAdmin";

// RIFIUTATI, per ultima: la sezione che si apre quando qualcuno chiede perché.
// Per questo ogni riga dice la nota che l'ente ha ricevuto.
export default async function AdminEventiRifiutatiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await requireAdmin();
  const { eventi, aree, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return <LetturaFallita />;
  const { rifiutati } = dividiEventiAdmin(cercaEventiAdmin(eventi, q));
  return (
    <div className="space-y-4">
      <Ricerca base="/admin/eventi/rifiutati" q={q} segnaposto="Cerca per titolo o nome dell'ente" />
      <p className="text-sm text-kireo-light">In tutto: {rifiutati.length}</p>
      {rifiutati.length === 0 ? <Vuoto testo="Nessun evento rifiutato." /> : <Righe eventi={rifiutati} aree={aree} esito={motivoRifiuto} />}
    </div>
  );
}
