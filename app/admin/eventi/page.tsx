import { requireAdmin } from "@/lib/admin/context";
import { caricaEventiAdmin } from "@/lib/admin/caricaEventiAdmin";
import { AVVISO_SCADUTO, TITOLO_SCADUTI, dividiEventiAdmin } from "@/lib/admin/eventiAdmin";
import { LetturaFallita, Righe, Vuoto } from "./ElencoAdmin";

// DA APPROVARE: la coda di lavoro, per data, i più vicini in cima. Approvare
// o rifiutare si fa nella pagina dell'evento, dove c'è la descrizione intera.
// In fondo, in un gruppo loro e fuori dal numero della scheda, le proposte con
// la data già passata: restano visibili, perché all'ente serve sapere che fine
// ha fatto la sua proposta, ma non sono più lavoro (`dividiEventiAdmin`).
export default async function AdminEventiDaApprovarePage() {
  const { supabase } = await requireAdmin();
  const { eventi, aree, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return <LetturaFallita />;
  const { daApprovare, scaduti } = dividiEventiAdmin(eventi);
  return (
    <div className="space-y-6">
      {daApprovare.length === 0 ? <Vuoto testo="Nessun evento da approvare." /> : <Righe eventi={daApprovare} aree={aree} />}
      {scaduti.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-base font-semibold text-kireo-light">{TITOLO_SCADUTI}</h2>
          <Righe eventi={scaduti} aree={aree} esito={() => AVVISO_SCADUTO} />
        </section>
      )}
    </div>
  );
}
