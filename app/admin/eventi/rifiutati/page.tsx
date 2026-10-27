import { requireAdmin } from "@/lib/admin/context";
import { caricaEventiAdmin } from "@/lib/admin/caricaEventiAdmin";
import { dividiEventiAdmin, motivoRifiuto } from "@/lib/admin/eventiAdmin";
import { LetturaFallita, Righe, Vuoto } from "../ElencoAdmin";

// RIFIUTATI, per ultima: la sezione che si apre quando qualcuno chiede perché.
// Per questo ogni riga dice la nota che l'ente ha ricevuto.
export default async function AdminEventiRifiutatiPage() {
  const { supabase } = await requireAdmin();
  const { eventi, aree, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return <LetturaFallita />;
  const { rifiutati } = dividiEventiAdmin(eventi);
  if (rifiutati.length === 0) return <Vuoto testo="Nessun evento rifiutato." />;
  return <Righe eventi={rifiutati} aree={aree} esito={motivoRifiuto} />;
}
