import EnteShell from "@/components/ente/EnteShell";
import AccettaRegolamentoForm from "@/components/ente/AccettaRegolamentoForm";
import { getEnteContext } from "@/lib/ente/context";

export default async function EnteLayout({ children }: { children: React.ReactNode }) {
  const contesto = await getEnteContext();

  // Blocco duro, non aggirabile: gli enti registrati prima di questo
  // cantiere non hanno ancora accettato il regolamento. Stesso principio
  // del blocco su /app quando manca la data di nascita — nessun figlio
  // renderizzato finché la condizione non è soddisfatta.
  if (!contesto.regolamentoAccettato) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center sm:pt-28">
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Un'ultima cosa</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Accetta il regolamento enti</h1>
        <p className="mt-4 text-kireo-muted">
          Prima di continuare, leggi e accetta le regole che ogni istituzione formativa rispetta su KIREO.
        </p>
        <AccettaRegolamentoForm istituzioneId={contesto.istituzioneId} />
      </div>
    );
  }

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
