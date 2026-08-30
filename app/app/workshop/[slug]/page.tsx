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
import RitiroIscrizione from "@/components/workshop/RitiroIscrizione";
import IscrizioneLasciata from "@/components/workshop/IscrizioneLasciata";
import { getIscrizioniWorkshop, scegliIscrizione, STATI_APRIBILI } from "@/lib/workshop/iscrizioneCorrente";

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

  // Non più una riga sola per studente e workshop: chi lascia un ruolo e ne
  // prende un altro ne ha diverse. La regola di scelta è condivisa con la
  // pagina del progetto e con quella del cliente — qui in più si guarda
  // l'ultima lasciata, per poterla riprendere.
  const righe = await getIscrizioniWorkshop(supabase, ws.id, contesto.userId);
  const iscrizione = scegliIscrizione(righe, STATI_APRIBILI);
  const lasciata = iscrizione ? null : scegliIscrizione(righe, ["ritirato"]);

  const ruoloIscritto = iscrizione?.workshop_ruoli ?? null;
  const ruoloLasciato = lasciata?.workshop_ruoli ?? null;

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
          {lasciata && ruoloLasciato ? (
            <IscrizioneLasciata iscrizioneId={lasciata.id} ruoloTitolo={ruoloLasciato.titolo} />
          ) : (
            <ComeFunziona />
          )}
          <SceltaRuolo workshopId={ws.id} studentId={contesto.userId} supabase={supabase} />
        </>
      )}

      {iscrizione && ruoloIscritto && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-kireo-card p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">
                {iscrizione.stato === "completato" ? "Progetto chiuso" : "Il tuo ruolo"}
              </p>
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

          {/* peers_workshop richiede un'iscrizione attiva: chi ha chiuso il
              progetto non è più un compagno di lavoro, e la funzione lo dice
              alzando non_autorizzato. Non la si chiama nemmeno. */}
          {iscrizione.stato === "attivo" && <Peers workshopId={ws.id} supabase={supabase} mioRuoloSlug={ruoloIscritto.slug} />}

          {iscrizione.stato === "attivo" && <RitiroIscrizione iscrizioneId={iscrizione.id} ruoloTitolo={ruoloIscritto.titolo} />}
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
  // Nessuna chiamata a `ruoli_occupati_workshop`: dal 2026-08-30 un ruolo già
  // preso da qualcuno non è un impedimento, quindi non c'è niente da
  // disabilitare qui.
  const { data: ruoli } = await supabase
    .from("workshop_ruoli")
    .select("id, slug, titolo, area_slug, descrizione")
    .eq("workshop_id", workshopId)
    .order("ordine");

  return <IscrizioneRuolo workshopId={workshopId} studentId={studentId} ruoli={ruoli ?? []} />;
}

async function Peers({
  workshopId,
  supabase,
  mioRuoloSlug,
}: {
  workshopId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  mioRuoloSlug: string;
}) {
  const { data: peers } = await supabase.rpc("peers_workshop", { p_workshop_id: workshopId });
  if (!peers || peers.length === 0) return null;
  return <NetworkPeers workshopId={workshopId} peers={peers} mioRuoloSlug={mioRuoloSlug} />;
}

// Qui c'era il punto di ingresso del CARICAMENTO FILE (motore v1): il blocco
// che elencava le consegne caricate e mostrava il form di upload. Tolto il
// 2026-08-29 perché tutti e 25 i ruoli hanno il loro elaborato a tappe, e due
// modi di consegnare lo stesso lavoro producevano due giudizi sulla stessa
// iscrizione. Restano intatti la tabella `workshop_consegne`, i file già
// caricati e il componente `ConsegnaUpload`: rimettere il blocco è una riga.
