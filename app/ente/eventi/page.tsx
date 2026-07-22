import { getEnteContext } from "@/lib/ente/context";
import { getQuoteEnte } from "@/lib/ente/quote";
import { createClient } from "@/lib/supabase/server";
import MettiInEvidenzaButton from "@/components/ente/MettiInEvidenzaButton";
import CreaEventoForm from "@/components/ente/CreaEventoForm";
import RegistroPresenzeDocenti from "@/components/ente/RegistroPresenzeDocenti";
import { getFiloneBySlug } from "@/data/filoniDocenti";

const ETICHETTA_STATO: Record<string, { label: string; classe: string }> = {
  bozza: { label: "Bozza", classe: "bg-white/10 text-kireo-light" },
  in_approvazione: { label: "In approvazione", classe: "bg-kireo-orange/15 text-kireo-orange" },
  approvato: { label: "Approvato", classe: "bg-kireo-green/15 text-kireo-green-light" },
  rifiutato: { label: "Rifiutato", classe: "bg-red-500/15 text-red-300" },
};

export default async function EnteEventiPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();
  const perDocenti = contesto.tipo === "formazione_docenti";

  const [{ data: eventi }, quote] = await Promise.all([
    supabase
      .from("eventi")
      .select("id, titolo, tipo, data_inizio, stato, in_evidenza, pubblico, filone")
      .eq("organizzatore_id", contesto.istituzioneId)
      .order("created_at", { ascending: false }),
    getQuoteEnte(supabase, contesto.istituzioneId, contesto.pianoNome),
  ]);

  const eventiInRevisione = (eventi ?? []).filter((e) => e.stato === "in_approvazione").length;
  const quotaEvidenzaRimasta = quote.evidenzaTotali - quote.evidenzaUsate;

  // Registro presenze: solo per i propri webinar docenti già approvati.
  const eventiDocentiApprovati = (eventi ?? []).filter((e) => e.pubblico === "docenti" && e.stato === "approvato");
  const registriPresenze = new Map<string, { userId: string; nomeCompleto: string; stato: string }[]>();
  if (eventiDocentiApprovati.length > 0) {
    const { data: iscrizioni } = await supabase
      .from("iscrizioni_eventi")
      .select("evento_id, student_id, stato, profiles!student_id(nome, cognome)")
      .in(
        "evento_id",
        eventiDocentiApprovati.map((e) => e.id),
      );
    for (const riga of iscrizioni ?? []) {
      const profilo = Array.isArray(riga.profiles) ? riga.profiles[0] : riga.profiles;
      const lista = registriPresenze.get(riga.evento_id) ?? [];
      lista.push({
        userId: riga.student_id,
        nomeCompleto: profilo ? `${profilo.nome} ${profilo.cognome}` : "Docente",
        stato: riga.stato,
      });
      registriPresenze.set(riga.evento_id, lista);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Eventi</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">I tuoi eventi</h1>
      </div>

      {!eventi || eventi.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non hai ancora proposto nessun evento. Crea il primo qui sotto.
        </div>
      ) : (
        <ul className="space-y-3">
          {eventi.map((e) => {
            const stato = ETICHETTA_STATO[e.stato] ?? ETICHETTA_STATO.bozza;
            const eDocenti = e.pubblico === "docenti";
            const filone = eDocenti ? getFiloneBySlug(e.filone) : undefined;
            return (
              <li key={e.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stato.classe}`}>
                      {stato.label}
                    </span>
                    {e.in_evidenza && (
                      <span className="mr-2 inline-block rounded-full bg-kireo-orange/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-orange">
                        In evidenza
                      </span>
                    )}
                    {filone && (
                      <span className="mr-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-light/80">
                        {filone.nome}
                      </span>
                    )}
                    <span className="font-heading text-sm font-semibold text-kireo-light">{e.titolo}</span>
                    <p className="mt-1 text-xs text-kireo-muted">
                      {new Date(e.data_inizio).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}
                    </p>
                  </div>
                  {e.stato === "approvato" && !e.in_evidenza && (
                    <MettiInEvidenzaButton eventoId={e.id} quotaRimasta={quotaEvidenzaRimasta} />
                  )}
                </div>
                {eDocenti && e.stato === "approvato" && (
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Registro presenze</p>
                    <RegistroPresenzeDocenti eventoId={e.id} iscritti={registriPresenze.get(e.id) ?? []} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Proponi un nuovo evento</h2>
        <p className="mt-1 text-sm text-kireo-muted">
          Nessun limite di creazione: KIREO revisiona ogni proposta prima che compaia pubblicamente. Puoi avere al massimo 4 eventi
          in attesa di revisione contemporaneamente.
        </p>
        <div className="mt-4">
          <CreaEventoForm istituzioneId={contesto.istituzioneId} eventiInRevisione={eventiInRevisione} perDocenti={perDocenti} />
        </div>
      </div>
    </div>
  );
}
