import { requireAdmin } from "@/lib/admin/context";
import { caricaEventiAdmin } from "@/lib/admin/caricaEventiAdmin";
import { avvisoDaApprovare, dividiEventiAdmin } from "@/lib/admin/eventiAdmin";
import { LetturaFallita, Righe, Vuoto } from "./ElencoAdmin";

// DA APPROVARE: la coda di lavoro, per data, i più vicini in cima. Approvare
// o rifiutare si fa nella pagina dell'evento, dove c'è la descrizione intera.
export default async function AdminEventiDaApprovarePage() {
  const { supabase } = await requireAdmin();
  const { eventi, aree, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return <LetturaFallita />;
  const { daApprovare } = dividiEventiAdmin(eventi);
  if (daApprovare.length === 0) return <Vuoto testo="Nessun evento da approvare." />;
  const ora = new Date();
  return <Righe eventi={daApprovare} aree={aree} esito={(e) => avvisoDaApprovare(e, ora)} />;
}
