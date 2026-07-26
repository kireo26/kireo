import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { cercaEnti } from "@/lib/app/esplora";
import { AREE } from "@/data/aree";
import CardEnte from "@/components/app/CardEnte";
import SeguiButton from "@/components/app/SeguiButton";

const TIPI = [
  { value: "universita", label: "Università" },
  { value: "its", label: "ITS Academy" },
  { value: "academy", label: "Accademia (AFAM)" },
  { value: "ente_professionale", label: "Ente di formazione professionale" },
];

export default async function EsploraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string; tipo?: string; provincia?: string; eventi?: string }>;
}) {
  const params = await searchParams;
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: righeAree } = await supabase.from("student_area_interests").select("area_slug").eq("user_id", contesto.userId);
  const areeStudente = (righeAree ?? []).map((r) => r.area_slug);

  const nessunFiltro = !params.q && !params.area && !params.tipo && !params.provincia && !params.eventi;
  const areaDefault = nessunFiltro ? undefined : params.area;

  const risultati = await cercaEnti(
    supabase,
    { query: params.q, areaSlug: params.area || areaDefault, tipo: params.tipo, provincia: params.provincia, soloConEventi: params.eventi === "1" },
    areeStudente,
  );

  const { data: seguitiRighe } = await supabase.from("seguiti").select("istituzione_id").eq("student_id", contesto.userId);
  const seguiti = new Set((seguitiRighe ?? []).map((s) => s.istituzione_id));

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Esplora</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          {nessunFiltro && areeStudente.length > 0 ? "Enti per le tue aree" : "Trova un ente formativo"}
        </h1>
      </div>

      <form method="get" className="grid gap-3 rounded-2xl border border-white/5 bg-kireo-card p-4 sm:grid-cols-5">
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Cerca per nome..."
          className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted sm:col-span-2"
        />
        <select name="area" defaultValue={params.area ?? ""} className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light">
          <option value="">Tutte le aree</option>
          {AREE.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.nome}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={params.tipo ?? ""} className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light">
          <option value="">Tutti i tipi</option>
          {TIPI.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="provincia"
          defaultValue={params.provincia ?? ""}
          placeholder="Provincia"
          className="rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
        />
        <label className="flex items-center gap-2 text-sm text-kireo-light/90 sm:col-span-2">
          <input type="checkbox" name="eventi" value="1" defaultChecked={params.eventi === "1"} className="h-4 w-4 rounded border-white/20 bg-kireo-dark accent-kireo-green" />
          Solo con eventi in programma
        </label>
        <button type="submit" className="rounded-lg bg-kireo-green px-4 py-2 text-sm font-semibold text-kireo-light hover:bg-kireo-green-light sm:col-span-3">
          Cerca
        </button>
      </form>

      {risultati.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Nessun ente trovato con questi filtri.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {risultati.map((ente) => (
            <li key={ente.id}>
              <CardEnte
                ente={ente}
                azioneExtra={<SeguiButton istituzioneId={ente.id} userId={contesto.userId} seguitoIniziale={seguiti.has(ente.id)} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
