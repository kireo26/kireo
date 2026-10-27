import { requireAdmin } from "@/lib/admin/context";
import { caricaEventiAdmin } from "@/lib/admin/caricaEventiAdmin";
import { caricaCertificatiDocenti } from "@/lib/ente/caricaEventiEnte";
import { dividiEventiAdmin } from "@/lib/admin/eventiAdmin";
import { esitoEventoPassato } from "@/lib/ente/eventiEnte";
import { LetturaFallita, Righe, Vuoto } from "../ElencoAdmin";

// EVENTI PASSATI: dal più recente, ognuno con com'è andata (la stessa frase
// che legge l'ente).
export default async function AdminEventiPassatiPage() {
  const { supabase } = await requireAdmin();
  const { eventi, aree, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return <LetturaFallita />;
  const { passati } = dividiEventiAdmin(eventi);
  if (passati.length === 0) return <Vuoto testo="Nessun evento passato." />;
  const docenti = passati.filter((e) => e.pubblico === "docenti" && e.tipo !== "webinar").map((e) => e.id);
  const certificati = await caricaCertificatiDocenti(supabase, docenti);
  return (
    <Righe
      eventi={passati}
      aree={aree}
      esito={(e) => esitoEventoPassato(e, certificati === null ? null : (certificati.get(e.id) ?? 0))}
    />
  );
}
