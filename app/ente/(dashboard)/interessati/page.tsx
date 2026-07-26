import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { pianoAPagamento } from "@/lib/ente/pianoSuccessivo";
import { getAreaBySlug } from "@/data/aree";

type RigaInteresse = {
  student_id: string;
  nome: string;
  cognome: string;
  scuola_denominazione: string | null;
  aree_interesse: string[];
  creata_il: string;
};

export default async function EnteInteressatiPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();
  const aPagamento = pianoAPagamento(contesto.pianoNome);

  if (!aPagamento) {
    const { data: conteggio } = await supabase.rpc("conteggio_manifestazioni_interesse", { p_istituzione_id: contesto.istituzioneId });
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Studenti interessati</p>
          <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Chi ha condiviso il proprio profilo con te</h1>
        </div>
        <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-8 text-center">
          <p className="text-3xl font-bold text-kireo-light">{typeof conteggio === "number" ? conteggio : 0}</p>
          <p className="mt-1 text-sm text-kireo-muted">student{conteggio === 1 ? "e" : "i"} ha{conteggio === 1 ? "" : "nno"} condiviso il proprio profilo con te.</p>
          <p className="mt-4 text-sm text-kireo-light/90">
            Con un piano a pagamento vedi nome, cognome, scuola e aree di interesse di ognuno.{" "}
            <a href="/ente/piano" className="text-kireo-orange underline underline-offset-2">
              Scopri i piani
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const { data: righe } = await supabase.rpc("manifestazioni_dettaglio_ente", { p_istituzione_id: contesto.istituzioneId });
  const elenco = (righe ?? []) as RigaInteresse[];

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Studenti interessati</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Chi ha condiviso il proprio profilo con te</h1>
        <p className="mt-2 text-kireo-muted">Nessun contatto diretto: puoi scrivere solo tramite i messaggi di KIREO.</p>
      </div>

      {elenco.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Nessuno studente ha ancora condiviso il proprio profilo con te.
        </div>
      ) : (
        <ul className="space-y-3">
          {elenco.map((r) => (
            <li key={r.student_id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
              <p className="font-heading text-sm font-semibold text-kireo-light">
                {r.nome} {r.cognome}
              </p>
              <p className="mt-1 text-xs text-kireo-muted">
                {r.scuola_denominazione ?? "Scuola non indicata"} · condiviso il {new Date(r.creata_il).toLocaleDateString("it-IT", { dateStyle: "long" })}
              </p>
              {r.aree_interesse.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.aree_interesse.map((slug) => {
                    const area = getAreaBySlug(slug);
                    return area ? (
                      <span key={slug} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-kireo-light/80">
                        {area.nome}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
