import Link from "next/link";
import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import RigaEventoEnte from "@/components/ente/RigaEventoEnte";
import RispondiPropostaForm, { CreaEventoDaPropostaLink } from "@/components/ente/RispondiPropostaForm";
import { caricaEventiEnte } from "@/lib/ente/caricaEventiEnte";
import { areaEventoEnte, dividiEventiEnte, motivoRifiuto, testoCodaRevisione } from "@/lib/ente/eventiEnte";

// IN PROGRAMMAZIONE (Mario, 27/10): gli eventi non ancora finiti — approvati e
// in attesa di revisione insieme, per data, i più vicini in cima — con in testa
// la coda della revisione. Il confine fra questa lista e i passati è la fine
// EFFETTIVA (`dividiEventiEnte` → `eventoNonFinito`), come nel resto del prodotto.
//
// LE PROPOSTE DALLE SCUOLE restano qui, sotto l'elenco: sono incontri che una
// scuola chiede e che aspettano una risposta, e la loro risposta porta a
// «Crea evento». (Scelta mia, da rileggere: la lista di Mario non le nomina.)
export default async function EnteEventiPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const [{ eventi, aree, letturaFallita }, { data: proposte }] = await Promise.all([
    caricaEventiEnte(supabase, contesto.istituzioneId),
    supabase
      .from("proposte_incontro")
      .select("id, scuola_profilo_id, stato, descrizione, n_studenti_stimato, classi_coinvolte, date_preferite, created_at")
      .eq("istituzione_id", contesto.istituzioneId)
      .order("created_at", { ascending: false }),
  ]);
  const { inProgrammazione, rifiutati } = dividiEventiEnte(eventi);

  const scuolaProfiloIds = Array.from(new Set((proposte ?? []).map((p) => p.scuola_profilo_id)));
  const nomeScuolaPerProposta = new Map<string, string>();
  if (scuolaProfiloIds.length > 0) {
    const { data: scuoleProfilo } = await supabase.from("scuole_profili").select("id, scuola_id").in("id", scuolaProfiloIds);
    const codiciScuola = (scuoleProfilo ?? []).map((s) => s.scuola_id);
    const { data: scuole } = codiciScuola.length > 0 ? await supabase.from("schools").select("codice_meccanografico, denominazione").in("codice_meccanografico", codiciScuola) : { data: [] };
    const denominazionePerCodice = new Map((scuole ?? []).map((s) => [s.codice_meccanografico, s.denominazione]));
    for (const sp of scuoleProfilo ?? []) {
      nomeScuolaPerProposta.set(sp.id, denominazionePerCodice.get(sp.scuola_id) ?? "Scuola");
    }
  }

  return (
    <div className="space-y-8">
      {!letturaFallita && <p className="text-sm text-kireo-muted">{testoCodaRevisione(eventi)}</p>}

      {letturaFallita ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-300">
          Non siamo riusciti a leggere i tuoi eventi: è un problema nostro. Ricarica la pagina fra un momento.
        </div>
      ) : inProgrammazione.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Nessun evento in programmazione.{" "}
          <Link href="/ente/eventi/nuovo" className="text-kireo-orange underline underline-offset-2">
            Crea un evento
          </Link>
        </div>
      ) : (
        // Un gruppo per stato, con la sua intestazione: il titolo della pagina
        // è un'affermazione su tutto quello che contiene (`dividiEventiEnte`).
        <div className="space-y-6">
          {inProgrammazione.map((g) => (
            <section key={g.chiave}>
              <h2 className="mb-3 font-heading text-base font-semibold text-kireo-light">{g.titolo}</h2>
              <ul className="space-y-3">
                {g.eventi.map((e) => (
                  <RigaEventoEnte key={e.id} evento={e} area={areaEventoEnte(e, aree[e.id] ?? [])} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {proposte && proposte.length > 0 && (
        <div>
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Proposte dalle scuole</h2>
          <p className="mt-1 text-sm text-kireo-muted">Incontri di orientamento proposti da scuole che ti hanno trovato su Esplora.</p>
          <ul className="mt-4 space-y-3">
            {proposte.map((p) => (
              <li key={p.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <p className="font-heading text-sm font-semibold text-kireo-light">{nomeScuolaPerProposta.get(p.scuola_profilo_id) ?? "Scuola"}</p>
                <p className="mt-1 text-xs text-kireo-muted">
                  {p.stato === "inviata" ? "In attesa di risposta" : p.stato === "accettata" ? "Accettata" : p.stato === "rifiutata" ? "Rifiutata" : "Ritirata"}
                  {p.n_studenti_stimato ? ` · ~${p.n_studenti_stimato} studenti` : ""}
                  {p.classi_coinvolte ? ` · ${p.classi_coinvolte}` : ""}
                  {p.date_preferite ? ` · ${p.date_preferite}` : ""}
                </p>
                <p className="mt-2 text-sm text-kireo-light/90">{p.descrizione}</p>
                {p.stato === "inviata" && <RispondiPropostaForm propostaId={p.id} />}
                {p.stato === "accettata" && <CreaEventoDaPropostaLink propostaId={p.id} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* I RIFIUTATI, in fondo e con un titolo loro (Mario, 27/10): non sono in
          programmazione e non lo saranno mai, ma toglierli li farebbe sparire
          dalla vista di chi li ha scritti. Rari: un gruppo e non una voce di menu. */}
      {!letturaFallita && rifiutati.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-base font-semibold text-kireo-light">Rifiutati</h2>
          <ul className="space-y-3">
            {rifiutati.map((e) => (
              <RigaEventoEnte key={e.id} evento={e} area={areaEventoEnte(e, aree[e.id] ?? [])} esito={motivoRifiuto(e)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
