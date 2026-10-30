import Link from "next/link";
import { getEnteContext } from "@/lib/ente/context";
import { getQuoteEnte } from "@/lib/ente/quote";
import { createClient } from "@/lib/supabase/server";
import { ETICHETTA_PIANO, trovaPianoSuccessivo, type PianoQuote } from "@/lib/ente/pianoSuccessivo";
import NewsletterForm, { type NewsletterIniziale } from "@/components/ente/NewsletterForm";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";
import {
  ETICHETTA_STATO_NEWSLETTER,
  TESTI_NEWSLETTER,
  giornoItaliano,
  piuGiorni,
  testoEsitoNewsletter,
  type EsitoNewsletter,
  type StatoNewsletter,
} from "@/lib/newsletter/regole";

const CLASSE_STATO: Record<StatoNewsletter, string> = {
  bozza: "bg-white/10 text-kireo-light",
  in_approvazione: "bg-kireo-orange/15 text-kireo-orange",
  approvata: "bg-kireo-green/15 text-kireo-green-light",
  rifiutata: "bg-red-500/15 text-red-300",
  inviata: "bg-kireo-green/15 text-kireo-green-light",
};

type Riga = {
  id: string;
  oggetto: string;
  corpo: string;
  giorno: string;
  ultimo_giorno: string;
  stato: StatoNewsletter;
  nota_revisione: string | null;
};

// La newsletter dell'ente (30/10, 20261117110000). Le proposte fatte prima
// stanno in `comunicazioni` e restano qui come archivio: non le legge nessun
// motore, e non partono (la regola è in testa alla migrazione).
export default async function EnteComunicazioniPage({ searchParams }: { searchParams: Promise<{ modifica?: string; salvata?: string }> }) {
  const { modifica, salvata } = await searchParams;
  const contesto = await getEnteContext();
  const supabase = await createClient();
  const oggi = giornoItaliano(new Date());

  const [nlRes, vecchieRes, { data: piani }, quote, pieniRes] = await Promise.all([
    supabase
      .from("newsletter_enti")
      .select("id, oggetto, corpo, giorno, ultimo_giorno, stato, nota_revisione")
      .eq("istituzione_id", contesto.istituzioneId)
      .order("giorno", { ascending: false }),
    supabase
      .from("comunicazioni")
      .select("id, oggetto, stato, created_at")
      .eq("istituzione_id", contesto.istituzioneId)
      .order("created_at", { ascending: false }),
    supabase.from("piani").select("id, nome, prezzo_min, prezzo_max, quota_eventi_promossi, quota_newsletter, quota_cta_esterne"),
    getQuoteEnte(supabase, contesto.istituzioneId, contesto.pianoNome),
    supabase.rpc("giorni_newsletter_pieni", { p_da: piuGiorni(oggi, 1), p_a: piuGiorni(oggi, 120) }),
  ]);
  if (nlRes.error) console.error("[ente newsletter]:", descriviErrore(nlRes.error));
  if (pieniRes.error) console.error("[ente newsletter] giorni pieni:", descriviErrore(pieniRes.error));

  const righe = nlRes.error ? null : ((nlRes.data ?? []) as Riga[]);
  const giorniPieni = pieniRes.error ? null : ((pieniRes.data ?? []) as { giorno: string }[]).map((g) => g.giorno);

  // Com'è andata, per quelle già partite: solo conteggi, mai chi.
  const esiti = new Map<string, EsitoNewsletter | null>();
  for (const r of righe ?? []) {
    if (r.stato !== "inviata") continue;
    const { data, error } = await supabase.rpc("esito_newsletter", { p_id: r.id });
    const e = data as { destinatari?: number; inviate?: number; in_coda?: number; fallite?: number; scadute?: number } | null;
    esiti.set(
      r.id,
      error || !e
        ? null
        : { destinatari: e.destinatari ?? 0, inviate: e.inviate ?? 0, inCoda: e.in_coda ?? 0, fallite: e.fallite ?? 0, scadute: e.scadute ?? 0 },
    );
  }

  const daModificare = modifica ? (righe ?? []).find((r) => r.id === modifica && r.stato !== "inviata") : undefined;
  const iniziale: NewsletterIniziale | null = daModificare
    ? {
        id: daModificare.id,
        oggetto: daModificare.oggetto,
        corpo: daModificare.corpo,
        giorno: daModificare.giorno,
        ultimoGiorno: daModificare.ultimo_giorno,
        stato: daModificare.stato,
      }
    : null;

  const pianoSuccessivo = trovaPianoSuccessivo(contesto.pianoNome, (piani ?? []) as PianoQuote[]);
  const vecchie = vecchieRes.error ? [] : (vecchieRes.data ?? []);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Newsletter</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">La tua newsletter</h1>
        <p className="mt-2 text-kireo-muted">
          La scrivi tu, la legge KIREO, e la manda KIREO ai tuoi iscritti: non vedi i loro indirizzi.
        </p>
        <p className="mt-2 text-sm text-kireo-muted">
          {quote ? TESTI_NEWSLETTER.quota(quote.newsletterUsate, quote.newsletterTotali) : TESTI_NEWSLETTER.quotaNonLetta}
          {quote && quote.newsletterUsate >= quote.newsletterTotali && pianoSuccessivo && (
            <>
              {" "}
              Il piano {ETICHETTA_PIANO[pianoSuccessivo.nome] ?? pianoSuccessivo.nome} ne include {pianoSuccessivo.quota_newsletter}.{" "}
              <Link href="/ente/piano" className="text-kireo-orange underline underline-offset-2">
                Scopri i piani →
              </Link>
            </>
          )}
        </p>
      </div>

      {righe === null ? (
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-kireo-muted">
          Non siamo riusciti a leggere le tue newsletter: ricarica la pagina.
        </p>
      ) : righe.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non hai ancora scritto nessuna newsletter.
        </p>
      ) : (
        <ul className="space-y-3">
          {righe.map((r) => (
            <li
              key={r.id}
              id={`newsletter-${r.id}`}
              className={`scroll-mt-24 rounded-xl border bg-kireo-card p-4 ${r.id === salvata ? "border-kireo-green" : "border-white/5"}`}
            >
              {r.id === salvata && (
                <p role="status" className="mb-3 rounded-lg bg-kireo-green/15 px-3 py-2 text-sm text-kireo-green-light">
                  {TESTI_NEWSLETTER.salvata(r.stato)}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CLASSE_STATO[r.stato]}`}>
                    {ETICHETTA_STATO_NEWSLETTER[r.stato] ?? r.stato}
                  </span>
                  <span className="font-heading text-sm font-semibold text-kireo-light">{r.oggetto}</span>
                  <p className="mt-1 text-xs text-kireo-muted">
                    Parte il {formattaData(r.giorno, "long")} alle 7:30 · per email fino al {formattaData(r.ultimo_giorno, "long")}
                  </p>
                </div>
                {r.stato !== "inviata" && !(r.giorno <= oggi && (r.stato === "approvata" || r.stato === "in_approvazione")) && (
                  <Link href={`/ente/comunicazioni?modifica=${r.id}#form`} className="text-sm text-kireo-orange underline underline-offset-2">
                    Modifica
                  </Link>
                )}
              </div>
              {r.nota_revisione && (
                <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-kireo-muted">
                  {r.stato === "rifiutata" ? "Perché non è stata approvata: " : "Nota di revisione: "}
                  {r.nota_revisione}
                </p>
              )}
              {r.stato === "inviata" && (
                <div className="mt-3 space-y-1 text-sm text-kireo-muted">
                  {testoEsitoNewsletter(esiti.get(r.id) ?? null).map((riga) => (
                    <p key={riga}>{riga}</p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div id="form">
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
          {iniziale ? "Modifica la newsletter" : "Nuova newsletter"}
        </h2>
        <div className="mt-4">
          <NewsletterForm key={iniziale?.id ?? `nuova-${salvata ?? ""}`} iniziale={iniziale} oggi={oggi} giorniPieni={giorniPieni} />
        </div>
      </div>

      {vecchie.length > 0 && (
        <div>
          <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Proposte di prima</h2>
          <p className="mt-1 text-sm text-kireo-muted">{TESTI_NEWSLETTER.proposteDiPrima}</p>
          <ul className="mt-3 space-y-2">
            {vecchie.map((c) => (
              <li key={c.id} className="rounded-xl border border-white/5 bg-kireo-card p-3 text-sm text-kireo-muted">
                <span className="text-kireo-light">{c.oggetto}</span> · {formattaData(c.created_at, "long")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
