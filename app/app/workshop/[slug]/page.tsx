import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app/studentContext";
import { WORKSHOP_KIT } from "@/lib/workshop/config";
import IscrizioneRuolo from "@/components/workshop/IscrizioneRuolo";
import KitRuolo from "@/components/workshop/KitRuolo";
import NetworkPeers from "@/components/workshop/NetworkPeers";
import ConsegnaUpload from "@/components/workshop/ConsegnaUpload";

export const metadata = { title: "Workshop — KIREO" };

export default async function WorkshopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: ws } = await supabase
    .from("workshop")
    .select("id, slug, titolo, sottotitolo, descrizione")
    .eq("slug", slug)
    .eq("attivo", true)
    .maybeSingle();
  if (!ws) notFound();

  const { data: iscrizione } = await supabase
    .from("workshop_iscrizioni")
    .select("id, ruolo_id, workshop_ruoli(id, slug, titolo, area_slug, descrizione)")
    .eq("workshop_id", ws.id)
    .eq("student_id", contesto.userId)
    .maybeSingle();

  const ruoloIscritto = iscrizione ? (Array.isArray(iscrizione.workshop_ruoli) ? iscrizione.workshop_ruoli[0] : iscrizione.workshop_ruoli) : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/workshop" className="text-xs text-kireo-muted hover:text-kireo-light">
          ← Tutti i workshop
        </Link>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{ws.titolo}</h1>
        {ws.sottotitolo && <p className="mt-1 text-sm text-kireo-muted">{ws.sottotitolo}</p>}
        {ws.descrizione && <p className="mt-3 text-kireo-light/90">{ws.descrizione}</p>}
      </div>

      {!iscrizione && <SceltaRuolo workshopId={ws.id} studentId={contesto.userId} supabase={supabase} />}

      {iscrizione && ruoloIscritto && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-kireo-card p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Il tuo ruolo</p>
              <p className="mt-1 font-heading text-lg font-semibold text-kireo-light">{ruoloIscritto.titolo}</p>
              {ruoloIscritto.descrizione && <p className="mt-1 text-sm text-kireo-muted">{ruoloIscritto.descrizione}</p>}
            </div>
            <Link
              href={`/app/workshop/${ws.slug}/cliente`}
              className="flex-none rounded-full bg-kireo-orange px-5 py-2.5 text-sm font-semibold text-kireo-dark hover:bg-kireo-orange/90"
            >
              Parla con il cliente →
            </Link>
          </div>

          {WORKSHOP_KIT[ws.slug]?.[ruoloIscritto.slug] && <KitRuolo ruolo={ruoloIscritto.titolo} materiali={WORKSHOP_KIT[ws.slug][ruoloIscritto.slug]} />}

          <Peers workshopId={ws.id} supabase={supabase} />

          <ConsegneUpload iscrizioneId={iscrizione.id} workshopTitolo={ws.titolo} ruoloSlug={ruoloIscritto.slug} areaSlug={ruoloIscritto.area_slug} supabase={supabase} />
        </>
      )}
    </div>
  );
}

async function SceltaRuolo({
  workshopId,
  studentId,
  supabase,
}: {
  workshopId: string;
  studentId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const [{ data: ruoli }, { data: occupati }] = await Promise.all([
    supabase.from("workshop_ruoli").select("id, slug, titolo, area_slug, descrizione").eq("workshop_id", workshopId).order("ordine"),
    supabase.rpc("ruoli_occupati_workshop", { p_workshop_id: workshopId }),
  ]);

  const ruoliOccupati: string[] = (occupati ?? []).map((riga: unknown) =>
    typeof riga === "string" ? riga : (riga as { ruoli_occupati_workshop: string }).ruoli_occupati_workshop,
  );

  return <IscrizioneRuolo workshopId={workshopId} studentId={studentId} ruoli={ruoli ?? []} ruoliOccupati={ruoliOccupati} />;
}

async function Peers({ workshopId, supabase }: { workshopId: string; supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data: peers } = await supabase.rpc("peers_workshop", { p_workshop_id: workshopId });
  if (!peers || peers.length === 0) return null;
  return <NetworkPeers workshopId={workshopId} peers={peers} />;
}

async function ConsegneUpload({
  iscrizioneId,
  workshopTitolo,
  ruoloSlug,
  areaSlug,
  supabase,
}: {
  iscrizioneId: string;
  workshopTitolo: string;
  ruoloSlug: string;
  areaSlug: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const { data: consegne } = await supabase
    .from("workshop_consegne")
    .select("id, file_nome, file_percorso, file_dimensione, feedback_ai, stato, created_at")
    .eq("iscrizione_id", iscrizioneId)
    .order("created_at", { ascending: false });

  const consegneConUrl = await Promise.all(
    (consegne ?? []).map(async (c) => {
      const { data } = await supabase.storage.from("workshop-consegne").createSignedUrl(c.file_percorso, 3600);
      return { ...c, signedUrl: data?.signedUrl ?? null };
    }),
  );

  return <ConsegnaUpload iscrizioneId={iscrizioneId} workshopTitolo={workshopTitolo} ruoloSlug={ruoloSlug} areaSlug={areaSlug} consegneEsistenti={consegneConUrl} />;
}
