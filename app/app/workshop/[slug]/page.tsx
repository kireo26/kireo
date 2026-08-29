import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app/studentContext";
import { WORKSHOP_KIT } from "@/lib/workshop/config";
import { WORKSHOP_ELABORATO } from "@/lib/workshop/elaborato-config";
import IscrizioneRuolo from "@/components/workshop/IscrizioneRuolo";
import KitRuolo from "@/components/workshop/KitRuolo";
import NetworkPeers from "@/components/workshop/NetworkPeers";
import ComeFunziona from "@/components/workshop/ComeFunziona";

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

      {!iscrizione && (
        <>
          <ComeFunziona />
          <SceltaRuolo workshopId={ws.id} studentId={contesto.userId} supabase={supabase} />
        </>
      )}

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

          {WORKSHOP_ELABORATO[ws.slug]?.[ruoloIscritto.slug] && (
            <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-6 sm:p-8">
              <h2 className="font-heading text-base font-semibold text-kireo-light">Il tuo progetto online</h2>
              <p className="mt-1 text-sm text-kireo-muted">
                Lavora al tuo elaborato a tappe, con salvataggio automatico e un tutor AI su richiesta.
              </p>
              <Link
                href={`/app/workshop/${ws.slug}/progetto`}
                className="mt-4 inline-flex rounded-full bg-kireo-orange px-5 py-2.5 text-sm font-semibold text-kireo-dark hover:bg-kireo-orange/90"
              >
                Vai al progetto →
              </Link>
            </div>
          )}

          {WORKSHOP_KIT[ws.slug]?.[ruoloIscritto.slug] && <KitRuolo ruolo={ruoloIscritto.titolo} materiali={WORKSHOP_KIT[ws.slug][ruoloIscritto.slug]} />}

          <Peers workshopId={ws.id} supabase={supabase} />
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

// Qui c'era il punto di ingresso del CARICAMENTO FILE (motore v1): il blocco
// che elencava le consegne caricate e mostrava il form di upload. Tolto il
// 2026-08-29 perché tutti e 25 i ruoli hanno il loro elaborato a tappe, e due
// modi di consegnare lo stesso lavoro producevano due giudizi sulla stessa
// iscrizione. Restano intatti la tabella `workshop_consegne`, i file già
// caricati e il componente `ConsegnaUpload`: rimettere il blocco è una riga.
