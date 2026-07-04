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

const FEATURE_STUDENTI = [
  "Percorso di orientamento personalizzato",
  "Test attitudinali progressivi",
  "Profilo delle attitudini che cresce con te",
  "Esplorazione guidata di studio e lavoro",
];

const FEATURE_SCUOLE = [
  "Giustificativi PCTO automatici",
  "Dashboard docente con statistiche di attività",
  "Monitoraggio attitudini e progressi degli studenti",
  "Zero burocrazia aggiuntiva per la segreteria",
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
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <ButtonLink href="/contatti" variant="primary">
              Sono uno studente
            </ButtonLink>
            <ButtonLink href="/contatti" variant="outline">
              Sono una scuola
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

      {/* Studenti / Scuole superiori */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="Per chi è KIREO" title="Due mondi. Un'unica direzione." align="center" />
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-kireo-card p-8">
            <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
              Per gli studenti
            </p>
            <h3 className="py-0.5 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">
              Scopri le tue vere attitudini.
            </h3>
            <p className="mt-2 text-sm text-kireo-muted">
              Non ti diciamo cosa scegliere: ti aiutiamo a capire chi sei. Percorsi personalizzati,
              test attitudinali e una mappa chiara delle direzioni possibili — studio o lavoro.
            </p>
            <ul className="mt-6 space-y-3">
              {FEATURE_STUDENTI.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-kireo-light/90">
                  <span className="mt-0.5 text-kireo-orange">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ButtonLink href="/contatti" variant="primary">
                Inizia il tuo orientamento
              </ButtonLink>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-kireo-card p-8">
            <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
              Per le scuole superiori
            </p>
            <h3 className="py-0.5 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">
              Il PCTO, finalmente automatizzato.
            </h3>
            <p className="mt-2 text-sm text-kireo-muted">
              KIREO offre alle scuole superiori un servizio PCTO completo: percorsi validi,
              giustificativi generati automaticamente, e strumenti di monitoraggio per i docenti.
            </p>
            <ul className="mt-6 space-y-3">
              {FEATURE_SCUOLE.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-kireo-light/90">
                  <span className="mt-0.5 text-kireo-orange">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ButtonLink href="/contatti" variant="outline">
                Contattaci
              </ButtonLink>
            </div>
          </div>
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
            <ButtonLink href="/contatti" variant="outline" className="border-kireo-light/60">
              Inizia il tuo orientamento
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Docenti */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Per gli insegnanti"
              title="AI & EdTech: resta aggiornato."
              description="KIREO ospita una sezione dedicata alla formazione docenti su intelligenza artificiale, strumenti digitali e innovazione didattica. Webinar gratuiti mensili, risorse scaricabili, newsletter."
            />
          </div>
          <div className="rounded-2xl border border-white/5 bg-kireo-card p-8">
            <p className="font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
              Prossimo webinar
            </p>
            <h3 className="mt-2 py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
              Intelligenza artificiale in classe: strumenti e casi pratici
            </h3>
            <p className="mt-2 text-sm text-kireo-muted">15 settembre 2026 · ore 17:00 · online</p>
            <div className="mt-6">
              <ButtonLink href="/contatti" variant="primary">
                Scopri le risorse
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
