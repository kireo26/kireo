import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Come funziona — KIREO",
  description: "Scopri come funziona il percorso di orientamento KIREO, passo dopo passo.",
};

const PASSI = [
  {
    numero: "01",
    titolo: "Crea il tuo profilo",
    descrizione:
      "In pochi minuti racconti i tuoi interessi, le materie in cui ti senti più portato e il tipo di futuro che immagini per te. Da qui parte il tuo percorso di orientamento personalizzato.",
  },
  {
    numero: "02",
    titolo: "Inizia a orientarti",
    descrizione:
      "Consulta guide, fai test attitudinali, segui webinar, partecipa a workshop e laboratori, mettiti alla prova con attività di gaming e sfide di orientamento. Ogni attività fa emergere qualcosa di te: interessi, punti di forza, inclinazioni che non sapevi di avere.",
  },
  {
    numero: "03",
    titolo: "Confrontati con orientatori esperti",
    descrizione:
      "Non sei solo davanti alla scelta: puoi metterti in contatto diretto con orientatori esperti che ti aiutano a leggere i risultati del tuo percorso e a mettere a fuoco la direzione.",
  },
  {
    numero: "04",
    titolo: "Scopri le opportunità giuste per te",
    descrizione:
      "Al termine del percorso, KIREO ti mostra le opportunità post-diploma coerenti con le tue attitudini e passioni: università, ITS Academy, accademie, formazione professionale o mondo del lavoro. La scelta resta tua — ora però è una scelta consapevole.",
  },
];

const FAQ = [
  {
    domanda: "L'orientamento su KIREO è gratuito?",
    risposta:
      "Sì, completamente. Tutte le attività di orientamento — test attitudinali, guide, webinar, workshop, il confronto con gli orientatori — sono gratuite per gli studenti e per le scuole. Nessun costo nascosto, nessun abbonamento: l'orientamento è un diritto, non un prodotto.",
  },
  {
    domanda: "Come funziona il percorso di orientamento?",
    risposta:
      "Parti creando il tuo profilo, poi esplori le attività che preferisci: test, guide, webinar, laboratori, sfide di orientamento. Ogni attività contribuisce a costruire il tuo profilo attitudinale. Quando vuoi, ti confronti con un orientatore esperto. Alla fine hai due risultati concreti: una direzione chiara per il tuo futuro e le ore PCTO certificate.",
  },
  {
    domanda: "Le attività su KIREO valgono come PCTO?",
    risposta:
      "Sì. Le attività di orientamento svolte su KIREO sono progettate per essere riconosciute come PCTO (Percorsi per le Competenze Trasversali e l'Orientamento), che la normativa prevede anche in modalità digitale. KIREO attiva una convenzione con la tua scuola e i giustificativi vengono generati automaticamente: né tu né i tuoi docenti dovete compilare moduli.",
  },
  {
    domanda: "Chi sono gli orientatori di KIREO?",
    risposta:
      "Sono professionisti esperti nei diversi settori del mondo KIREO: università, formazione tecnica, professioni, mondo del lavoro. Non rappresentano nessuna istituzione e non hanno nulla da venderti: il loro compito è aiutarti a leggere i risultati del tuo percorso e a mettere a fuoco la tua direzione.",
  },
  {
    domanda: "KIREO mi dirà cosa devo scegliere?",
    risposta:
      "No, e questa è la differenza. KIREO non spinge verso nessun percorso: ti mostra le opportunità coerenti con le attitudini e le passioni emerse durante il tuo orientamento — università, ITS Academy, accademie, formazione professionale o lavoro. La scelta resta tua: noi la rendiamo consapevole.",
  },
  {
    domanda: "Cosa ottengo alla fine del percorso?",
    risposta:
      "Due cose. La prima è l'obiettivo vero: sapere chi sei e quale direzione è coerente con te. La seconda è l'attestazione delle ore PCTO maturate durante le attività, che la tua scuola riceve automaticamente. Orientamento raggiunto, burocrazia azzerata.",
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
            KIREO accompagna gli studenti lungo tutto il percorso di orientamento: dalla scoperta
            delle proprie attitudini al confronto con gli orientatori, fino alle opportunità
            coerenti con chi sei.
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

      <section className="bg-kireo-green">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <span className="inline-block rounded-full bg-kireo-dark/20 px-4 py-1 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-light">
            PCTO
          </span>
          <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
            E mentre ti orienti, accumuli ore PCTO
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-kireo-light/90">
            Le attività di orientamento su KIREO sono certificate e valide come PCTO. I
            giustificativi vengono generati automaticamente e la tua scuola li riceve senza moduli
            né burocrazia: tu pensi a scoprire chi sei, al resto pensiamo noi.
          </p>
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
