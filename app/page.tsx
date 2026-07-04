import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import Card from "@/components/Card";
import SectionHeading from "@/components/SectionHeading";

const PROBLEMI = [
  {
    title: "Scegliere senza conoscersi",
    description:
      "La maggior parte degli studenti sceglie il percorso post-diploma senza aver mai esplorato davvero le proprie attitudini. Il risultato: abbandoni, ripensamenti, tempo perso.",
  },
  {
    title: "L'orientamento a scuola non basta",
    description:
      "Un incontro in aula magna e qualche brochure non sono un percorso di orientamento. Serve un metodo continuativo, personale, misurabile.",
  },
  {
    title: "Il PCTO è un carico, non un'opportunità",
    description:
      "Per docenti e scuole la gestione dei percorsi è burocrazia: documenti, giustificativi, monitoraggio. Tutto a mano.",
  },
];

const STEP = [
  {
    numero: "01",
    titolo: "Scopri chi sei",
    descrizione:
      "Test attitudinali e percorsi guidati che aiutano lo studente a far emergere interessi, punti di forza e inclinazioni reali.",
  },
  {
    numero: "02",
    titolo: "Esplora le direzioni possibili",
    descrizione:
      "Studio o lavoro, università o formazione tecnica: KIREO mostra le strade coerenti con il profilo di ciascuno, senza spingere verso nessuna.",
  },
  {
    numero: "03",
    titolo: "Segui il percorso nel tempo",
    descrizione:
      "L'orientamento non è un giorno, è un processo. Lo studente costruisce il suo percorso, la scuola lo accompagna con dati concreti.",
  },
];

const PUBBLICI = [
  {
    tag: "Per gli studenti",
    tagClass: "bg-kireo-green/15 text-kireo-green-light",
    titolo: "Scopri chi sei. Scegli con chiarezza.",
    testo:
      "Un percorso di orientamento personalizzato e gratuito che fa emergere le tue attitudini — e ti mostra le direzioni coerenti con te, che siano studio o lavoro.",
    lista: [
      "Percorso di orientamento su misura",
      "Test, guide, webinar, workshop e sfide",
      "Confronto diretto con orientatori esperti",
      "Ore PCTO certificate mentre ti orienti",
    ],
    cta: "Inizia il tuo percorso →",
    href: "/registrazione",
  },
  {
    tag: "Per le scuole",
    tagClass: "bg-kireo-orange/15 text-kireo-orange",
    titolo: "Il PCTO che si gestisce da solo.",
    testo:
      "Un servizio di orientamento certificato e gratuito per la tua scuola: gli studenti maturano ore PCTO, i docenti monitorano, la segreteria riceve tutto automaticamente.",
    lista: [
      "Percorsi validi come PCTO, in digitale",
      "Giustificativi generati automaticamente",
      "Dashboard docente con statistiche",
      "Zero costi, oggi e domani",
    ],
    cta: "Scopri il servizio →",
    href: "/per-le-scuole",
  },
  {
    tag: "Per i docenti",
    tagClass: "bg-kireo-logo/15 text-kireo-logo",
    titolo: "L'aggiornamento che ti serve. Gratis.",
    testo:
      "L'AI sta cambiando la scuola e la formazione è ormai un obbligo. Iscrivendoti a KIREO hai formazione continua di qualità, senza costi e senza vincoli.",
    lista: [
      "Webinar mensili con attestato di partecipazione",
      "Guide e materiali pronti per l'aula, scaricabili",
      "Newsletter mensile su AI e scuola",
      "Una community di colleghi che innovano",
    ],
    cta: "Iscriviti →",
    href: "/per-i-docenti",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
        <div className="max-w-3xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Orientamento post-diploma
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-6xl">
            Orientamento. Direzione. Futuro.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-kireo-muted">
            KIREO guida gli studenti a scoprire le proprie attitudini con percorsi di orientamento
            personalizzati. Studio o lavoro: la direzione giusta è quella che parte da chi sei.
          </p>
          <div className="mt-10 flex flex-col gap-4 md:flex-row">
            <ButtonLink href="/registrazione" variant="primary">
              Sono uno studente
            </ButtonLink>
            <ButtonLink href="/per-le-scuole" variant="outline">
              Sono una scuola
            </ButtonLink>
            <ButtonLink href="/per-i-docenti" variant="ghost">
              Sono un docente
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Il problema"
          title="Scegliere il percorso giusto è più difficile di quanto dovrebbe"
          description="Ogni anno migliaia di diplomandi affrontano la scelta più importante senza gli strumenti giusti."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMI.map((p) => (
            <Card key={p.title} title={p.title} description={p.description} />
          ))}
        </div>
      </section>

      {/* Come funziona */}
      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading eyebrow="Come funziona" title="Tre passi verso la tua direzione" align="center" />
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
          <div className="mt-12 text-center">
            <ButtonLink href="/come-funziona" variant="ghost">
              Scopri tutti i dettagli →
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Per chi è KIREO */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="Per chi è KIREO" title="Tre mondi. Un'unica direzione." align="center" />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PUBBLICI.map((p) => (
            <div key={p.tag} className="flex flex-col rounded-2xl border border-white/5 bg-kireo-card p-8">
              <span
                className={`inline-block w-fit rounded-full px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wide ${p.tagClass}`}
              >
                {p.tag}
              </span>
              <h3 className="mt-4 py-0.5 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">
                {p.titolo}
              </h3>
              <p className="mt-2 text-sm text-kireo-muted">{p.testo}</p>
              <ul className="mt-6 space-y-3">
                {p.lista.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-kireo-light/90">
                    <span className="mt-0.5 text-kireo-orange">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className="mt-auto pt-8 text-sm font-semibold text-kireo-light transition-colors hover:text-kireo-orange"
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Strip claim */}
      <section className="bg-kireo-green">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
            Orientamento. Direzione. Futuro.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-kireo-light/90">
            KIREO non vende percorsi. Li illumina.
          </p>
          <div className="mt-8">
            <ButtonLink href="/registrazione" variant="outline" className="border-kireo-light/60">
              Inizia il tuo orientamento
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
