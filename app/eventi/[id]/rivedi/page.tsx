import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlayerRegistrazione from "@/components/eventi/PlayerRegistrazione";
import { formattaData } from "@/lib/formato";
import { registrazioneRivedibile, TESTI_RIVEDI } from "@/lib/eventi/registrazione";

// RIVEDERE UNA DIRETTA (Mario, 31/10). Aperta a tutti — iscritti o no, anche
// senza aver fatto l'accesso — perché il video è pubblicato dall'ente e la
// pagina del suo ente lo mostra già a tutti. Si apre solo se la sonda ha visto
// la registrazione partire (`registrazioneRivedibile`); altrimenti lo dice.
//
// ⚠️ RIVEDERE NON È ESSERCI: questa pagina non manda battiti, non scrive
// presenze, non dà ore — e lo schermo lo dice sopra il video.
export const metadata: Metadata = { title: "Registrazione — KIREO" };

export default async function RivediPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventi")
    .select("id, titolo, tipo, data_inizio, data_fine, diretta_chiusa_il, youtube_video_id, registrazione_esito, istituzioni(nome, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!evento) notFound();

  const ente = (Array.isArray(evento.istituzioni) ? evento.istituzioni[0] : evento.istituzioni) as { nome?: string; slug?: string } | null;
  const rivedibile = registrazioneRivedibile(evento);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 sm:py-16">
      <div>
        {ente?.nome && <p className="text-sm font-semibold uppercase tracking-wide text-kireo-orange">{ente.nome}</p>}
        <h1 className="mt-2 py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">{evento.titolo}</h1>
        <p className="mt-1 text-sm text-kireo-muted">Si è svolto il {formattaData(evento.data_inizio, "long")}</p>
      </div>
      {rivedibile && evento.youtube_video_id ? (
        <>
          <p className="rounded-lg border border-white/10 bg-kireo-card px-4 py-3 text-sm text-kireo-light/90">{TESTI_RIVEDI.nonConta}</p>
          <PlayerRegistrazione eventoId={evento.id} videoId={evento.youtube_video_id} titolo={evento.titolo} />
        </>
      ) : (
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">{TESTI_RIVEDI.nonDisponibile}</p>
      )}
      {ente?.slug && (
        <Link href={`/istituzioni/${ente.slug}`} className="inline-block text-sm font-medium text-kireo-orange underline underline-offset-2">
          {TESTI_RIVEDI.tornaEnte}
        </Link>
      )}
    </div>
  );
}
