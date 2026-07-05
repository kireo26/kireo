import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import Card from "@/components/Card";
import SectionHeading from "@/components/SectionHeading";

const PROBLEMI = [
  {
    title: "Percorsi su misura, non uguali per tutti",
    description:
      "Test attitudinali, guide, webinar, workshop, laboratori e sfide su numerose aree di interesse: ogni studente costruisce il proprio percorso di orientamento e scopre attitudini che non sapeva di avere.",
  },
  {
    title: "Un metodo continuo e misurabile",
    description:
      "L'orientamento su KIREO non è un evento, è un percorso che cresce nel tempo: ogni attività arricchisce il profilo attitudinale dello studente e avvicina la direzione giusta — studio o lavoro.",
  },
  {
    title: "E intanto maturi ore PCTO",
    description:
      "Le attività di orientamento valgono come PCTO: 90, 150 o 210 ore da completare nel triennio diventano un'occasione per conoscersi, con giustificativi automatici per la scuola. Zero burocrazia.",
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

const PUBBLICI_CTA = [
  {
    label: "Sono uno studente",
    href: "/per-gli-studenti",
    className: "bg-kireo-green text-kireo-light hover:bg-kireo-green-light",
  },
  {
    label: "Sono una scuola",
    href: "/per-le-scuole",
    className: "bg-kireo-orange text-[#1A1A18] hover:opacity-90",
  },
  {
    label: "Sono un docente",
    href: "/per-i-docenti",
    className: "bg-kireo-green-light text-kireo-light hover:opacity-90",
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
    href: "/per-gli-studenti",
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
    cta: "Entra in KIREO →",
    href: "/per-i-docenti#entra-in-kireo",
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
          <div className="mt-10">
            <ButtonLink href="/registrazione" variant="primary">
              Inizia il tuo percorso di orientamento
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Perché KIREO"
          title="Una scelta enorme merita strumenti all'altezza"
          description="Ogni anno circa 500.000 studenti si diplomano in Italia. E quasi una matricola su tre, nei primi anni, cambia strada o abbandona. Non per mancanza di talento: per mancanza di orientamento. KIREO nasce per questo."
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

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {PUBBLICI_CTA.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 font-sans text-sm font-semibold transition-colors sm:w-auto ${c.className}`}
            >
              {c.label}
            </Link>
          ))}
        </div>

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
            La direzione giusta non si indovina. Si scopre.
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
