import { createClient } from "@/lib/supabase/server";
import { getDocenteContext } from "@/lib/docente/context";
import { FILONI_DOCENTI } from "@/data/filoniDocenti";

type Risorsa = { id: string; titolo: string; descrizione: string | null; filone: string; file_url: string };

export default async function DocenteRisorsePage() {
  await getDocenteContext();
  const supabase = await createClient();

  const { data: risorse } = await supabase
    .from("risorse_docenti")
    .select("id, titolo, descrizione, filone, file_url")
    .eq("pubblicata", true)
    .order("created_at", { ascending: false });

  const risorsePerFilone = new Map<string, Risorsa[]>();
  for (const r of (risorse ?? []) as Risorsa[]) {
    risorsePerFilone.set(r.filone, [...(risorsePerFilone.get(r.filone) ?? []), r]);
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Risorse</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Materiali per filone</h1>
      </div>

      {!risorse || risorse.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          I primi materiali arrivano col primo ciclo di webinar.
        </div>
      ) : (
        FILONI_DOCENTI.map((filone) => {
          const risorseFilone = risorsePerFilone.get(filone.slug) ?? [];
          if (risorseFilone.length === 0) return null;
          return (
            <div key={filone.slug}>
              <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{filone.nome}</h2>
              <ul className="mt-4 space-y-3">
                {risorseFilone.map((r) => (
                  <li key={r.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                    <p className="font-heading text-sm font-semibold text-kireo-light">{r.titolo}</p>
                    {r.descrizione && <p className="mt-1 text-sm text-kireo-muted">{r.descrizione}</p>}
                    <a href={r.file_url} className="mt-2 inline-block text-sm text-kireo-orange underline underline-offset-2">
                      Scarica →
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
