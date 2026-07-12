import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { AREE } from "@/data/aree";
import BloccoLeMieAree, { type AreaInteresse } from "@/components/app/BloccoLeMieAree";

export default async function AreeAppPage() {
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: righeAree } = await supabase
    .from("student_area_interests")
    .select("area_slug")
    .eq("user_id", contesto.userId);
  const slugInteresse = new Set((righeAree ?? []).map((r) => r.area_slug));

  const areeInteresse: AreaInteresse[] = AREE.filter((a) => slugInteresse.has(a.slug)).map((a) => ({
    slug: a.slug,
    nome: a.nome,
    icona: a.icona,
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Aree</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          Le aree di orientamento
        </h1>
        <p className="mt-2 text-kireo-muted">Esplora tutte le aree, o rivedi quelle che ti incuriosiscono.</p>
      </div>

      <BloccoLeMieAree aree={areeInteresse} />

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Tutte le aree</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AREE.map((area) => {
            const interesse = slugInteresse.has(area.slug);
            return (
              <Link
                key={area.slug}
                href={`/aree/${area.slug}`}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                  interesse ? "border-kireo-green bg-kireo-green/10" : "border-white/10 hover:border-white/20"
                }`}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-xs font-bold text-kireo-orange">
                  {area.icona}
                </span>
                <span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-sm font-semibold leading-[1.25] text-kireo-light">{area.nome}</span>
                    {interesse && (
                      <span className="rounded-full bg-kireo-green/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-green-light">
                        Area di interesse
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-kireo-muted">{area.descrizioneBreve}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
