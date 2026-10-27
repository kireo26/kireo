import { requireAdmin } from "@/lib/admin/context";
import { caricaEventiAdmin } from "@/lib/admin/caricaEventiAdmin";
import { dividiEventiAdmin } from "@/lib/admin/eventiAdmin";
import { LetturaFallita, Righe, Vuoto } from "../ElencoAdmin";

// IN PROGRAMMAZIONE: gli approvati non ancora finiti (fine EFFETTIVA), per
// gruppo — e un gruppo col suo nome per uno stato che la pagina non conosce.
export default async function AdminEventiInProgrammazionePage() {
  const { supabase } = await requireAdmin();
  const { eventi, aree, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return <LetturaFallita />;
  const { inProgrammazione } = dividiEventiAdmin(eventi);
  if (inProgrammazione.length === 0) return <Vuoto testo="Nessun evento in programmazione." />;
  return (
    <div className="space-y-6">
      {inProgrammazione.map((g) => (
        <section key={g.chiave}>
          <h2 className="mb-3 font-heading text-base font-semibold text-kireo-light">{g.titolo}</h2>
          <Righe eventi={g.eventi} aree={aree} />
        </section>
      ))}
    </div>
  );
}
