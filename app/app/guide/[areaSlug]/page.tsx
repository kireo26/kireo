import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { guideDiArea, statoSblocco, GATE_GUIDE_ATTIVO, guidaPronta } from "@/lib/guide/config";
import { caricaContestoGuide } from "@/lib/guide/statoStudente";
import CardGuida from "@/components/app/CardGuida";

export const metadata = { title: "Guide — KIREO" };

// Dettaglio di un'area: le sue (fino a) tre guide, con stato di sblocco e
// disponibilità del PDF. Ogni apertura traccia `download_guida` (CardGuida).
export default async function GuideAreaPage({ params }: { params: Promise<{ areaSlug: string }> }) {
  const { areaSlug } = await params;
  const area = getAreaBySlug(areaSlug);
  if (!area) notFound();

  const contesto = await getAppContext();
  const supabase = await createClient();
  const ctx = await caricaContestoGuide(supabase, contesto.userId);
  const segnale = ctx.segnale(areaSlug);

  const guide = guideDiArea(areaSlug).map((g) => {
    const sb = statoSblocco(g.livello, segnale);
    return { guida: g, disponibile: guidaPronta(areaSlug, g.livello), sbloccata: sb.sbloccata, motivo: sb.motivo };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/guide" className="text-xs text-kireo-muted hover:text-kireo-light">← Tutte le guide</Link>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-sm font-bold text-kireo-orange">{area.icona}</span>
          <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">{area.nome}</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-kireo-muted">
          Tre guide di profondità crescente. La panoramica è sempre pronta; le altre si aprono man mano che l&apos;area si rafforza nel tuo profilo — con «Più a fondo» o con una missione.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {guide.map((g) => (
          <CardGuida key={g.guida.livello} guida={g.guida} disponibile={g.disponibile} sbloccata={g.sbloccata} motivo={g.motivo} gateAttivo={GATE_GUIDE_ATTIVO} />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/aree/${areaSlug}`} className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">Scopri l&apos;area</Link>
        <Link href="/app/test/piu-a-fondo" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">Fai «Più a fondo»</Link>
        <Link href="/app/escape" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-kireo-light hover:border-kireo-green">Prova una missione</Link>
      </div>
    </div>
  );
}
