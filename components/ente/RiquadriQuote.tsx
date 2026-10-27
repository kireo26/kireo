import type { Quote } from "@/lib/ente/quote";

// I quattro riquadri delle quote (profilo e piano), in un posto solo: le due
// pagine li ricopiavano uguali, e il caso «non letto» andava scritto due volte.
//
// `quote === null` vuol dire che una lettura è fallita: si dice, invece di
// stampare 0/0 (che a un ente premium diceva «il tuo piano non comprende
// niente»). Testo mio, provvisorio.
export const TESTO_QUOTE_NON_LETTE = "Non siamo riusciti a leggere quanto hai usato del tuo piano: ricarica la pagina.";

export default function RiquadriQuote({ quote }: { quote: Quote | null }) {
  if (!quote) {
    return (
      <div className="rounded-2xl border border-white/5 bg-kireo-card p-4 text-sm text-kireo-muted">{TESTO_QUOTE_NON_LETTE}</div>
    );
  }
  const righe = [
    { label: "Eventi in evidenza", usati: quote.evidenzaUsate, totali: quote.evidenzaTotali },
    { label: "Newsletter", usati: quote.newsletterUsate, totali: quote.newsletterTotali },
    { label: "CTA esterne", usati: quote.ctaUsate, totali: quote.ctaTotali },
    { label: "Comunicazioni KIREO", usati: quote.comunicazioniKireoUsate, totali: quote.comunicazioniKireoTotali },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {righe.map((q) => (
        <div key={q.label} className="rounded-2xl border border-white/5 bg-kireo-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">{q.label}</p>
          <p className="mt-1 font-heading text-2xl font-bold text-kireo-light">
            {q.usati}
            <span className="text-base font-normal text-kireo-muted">/{q.totali}</span>
          </p>
          <p className="mt-1 text-xs text-kireo-muted">anno accademico corrente, solo approvate</p>
        </div>
      ))}
    </div>
  );
}
