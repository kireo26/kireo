import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import CreaEventoForm from "@/components/ente/CreaEventoForm";
import Link from "next/link";
import { MAX_EVENTI_IN_REVISIONE, TESTI_EVENTO_CREATO } from "@/lib/ente/eventiEnte";

// CREA EVENTO (Mario, 27/10): la sezione «Proponi un nuovo evento» che stava in
// fondo alla lista, spostata sotto la sua voce. `?proposta=` arriva da «Crea
// l'evento» su una proposta accettata (`CreaEventoDaPropostaLink`).
export default async function EnteNuovoEventoPage({ searchParams }: { searchParams: Promise<{ proposta?: string; creato?: string }> }) {
  const { proposta: propostaIdParam, creato } = await searchParams;
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

  // L'evento appena creato, riletto dal database: la conferma si dice solo se
  // c'è ed è di questo ente, e le aree mancanti le dice il database, non il
  // ricordo del browser (Mario, 30/10).
  let creatoRiletto: { id: string; pubblico: string; aree: number | null } | null = null;
  if (creato) {
    const { data: ev, error: erroreEv } = await supabase
      .from("eventi")
      .select("id, pubblico")
      .eq("id", creato)
      .eq("organizzatore_id", contesto.istituzioneId)
      .maybeSingle();
    if (erroreEv) console.error("[ente/eventi/nuovo] rilettura dell'evento creato:", erroreEv);
    if (ev) {
      const { count, error: erroreAree } = await supabase.from("eventi_aree").select("evento_id", { count: "exact", head: true }).eq("evento_id", ev.id);
      if (erroreAree) console.error("[ente/eventi/nuovo] aree dell'evento creato:", erroreAree);
      creatoRiletto = { id: ev.id as string, pubblico: ev.pubblico as string, aree: erroreAree ? null : (count ?? 0) };
    }
  }

  return (
    <div>
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Proponi un nuovo evento</h2>
      <p className="mt-1 text-sm text-kireo-muted">
        Nessun limite di creazione: KIREO revisiona ogni proposta prima che compaia pubblicamente. Puoi avere al massimo {MAX_EVENTI_IN_REVISIONE} eventi
        in attesa di revisione contemporaneamente.
        {propostaAccettata && " Questo evento sarà collegato alla proposta della scuola che hai accettato."}
      </p>
      {creatoRiletto && (
        <div className="mt-4 rounded-xl border border-kireo-green/40 bg-kireo-green/10 px-4 py-3">
          <p className="text-sm font-semibold text-kireo-light">{TESTI_EVENTO_CREATO.titolo}</p>
          <p className="mt-1 text-sm text-kireo-muted">
            {TESTI_EVENTO_CREATO.dettaglio}{" "}
            <Link href={`/ente/eventi#evento-${creatoRiletto.id}`} className="text-kireo-orange underline underline-offset-2">
              {TESTI_EVENTO_CREATO.link}
            </Link>
            .
          </p>
          {creatoRiletto.pubblico === "studenti" && creatoRiletto.aree === 0 && (
            <p className="mt-3 rounded-lg border border-kireo-orange/40 bg-kireo-orange/10 px-4 py-3 text-sm text-kireo-orange">
              Le aree tematiche però non si sono salvate, e senza un&apos;area l&apos;incontro non lascia niente nel profilo di chi partecipa. Non
              rimandarlo: scrivici da{" "}
              <a href="/contatti" target="_blank" className="underline underline-offset-2">
                contatti
              </a>{" "}
              e le sistemiamo prima della revisione.
            </p>
          )}
        </div>
      )}
      <div className="mt-4">
        <CreaEventoForm
          key={`nuovo-${creatoRiletto?.id ?? ""}`}
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
