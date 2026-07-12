import EnteShell from "@/components/ente/EnteShell";
import { getEnteContext } from "@/lib/ente/context";

export default async function EnteLayout({ children }: { children: React.ReactNode }) {
  const contesto = await getEnteContext();

  return (
    <EnteShell nome={contesto.nome}>
      {contesto.stato === "in_attesa" && (
        <div className="mb-6 rounded-xl border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-sm text-kireo-orange">
          Il tuo profilo è in attesa di attivazione da parte di KIREO: puoi già completarlo, ma non è ancora visibile
          pubblicamente.
        </div>
      )}
      {contesto.stato === "sospesa" && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Il tuo profilo è sospeso e non è visibile pubblicamente. Contattaci da /contatti per maggiori informazioni.
        </div>
      )}
      {children}
    </EnteShell>
  );
}
