import Link from "next/link";
import { getEnteContext } from "@/lib/ente/context";
import { getQuoteEnte } from "@/lib/ente/quote";
import RiquadriQuote from "@/components/ente/RiquadriQuote";
import { createClient } from "@/lib/supabase/server";
import ProfiloEnteForm from "@/components/ente/ProfiloEnteForm";

export default async function EnteProfiloPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const [{ data: istituzione }, { data: guide }, quote] = await Promise.all([
    supabase
      .from("istituzioni")
      .select("immagine_copertina_url, descrizione, sito_ufficiale, provincia")
      .eq("id", contesto.istituzioneId)
      .maybeSingle(),
    supabase.from("guide_enti").select("id, titolo, pdf_url").eq("istituzione_id", contesto.istituzioneId).order("created_at", { ascending: false }),
    getQuoteEnte(supabase, contesto.istituzioneId, contesto.pianoNome),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Profilo</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{contesto.nome}</h1>
        <p className="mt-2 text-kireo-muted">
          Piano <span className="font-semibold capitalize text-kireo-light">{contesto.pianoNome}</span> ·{" "}
          <Link href={`/istituzioni/${contesto.slug}`} className="text-kireo-orange underline underline-offset-2">
            Vedi il profilo pubblico
          </Link>
        </p>
      </div>

      <RiquadriQuote quote={quote} />

      <ProfiloEnteForm
        istituzioneId={contesto.istituzioneId}
        copertinaIniziale={istituzione?.immagine_copertina_url ?? null}
        descrizioneIniziale={istituzione?.descrizione ?? null}
        sitoIniziale={istituzione?.sito_ufficiale ?? null}
        provinciaIniziale={istituzione?.provincia ?? null}
        guideIniziali={guide ?? []}
      />
    </div>
  );
}
