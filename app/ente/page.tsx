import Link from "next/link";
import { getEnteContext } from "@/lib/ente/context";
import { getQuoteEnte } from "@/lib/ente/quote";
import { createClient } from "@/lib/supabase/server";
import ProfiloEnteForm from "@/components/ente/ProfiloEnteForm";

export default async function EnteProfiloPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const [{ data: istituzione }, { data: guide }, quote] = await Promise.all([
    supabase
      .from("istituzioni")
      .select("immagine_copertina_url, descrizione, sito_ufficiale")
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Eventi in evidenza", usati: quote.evidenzaUsate, totali: quote.evidenzaTotali },
          { label: "Newsletter", usati: quote.newsletterUsate, totali: quote.newsletterTotali },
          { label: "CTA esterne", usati: quote.ctaUsate, totali: quote.ctaTotali },
          { label: "Comunicazioni KIREO", usati: quote.comunicazioniKireoUsate, totali: quote.comunicazioniKireoTotali },
        ].map((q) => (
          <div key={q.label} className="rounded-2xl border border-white/5 bg-kireo-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{q.label}</p>
            <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">
              {q.usati}
              <span className="text-base font-normal text-kireo-muted">/{q.totali}</span>
            </p>
            <p className="mt-1 text-xs text-kireo-muted">anno accademico corrente</p>
          </div>
        ))}
      </div>

      <ProfiloEnteForm
        istituzioneId={contesto.istituzioneId}
        copertinaIniziale={istituzione?.immagine_copertina_url ?? null}
        descrizioneIniziale={istituzione?.descrizione ?? null}
        sitoIniziale={istituzione?.sito_ufficiale ?? null}
        guideIniziali={guide ?? []}
      />
    </div>
  );
}
