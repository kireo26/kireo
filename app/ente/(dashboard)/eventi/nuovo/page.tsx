import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import CreaEventoForm from "@/components/ente/CreaEventoForm";
import { MAX_EVENTI_IN_REVISIONE } from "@/lib/ente/eventiEnte";

// CREA EVENTO (Mario, 27/10): la sezione «Proponi un nuovo evento» che stava in
// fondo alla lista, spostata sotto la sua voce. `?proposta=` arriva da «Crea
// l'evento» su una proposta accettata (`CreaEventoDaPropostaLink`).
export default async function EnteNuovoEventoPage({ searchParams }: { searchParams: Promise<{ proposta?: string }> }) {
  const { proposta: propostaIdParam } = await searchParams;
  const contesto = await getEnteContext();
  const supabase = await createClient();
  const perDocenti = contesto.tipo === "formazione_docenti";

  const [{ count: inRevisione, error: erroreConto }, { data: proposta }] = await Promise.all([
    supabase.from("eventi").select("id", { count: "exact", head: true }).eq("organizzatore_id", contesto.istituzioneId).eq("stato", "in_approvazione"),
    propostaIdParam
      ? supabase.from("proposte_incontro").select("id, stato, descrizione").eq("id", propostaIdParam).eq("istituzione_id", contesto.istituzioneId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  // Un conto non letto non è zero: il form lo tratterebbe come «c'è posto». Il
  // database rifiuta comunque oltre il limite; qui si logga e basta.
  if (erroreConto) console.error("[ente/eventi/nuovo] eventi in revisione:", erroreConto);
  const propostaAccettata = proposta && proposta.stato === "accettata" ? proposta : null;

  return (
    <div>
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Proponi un nuovo evento</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        Nessun limite di creazione: KIREO revisiona ogni proposta prima che compaia pubblicamente. Puoi avere al massimo {MAX_EVENTI_IN_REVISIONE} eventi
        in attesa di revisione contemporaneamente.
        {propostaAccettata && " Questo evento sarà collegato alla proposta della scuola che hai accettato."}
      </p>
      <div className="mt-4">
        <CreaEventoForm
          istituzioneId={contesto.istituzioneId}
          eventiInRevisione={inRevisione ?? 0}
          perDocenti={perDocenti}
          propostaIncontroId={propostaAccettata?.id ?? null}
          descrizionePrefill={propostaAccettata?.descrizione ?? null}
        />
      </div>
    </div>
  );
}
