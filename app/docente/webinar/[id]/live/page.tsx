import { notFound } from "next/navigation";
import Link from "next/link";
import { getDocenteContext } from "@/lib/docente/context";
import { createClient } from "@/lib/supabase/server";
import PannelloLive from "@/components/live/PannelloLive";

// Stessa meccanica della pagina live studenti (app/app/eventi/[id]/live):
// qui pubblico=docenti. Le domande inviate da questa pagina sono visibili
// CON nome all'organizzatore (domande_live_organizzatore lo decide lato
// server in base a eventi.pubblico, non c'è nulla da differenziare qui).
export default async function WebinarLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contesto = await getDocenteContext();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventi")
    .select("id, titolo, data_inizio, data_fine, youtube_video_id, pubblico")
    .eq("id", id)
    .maybeSingle();

  if (!evento || evento.pubblico !== "docenti") notFound();

  const { data: iscrizione } = await supabase
    .from("iscrizioni_eventi")
    .select("student_id")
    .eq("evento_id", id)
    .eq("student_id", contesto.userId)
    .maybeSingle();

  if (!iscrizione) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="font-heading text-lg font-semibold text-kireo-light">Non risulti iscritto a questo webinar</p>
        <p className="mt-2 text-sm text-kireo-muted">Iscriviti dalla pagina Webinar per accedere alla diretta.</p>
        <Link href="/docente/webinar" className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
          ← Vai ai Webinar
        </Link>
      </div>
    );
  }

  const { data: domande } = await supabase
    .from("domande_live")
    .select("id, testo, stato, creata_il")
    .eq("evento_id", id)
    .eq("user_id", contesto.userId)
    .order("creata_il", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
      <PannelloLive
        eventoId={evento.id}
        userId={contesto.userId}
        titolo={evento.titolo}
        dataInizio={evento.data_inizio}
        dataFine={evento.data_fine}
        youtubeVideoId={evento.youtube_video_id}
        domandeIniziali={domande ?? []}
        hrefRitorno="/docente/webinar"
      />
    </div>
  );
}
