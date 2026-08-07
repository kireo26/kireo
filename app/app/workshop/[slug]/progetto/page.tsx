import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app/studentContext";
import { WORKSHOP_ELABORATO } from "@/lib/workshop/elaborato-config";
import type { ValoreSezione } from "@/lib/workshop/elaboratoValore";
import ElaboratoEditor from "@/components/workshop/elaborato/ElaboratoEditor";

export const metadata = { title: "Il tuo progetto — KIREO" };

type FeedbackFinale = { punti_forza: string[]; aree_miglioramento: string[]; domanda_stimolante: string };

export default async function ProgettoWorkshopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: ws } = await supabase.from("workshop").select("id, slug, titolo").eq("slug", slug).eq("attivo", true).maybeSingle();
  if (!ws) notFound();

  const { data: iscrizione } = await supabase
    .from("workshop_iscrizioni")
    .select("id, created_at, workshop_ruoli(slug, titolo, area_slug)")
    .eq("workshop_id", ws.id)
    .eq("student_id", contesto.userId)
    .maybeSingle();
  if (!iscrizione) redirect(`/app/workshop/${slug}`);

  const ruoloIscritto = Array.isArray(iscrizione.workshop_ruoli) ? iscrizione.workshop_ruoli[0] : iscrizione.workshop_ruoli;
  const elaboratoConfig = ruoloIscritto ? WORKSHOP_ELABORATO[slug]?.[ruoloIscritto.slug] : undefined;
  if (!ruoloIscritto || !elaboratoConfig) redirect(`/app/workshop/${slug}`);

  const { data: elaborato } = await supabase
    .from("workshop_elaborati")
    .select("contenuto, fase_corrente, fasi_completate, stato, feedback_ai")
    .eq("iscrizione_id", iscrizione.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/workshop/${slug}`} className="text-xs text-kireo-muted hover:text-kireo-light">
          ← {ws.titolo}
        </Link>
        <h1 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">Il tuo progetto</h1>
        <p className="mt-1 text-sm text-kireo-muted">Ruolo: {ruoloIscritto.titolo}</p>
      </div>

      <ElaboratoEditor
        iscrizioneId={iscrizione.id}
        workshopSlug={slug}
        ruoloSlug={ruoloIscritto.slug}
        ruoloTitolo={ruoloIscritto.titolo}
        areaSlug={ruoloIscritto.area_slug}
        iscrizioneCreataIl={iscrizione.created_at}
        elaborato={elaboratoConfig}
        statoIniziale={{
          contenuto: (elaborato?.contenuto ?? {}) as Record<string, ValoreSezione>,
          faseCorrente: elaborato?.fase_corrente ?? null,
          fasiCompletate: elaborato?.fasi_completate ?? [],
          stato: (elaborato?.stato as "bozza" | "consegnato") ?? "bozza",
          feedbackAi: (elaborato?.feedback_ai as FeedbackFinale | null) ?? null,
        }}
      />
    </div>
  );
}
