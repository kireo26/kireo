import Link from "next/link";
import { notFound } from "next/navigation";
import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { pianoAPagamento } from "@/lib/ente/pianoSuccessivo";
import { getAreaBySlug } from "@/data/aree";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";
import { annoDiCorso, etichettaAnno, TESTI_INTERESSATI } from "@/lib/ente/interessati";

type EventoScheda = { evento_id: string; titolo: string; data_inizio: string; minuti: number | null; presenza_certificata: boolean };
type Scheda = {
  student_id: string;
  nome: string;
  cognome: string;
  scuola_denominazione: string | null;
  scuola_provincia: string | null;
  anno_diploma: number | null;
  aree_interesse: string[];
  condiviso_il: string;
  copre_attivita: boolean;
  conversazione_id: string | null;
  eventi?: EventoScheda[];
  guida_scaricata_il?: string | null;
};

// La scheda di uno studente che ha condiviso il profilo con questo ente.
// ⚠️ Cosa NON c'è, e non deve arrivarci mai: test, missioni, workshop, e
// quello che KIREO ha dedotto. Condividere il profilo vuol dire «sappi chi
// sono», non «leggi cosa ho scoperto di me». Né quello che lo studente ha
// fatto con gli altri enti. La regola la tiene scheda_interessato_ente
// (20261111100000), non questa pagina: qui si mostra quello che arriva.
export default async function SchedaInteressatoPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const contesto = await getEnteContext();
  if (!pianoAPagamento(contesto.pianoNome)) notFound();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("scheda_interessato_ente", {
    p_istituzione_id: contesto.istituzioneId,
    p_student_id: studentId,
  });

  const indietro = (
    <Link href="/ente/interessati" className="text-sm text-kireo-orange underline underline-offset-2">
      ← Tutti gli interessati
    </Link>
  );

  if (error) {
    console.error("Scheda interessato:", descriviErrore(error));
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {indietro}
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-kireo-muted">{TESTI_INTERESSATI.nonLetti}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {indietro}
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-kireo-muted">{TESTI_INTERESSATI.schedaNonDisponibile}</p>
      </div>
    );
  }

  const s = data as Scheda;
  const eventi = s.eventi ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {indietro}
      <div>
        <h1 className="font-heading text-2xl font-bold text-kireo-light">
          {s.nome} {s.cognome}
        </h1>
        <p className="mt-1 text-sm text-kireo-muted">
          {etichettaAnno(annoDiCorso(s.anno_diploma, new Date()))} · {s.scuola_denominazione ?? "Scuola non indicata"}
          {s.scuola_provincia ? ` (${s.scuola_provincia})` : ""}
        </p>
        <p className="mt-1 text-xs text-kireo-muted">Ha condiviso il profilo con te il {formattaData(s.condiviso_il, "long")}.</p>
      </div>

      <section className="rounded-2xl border border-white/5 bg-kireo-card p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Le aree che ha scelto</p>
        {s.aree_interesse.length === 0 ? (
          <p className="text-sm text-kireo-muted">Non ha indicato aree.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {s.aree_interesse.map((slug) => (
              <span key={slug} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-kireo-light/80">
                {getAreaBySlug(slug)?.nome ?? slug}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/5 bg-kireo-card p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-kireo-muted">Cosa ha fatto verso di te</p>
        {!s.copre_attivita ? (
          <p className="text-sm text-kireo-muted">{TESTI_INTERESSATI.schedaSenzaAttivita}</p>
        ) : eventi.length === 0 && !s.guida_scaricata_il ? (
          <p className="text-sm text-kireo-muted">{TESTI_INTERESSATI.nessunaAttivita}</p>
        ) : (
          <ul className="space-y-2 text-sm text-kireo-light">
            {eventi.map((e) => (
              <li key={e.evento_id}>
                {e.titolo} · {formattaData(e.data_inizio, "long")}
                <span className="text-kireo-muted">
                  {e.minuti !== null ? ` · presente per ${e.minuti} minut${e.minuti === 1 ? "o" : "i"}` : ""}
                  {e.presenza_certificata ? " · presenza certificata" : ""}
                </span>
              </li>
            ))}
            {s.guida_scaricata_il && <li>Ha scaricato la tua guida il {formattaData(s.guida_scaricata_il, "long")}.</li>}
          </ul>
        )}
      </section>

      <section>
        {s.conversazione_id ? (
          <Link
            href={`/ente/messaggi/${s.conversazione_id}`}
            className="inline-flex items-center justify-center rounded-full bg-kireo-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-kireo-green-light"
          >
            Scrivigli nei messaggi di KIREO
          </Link>
        ) : (
          <p className="text-sm text-kireo-muted">{TESTI_INTERESSATI.senzaConversazione}</p>
        )}
      </section>
    </div>
  );
}
