import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getStoricoAttivita } from "@/lib/app/attivita";
import { getOreCertificate, TRAGUARDO_ORE_PCTO } from "@/lib/app/pcto";

export default async function AttivitaAppPage() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const [storico, oreCertificate] = await Promise.all([
    getStoricoAttivita(supabase, contesto.userId),
    getOreCertificate(supabase, contesto.userId),
  ]);

  const attivitaCertificate = storico.filter((v) => v.tipo === "attivita" && (v.oreCertificate ?? 0) > 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Le mie attività</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Il tuo storico</h1>
      </div>

      {storico.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center">
          <p className="text-kireo-muted">
            Non hai ancora nessuna attività registrata.{" "}
            <Link href="/app/aree" className="text-kireo-orange underline underline-offset-2">
              Esplora le aree
            </Link>{" "}
            per iniziare il tuo percorso.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {storico.map((voce) => (
            <li
              key={voce.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-kireo-card p-4"
            >
              <div>
                <span
                  className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    voce.tipo === "webinar" ? "bg-kireo-orange/15 text-kireo-orange" : "bg-kireo-green/15 text-kireo-green-light"
                  }`}
                >
                  {voce.tipo === "webinar" ? "Webinar" : "Attività"}
                </span>
                <span className="font-heading text-sm font-semibold text-kireo-light">{voce.titolo}</span>
                <p className="mt-1 text-xs text-kireo-muted">
                  {new Date(voce.data).toLocaleDateString("it-IT", { dateStyle: "long" })}
                </p>
              </div>
              {voce.oreCertificate ? (
                <span className="flex-none text-sm font-semibold text-kireo-green-light">{voce.oreCertificate}h certificate</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">PCTO</h2>
        <p className="mt-1 text-sm text-kireo-muted">
          {oreCertificate} ore certificate su {TRAGUARDO_ORE_PCTO}
        </p>

        {attivitaCertificate.length > 0 && (
          <ul className="mt-4 space-y-2">
            {attivitaCertificate.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-sm text-kireo-light">
                <span>{v.titolo}</span>
                <span className="text-kireo-muted">{v.oreCertificate}h</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5">
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/10 px-6 py-3 font-sans text-sm font-semibold text-kireo-light/40"
          >
            Scarica giustificativo
          </button>
          <p className="mt-2 text-xs text-kireo-muted">Disponibile con la convenzione della tua scuola.</p>
        </div>
      </div>
    </div>
  );
}
