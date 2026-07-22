import { getDocenteContext } from "@/lib/docente/context";
import { getAttestatiDocente } from "@/lib/docente/attestati";
import { createClient } from "@/lib/supabase/server";
import { getFiloneBySlug } from "@/data/filoniDocenti";

export default async function DocenteAttestatiPage() {
  const contesto = await getDocenteContext();
  const supabase = await createClient();
  const attestati = await getAttestatiDocente(supabase, contesto.userId);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Attestati</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">I tuoi attestati</h1>
        <p className="mt-2 text-kireo-muted">
          Generati quando l&apos;organizzatore certifica la tua partecipazione a un webinar.
        </p>
      </div>

      {attestati.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non hai ancora nessun attestato. Iscriviti a un webinar e partecipa: l&apos;attestato arriva dopo la certificazione
          dell&apos;organizzatore.
        </div>
      ) : (
        <ul className="space-y-3">
          {attestati.map((a) => {
            const filone = getFiloneBySlug(a.filone);
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-kireo-card p-4">
                <div>
                  {filone && (
                    <span className="rounded-full bg-kireo-orange/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-orange">{filone.nome}</span>
                  )}
                  <p className="mt-2 font-heading text-sm font-semibold text-kireo-light">{a.titoloWebinar}</p>
                  <p className="mt-1 text-xs text-kireo-muted">
                    {new Date(a.dataEvento).toLocaleDateString("it-IT", { dateStyle: "long" })}
                    {a.organizzatoreNome ? ` · ${a.organizzatoreNome}` : ""} · rilasciato il{" "}
                    {new Date(a.rilasciatoIl).toLocaleDateString("it-IT", { dateStyle: "long" })}
                  </p>
                </div>
                <a
                  href={`/api/attestato/${a.id}`}
                  className="inline-flex flex-none items-center justify-center rounded-full bg-kireo-green px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
                >
                  Scarica PDF
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
