import { getEnteContext } from "@/lib/ente/context";
import { getQuoteEnte } from "@/lib/ente/quote";
import { createClient } from "@/lib/supabase/server";
import { ETICHETTA_PIANO, trovaPianoSuccessivo, type PianoQuote } from "@/lib/ente/pianoSuccessivo";
import CreaComunicazioneForm from "@/components/ente/CreaComunicazioneForm";

const ETICHETTA_STATO: Record<string, { label: string; classe: string }> = {
  bozza: { label: "Bozza", classe: "bg-white/10 text-kireo-light" },
  in_approvazione: { label: "In approvazione", classe: "bg-kireo-orange/15 text-kireo-orange" },
  approvata: { label: "Approvata", classe: "bg-kireo-green/15 text-kireo-green-light" },
  rifiutata: { label: "Rifiutata", classe: "bg-red-500/15 text-red-300" },
  inviata: { label: "Inviata", classe: "bg-kireo-green/15 text-kireo-green-light" },
};

export default async function EnteComunicazioniPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const [{ data: comunicazioni }, { data: piani }, quote] = await Promise.all([
    supabase
      .from("comunicazioni")
      .select("id, tipo, oggetto, stato, note_revisione, created_at")
      .eq("istituzione_id", contesto.istituzioneId)
      .order("created_at", { ascending: false }),
    supabase
      .from("piani")
      .select("id, nome, prezzo_min, prezzo_max, quota_webinar_anno, quota_newsletter, quota_cta_esterne, quota_comunicazioni_kireo"),
    getQuoteEnte(supabase, contesto.istituzioneId, contesto.pianoNome),
  ]);

  const pianoSuccessivo = trovaPianoSuccessivo(contesto.pianoNome, (piani ?? []) as PianoQuote[]);
  const nudgeNewsletter = pianoSuccessivo
    ? `Il piano ${ETICHETTA_PIANO[pianoSuccessivo.nome] ?? pianoSuccessivo.nome} include fino a ${pianoSuccessivo.quota_newsletter} newsletter/anno.`
    : null;
  const nudgeComunicazioneKireo = "Le comunicazioni mirate sono incluse nel piano Premium.";

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Comunicazioni</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          Newsletter e comunicazioni
        </h1>
        <p className="mt-2 text-kireo-muted">Proponi il contenuto: KIREO lo revisiona e lo veicola, nessun invio diretto.</p>
      </div>

      {!comunicazioni || comunicazioni.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non hai ancora proposto nessuna comunicazione.
        </div>
      ) : (
        <ul className="space-y-3">
          {comunicazioni.map((c) => {
            const stato = ETICHETTA_STATO[c.stato] ?? ETICHETTA_STATO.bozza;
            return (
              <li key={c.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stato.classe}`}>
                      {stato.label}
                    </span>
                    <span className="font-heading text-sm font-semibold text-kireo-light">{c.oggetto}</span>
                    <p className="mt-1 text-xs text-kireo-muted">
                      {c.tipo === "newsletter" ? "Newsletter" : "Comunicazione mirata"} ·{" "}
                      {new Date(c.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}
                    </p>
                  </div>
                </div>
                {c.note_revisione && (
                  <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-kireo-muted">
                    Nota di revisione: {c.note_revisione}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Nuova comunicazione</h2>
        <div className="mt-4">
          <CreaComunicazioneForm
            istituzioneId={contesto.istituzioneId}
            pianoPremium={contesto.pianoNome === "premium"}
            quotaNewsletterRimasta={quote.newsletterTotali - quote.newsletterUsate}
            quotaComunicazioniKireoRimasta={quote.comunicazioniKireoTotali - quote.comunicazioniKireoUsate}
            nudgeNewsletter={nudgeNewsletter}
            nudgeComunicazioneKireo={nudgeComunicazioneKireo}
          />
        </div>
      </div>
    </div>
  );
}
