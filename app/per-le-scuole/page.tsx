import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import Card from "@/components/Card";
import SectionHeading from "@/components/SectionHeading";
import RichiestaInformazioniForm from "@/components/RichiestaInformazioniForm";

export const metadata: Metadata = {
  title: "Per le scuole — KIREO",
  description:
    "KIREO offre alle scuole superiori un percorso di orientamento certificato e valido come PCTO. Gratuito, senza burocrazia.",
};

const OFFERTA = [
  {
    title: "Percorsi validi come PCTO",
    description:
      "Le attività di orientamento su KIREO — test attitudinali, guide, webinar, workshop, laboratori — sono progettate per essere riconosciute come PCTO in modalità digitale, in linea con le Linee guida ministeriali.",
  },
  {
    title: "Giustificativi automatici",
    description:
      "Ogni ora di attività viene tracciata e i giustificativi si generano automaticamente. La segreteria li riceve già pronti: niente moduli, niente raccolta firme, niente fogli Excel.",
  },
  {
    title: "Dashboard docente",
    description:
      "I docenti referenti seguono l'attività degli studenti in tempo reale: ore maturate, attività svolte, progressi del profilo attitudinale. Statistiche chiare, esportabili, sempre aggiornate.",
  },
  {
    title: "Orientamento che funziona davvero",
    description:
      "Non solo ore da certificare: gli studenti escono dal percorso con una direzione. Il PCTO smette di essere un adempimento e torna a essere ciò per cui è nato — orientare.",
  },
];

export default function PerLeScuole() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Per le scuole superiori
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            Il PCTO che si gestisce da solo.
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            KIREO offre alla tua scuola un percorso di orientamento certificato e valido come PCTO.
            Giustificativi automatici, dashboard per i docenti, zero burocrazia. E completamente
            gratuito.
          </p>
          <div className="mt-8">
            <ButtonLink href="#richiedi-informazioni" variant="primary">
              Richiedi informazioni
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeading
            eyebrow="Il percorso"
            title="Un percorso di orientamento completo. Chiavi in mano."
            description="KIREO accompagna i tuoi studenti in un percorso di orientamento strutturato, con incontri online e in presenza, attività su innumerevoli aree di interesse — dai test attitudinali ai workshop, dai webinar ai laboratori pratici. Ogni attività è tracciata: i docenti referenti seguono tutto in tempo reale da una dashboard con statistiche complete, mentre i giustificativi PCTO si generano automaticamente. La scuola offre un orientamento di qualità; la burocrazia la gestiamo noi."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="Il servizio" title="Orientamento vero. PCTO certificato." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {OFFERTA.map((o) => (
            <Card key={o.title} title={o.title} description={o.description} />
          ))}
        </div>
      </section>

      <section id="richiedi-informazioni" className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-2xl px-6 py-20">
          <div className="text-center">
            <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
              Parla con un esperto KIREO
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-kireo-muted">
              Lascia i tuoi riferimenti: un esperto di orientamento KIREO ti contatterà per
              presentarti nel dettaglio il percorso, la dashboard e l&apos;attivazione della
              convenzione. Senza impegno e senza costi.
            </p>
          </div>

          <div className="mt-10">
            <RichiestaInformazioniForm />
          </div>
        </div>
      </section>
    </>
  );
}
