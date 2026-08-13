import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { AREE } from "@/data/aree";
import { guideDiArea, statoSblocco, GATE_GUIDE_ATTIVO, guidaPronta } from "@/lib/guide/config";
import { caricaContestoGuide } from "@/lib/guide/statoStudente";

export const metadata = { title: "Guide di orientamento — KIREO" };

// Indice della sezione Guide: le 18 aree, ognuna con quante guide sono
// disponibili (PDF pronto) e quante sbloccate. Il dettaglio è in
// /app/guide/[areaSlug]. In fase di test il gate è OFF: le guide restano tutte
// visibili, lo stato è solo un'indicazione.
export default async function GuideHome() {
  const contesto = await getAppContext();
  const supabase = await createClient();
  const ctx = await caricaContestoGuide(supabase, contesto.userId);

  const righe = AREE.map((a) => {
    const guide = guideDiArea(a.slug);
    const s = ctx.segnale(a.slug);
    const disponibili = guide.filter((g) => guidaPronta(a.slug, g.livello)).length;
    const sbloccate = guide.filter((g) => statoSblocco(g.livello, s).sbloccata).length;
    return { slug: a.slug, nome: a.nome, icona: a.icona, disponibili, sbloccate };
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Guide</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Le guide di orientamento</h1>
        <p className="mt-2 max-w-2xl text-kireo-muted">
          Per ogni area, fino a tre guide di profondità crescente: una panoramica, le strade che puoi prendere, e come partire davvero. Le più profonde si aprono man mano che l&apos;area si rafforza nel tuo profilo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {righe.map((r) => (
          <Link key={r.slug} href={`/app/guide/${r.slug}`} className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-kireo-card p-5 transition hover:border-kireo-green/50">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-sm font-bold text-kireo-orange">{r.icona}</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-semibold text-kireo-light group-hover:text-kireo-orange">{r.nome}</h2>
              <p className="mt-0.5 text-xs text-kireo-muted">
                {r.disponibili > 0 ? `${r.disponibili} di 3 pronte` : "Guide in preparazione"}
                {GATE_GUIDE_ATTIVO ? ` · ${r.sbloccate}/3 sbloccate` : ""}
              </p>
            </div>
            <span className="flex-none text-sm text-kireo-green-light group-hover:underline">Apri →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
