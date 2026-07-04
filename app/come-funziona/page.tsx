import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Come funziona — KIREO",
  description: "Scopri come KIREO aiuta studenti e istituzioni a incontrarsi, passo dopo passo.",
};

const PASSI = [
  {
    numero: "01",
    titolo: "Crea il tuo profilo",
    descrizione:
      "In pochi minuti racconti i tuoi interessi, le materie in cui ti senti più portato e il tipo di futuro che immagini per te: universitario, tecnico-pratico o professionalizzante.",
  },
  {
    numero: "02",
    titolo: "Esplora i percorsi disponibili",
    descrizione:
      "Sfoglia il catalogo di università, ITS Academy, accademie e corsi professionalizzanti, filtrando per area di interesse, città e tipologia di percorso.",
  },
  {
    numero: "03",
    titolo: "Confronta e restringi la scelta",
    descrizione:
      "Metti a confronto i percorsi che ti interessano di più: durata, sbocchi, modalità di ammissione e caratteristiche distintive di ogni istituzione.",
  },
  {
    numero: "04",
    titolo: "Contatta le istituzioni",
    descrizione:
      "Invia una richiesta di contatto diretta alle istituzioni scelte e ricevi tutte le informazioni che ti servono per decidere con consapevolezza.",
  },
];

const FAQ = [
  {
    domanda: "KIREO è gratuito per gli studenti?",
    risposta:
      "Sì, KIREO è e sarà sempre completamente gratuito per gli studenti e per le scuole secondarie. Nessun costo, nessun abbonamento nascosto.",
  },
  {
    domanda: "Che tipo di istituzioni posso trovare su KIREO?",
    risposta:
      "Università, ITS Academy, accademie e corsi professionalizzanti presenti in tutta Italia, con profili verificati e aggiornati.",
  },
  {
    domanda: "Come faccio a contattare un'istituzione?",
    risposta:
      "Dal profilo di ogni istituzione puoi inviare una richiesta di contatto diretta: sarà l'istituzione a risponderti con le informazioni richieste.",
  },
  {
    domanda: "Cosa sono i giustificativi PCTO automatici?",
    risposta:
      "Sono documenti PDF generati automaticamente dal tuo profilo che attestano le attività di orientamento svolte su KIREO, utili per il percorso PCTO della tua scuola.",
  },
  {
    domanda: "Le mie scuole superiori pagano per usare KIREO?",
    risposta:
      "No. Le scuole secondarie non pagano mai: i ricavi di KIREO derivano esclusivamente dai piani a pagamento sottoscritti dalle istituzioni formative.",
  },
];

export default function ComeFunziona() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Come funziona
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            Dal dubbio alla scelta, in quattro passi
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            KIREO accompagna studenti diplomandi lungo tutto il percorso di orientamento, dalla
            scoperta dei propri interessi al contatto diretto con le istituzioni formative.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2">
          {PASSI.map((p) => (
            <div key={p.numero} className="rounded-2xl border border-white/5 bg-kireo-card p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-base font-bold leading-[1.25] text-kireo-orange">
                {p.numero}
              </div>
              <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
                {p.titolo}
              </h2>
              <p className="mt-3 text-sm text-kireo-muted">{p.descrizione}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <SectionHeading title="Domande frequenti" align="center" />
          <div className="mt-10 space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.domanda}
                className="group rounded-xl border border-white/5 bg-kireo-card p-5"
              >
                <summary className="cursor-pointer list-none py-0.5 font-heading text-base font-semibold leading-[1.25] text-kireo-light marker:content-none">
                  <span className="flex items-center justify-between gap-4">
                    {item.domanda}
                    <span className="text-kireo-orange transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-kireo-muted">{item.risposta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
