import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import Card from "@/components/Card";
import SectionHeading from "@/components/SectionHeading";

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

const STEP = [
  {
    numero: "01",
    titolo: "La scuola firma la convenzione",
    descrizione:
      "Un accordo semplice e leggero tra la scuola e KIREO, come previsto dalla normativa PCTO. Ci pensiamo noi a prepararlo.",
  },
  {
    numero: "02",
    titolo: "Gli studenti si iscrivono",
    descrizione:
      "Ogni studente crea il proprio profilo gratuito e inizia il percorso di orientamento, a scuola o da casa, al proprio ritmo.",
  },
  {
    numero: "03",
    titolo: "La scuola monitora e riceve",
    descrizione:
      "I docenti seguono i progressi dalla dashboard e la segreteria riceve i giustificativi automaticamente. Fine della burocrazia.",
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
            <ButtonLink href="/contatti" variant="primary">
              Attiva la convenzione con la tua scuola
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeading
            eyebrow="Il contesto"
            title="90, 150, 210 ore. Per ogni studente."
            description="La normativa richiede un monte ore minimo di PCTO nel triennio finale: 90 ore nei licei, 150 negli istituti tecnici, 210 nei professionali. Trovare percorsi validi, gestire convenzioni, raccogliere giustificativi e monitorare le attività di centinaia di studenti è un carico enorme per docenti e segreterie. KIREO lo azzera."
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

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading eyebrow="Come si attiva" title="Tre passi, nessun costo." align="center" />
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEP.map((s) => (
              <div key={s.numero} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-lg font-bold leading-[1.25] text-kireo-orange">
                  {s.numero}
                </div>
                <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
                  {s.titolo}
                </h3>
                <p className="mt-2 text-sm text-kireo-muted">{s.descrizione}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-kireo-green">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
            Quanto costa? Niente.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-kireo-light/90">
            KIREO è gratuito per le scuole e per gli studenti, oggi e domani. Il progetto si
            sostiene con i servizi alle istituzioni formative post-diploma — mai con le scuole,
            mai con le famiglie.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contatti" variant="outline" className="border-kireo-light/60">
              Parla con noi
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
