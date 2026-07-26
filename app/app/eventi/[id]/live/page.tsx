import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import PannelloLive from "@/components/live/PannelloLive";

// Accesso solo autenticato (garantito dal layout /app + middleware) E
// iscritto: un evento non trovato o non pubblico=studenti dà 404 (RLS
// legge solo eventi approvati, un id di bozza/in_approvazione risulta
// semplicemente assente), un evento trovato ma senza iscrizione mostra un
// messaggio onesto invece del pannello live.
export default async function EventoLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contesto = await getAppContext();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventi")
    .select("id, titolo, data_inizio, data_fine, youtube_video_id, pubblico")
    .eq("id", id)
    .maybeSingle();

  if (!evento || evento.pubblico !== "studenti") notFound();

  const { data: iscrizione } = await supabase
    .from("iscrizioni_eventi")
    .select("student_id")
    .eq("evento_id", id)
    .eq("student_id", contesto.userId)
    .maybeSingle();

  if (!iscrizione) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="font-heading text-lg font-semibold text-kireo-light">Non risulti iscritto a questo evento</p>
        <p className="mt-2 text-sm text-kireo-muted">Iscriviti dall&apos;Agenda per accedere alla diretta.</p>
        <Link href="/app/agenda" className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
          ← Vai all&apos;Agenda
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
        hrefRitorno="/app/agenda"
      />
    </div>
  );
}
