import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app/studentContext";
import { WORKSHOP_ELABORATO } from "@/lib/workshop/elaborato-config";
import { WORKSHOP_CLIENTE_NOME } from "@/lib/workshop/config";
import type { FaseStatoRiga, FeedbackFinale, ValoreSezione } from "@/lib/workshop/elaboratoValore";
import ElaboratoEditor from "@/components/workshop/elaborato/ElaboratoEditor";
import { getIscrizioniWorkshop, scegliIscrizione, STATI_APRIBILI } from "@/lib/workshop/iscrizioneCorrente";

export const metadata = { title: "Il tuo progetto — KIREO" };

export default async function ProgettoWorkshopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: ws } = await supabase.from("workshop").select("id, slug, titolo").eq("slug", slug).eq("attivo", true).maybeSingle();
  if (!ws) notFound();

  // Una riga sola non è più garantita da nessun vincolo: chi lascia un ruolo e
  // ne prende un altro ne ha diverse. La scelta è una regola sola, condivisa
  // con le altre due pagine.
  const iscrizione = scegliIscrizione(await getIscrizioniWorkshop(supabase, ws.id, contesto.userId), STATI_APRIBILI);
  if (!iscrizione) redirect(`/app/workshop/${slug}`);

  const ruoloIscritto = iscrizione.workshop_ruoli;
  const elaboratoConfig = ruoloIscritto ? WORKSHOP_ELABORATO[slug]?.[ruoloIscritto.slug] : undefined;
  if (!ruoloIscritto || !elaboratoConfig) redirect(`/app/workshop/${slug}`);

  const COLONNE_FASI_STATO = "fase_id, stato, aperta_at, consegnata_at, revisionata_at, revisione, reazione_cliente, revisione_esito, tentativi_revisione";

  const { data: fasiStatoEsistenti } = await supabase.from("workshop_fasi_stato").select("fase_id").eq("iscrizione_id", iscrizione.id);

  // Primo accesso: nessuna riga di stato ancora creata — inizializza la
  // tappa 1 come aperta e le altre come bloccate (idempotente, non fa
  // nulla se richiamata di nuovo).
  if (!fasiStatoEsistenti || fasiStatoEsistenti.length === 0) {
    await supabase.rpc("inizializza_fasi_workshop", {
      p_iscrizione_id: iscrizione.id,
      p_fase_ids: elaboratoConfig.fasi.map((f) => f.id),
    });
  }

  const { data: fasiStatoRighe } = await supabase.from("workshop_fasi_stato").select(COLONNE_FASI_STATO).eq("iscrizione_id", iscrizione.id);

  const fasiStato: FaseStatoRiga[] = (fasiStatoRighe ?? []).map((r) => ({
    faseId: r.fase_id,
    stato: r.stato as FaseStatoRiga["stato"],
    apertaAt: r.aperta_at,
    consegnataAt: r.consegnata_at,
    revisionataAt: r.revisionata_at,
    revisione: r.revisione as FaseStatoRiga["revisione"],
    reazioneCliente: r.reazione_cliente,
    revisioneEsito: (r.revisione_esito as FaseStatoRiga["revisioneEsito"]) ?? null,
    tentativiRevisione: Number(r.tentativi_revisione) || 0,
  }));

  const { data: elaborato } = await supabase
    .from("workshop_elaborati")
    .select("contenuto, stato, fiducia, feedback_ai")
    .eq("iscrizione_id", iscrizione.id)
    .maybeSingle();

  const tappaAperta = fasiStato.find((f) => f.stato === "aperta");
  let messaggiTappaCorrente = 0;
  if (tappaAperta?.apertaAt) {
    const { count } = await supabase
      .from("workshop_chat_cliente")
      .select("id", { count: "exact", head: true })
      .eq("iscrizione_id", iscrizione.id)
      .eq("mittente", "studente")
      .gte("created_at", tappaAperta.apertaAt);
    messaggiTappaCorrente = count ?? 0;
  }

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
        nomeCliente={WORKSHOP_CLIENTE_NOME[slug] ?? "il cliente"}
        elaborato={elaboratoConfig}
        fasiStato={fasiStato}
        contenuto={(elaborato?.contenuto ?? {}) as Record<string, ValoreSezione>}
        fiducia={elaborato?.fiducia ?? 0}
        statoProgetto={(elaborato?.stato as "bozza" | "consegnato") ?? "bozza"}
        feedbackFinale={(elaborato?.feedback_ai as FeedbackFinale | null) ?? null}
        messaggiTappaCorrente={messaggiTappaCorrente}
      />
    </div>
  );
}
