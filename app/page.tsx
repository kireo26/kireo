import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import SectionHeading from "@/components/SectionHeading";
import FaqAccordion from "@/components/FaqAccordion";

function IconaBussola({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="12" strokeLinecap="round" />
      <path d="M20.5 11.5 17 18l-6.5 3.5L14 15z" strokeLinejoin="round" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconaCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="12" strokeLinecap="round" />
      <path d="M11 16.5 14.5 20 21 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconaMappa({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M16 28s9-8.5 9-15a9 9 0 1 0-18 0c0 6.5 9 15 9 15Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="13" r="3.2" />
    </svg>
  );
}

function IconaCalendario({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <rect x="5" y="8" width="22" height="19" rx="2.5" />
      <path d="M5 13h22" strokeLinecap="round" />
      <path d="M11 5v6M21 5v6" strokeLinecap="round" />
    </svg>
  );
}

function IconaScudo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M16 4 26 8v7c0 7-4.5 11.5-10 13-5.5-1.5-10-6-10-13V8Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 16.5 14.5 19.5 21 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconaTraguardo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="11" />
      <circle cx="16" cy="16" r="6.5" />
      <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Stessa geometria della O-bussola del logo (components/Logo.tsx): anello
// aperto via strokeDasharray + ago a rombo arancione. Qui isolata (senza le
// lettere K-I-R-E) per i badge-cornice della home.
function IconaOBussola({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <g transform="translate(40,40)">
        <circle
          cx="0"
          cy="0"
          r="33"
          fill="none"
          stroke="#2FA57B"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="165 42.3"
          transform="rotate(-118)"
        />
        <g transform="rotate(40)">
          <path d="M 0,-18 L 9,8 L 0,3 L -9,8 Z" fill="#EF9F27" />
        </g>
      </g>
    </svg>
  );
}

const ACCENTO_CLASSI = {
  verde: "border-kireo-green-light/40 text-kireo-green-light",
  arancio: "border-kireo-orange/40 text-kireo-orange",
} as const;

// Badge-cornice usato sia per la riga di differenziazione (arancio, cappello
// ai quadranti) sia per il sigillo di gratuità (verde, chiusura): stesso
// componente, solo colore d'accento e contenuto diversi.
const BADGE_CLASSI = {
  verde: "border-[#2FA57Bb3] bg-[#2FA57B0d] shadow-[0_0_30px_-10px_#2FA57B]",
  arancio: "border-[#EF9F27b3] bg-[#EF9F270d] shadow-[0_0_30px_-10px_#EF9F27]",
} as const;

function BadgeCornice({
  colore,
  children,
}: {
  colore: keyof typeof BADGE_CLASSI;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-center px-4">
      <div
        className={`flex max-w-full items-center justify-center gap-3 rounded-2xl border px-6 py-4 sm:gap-4 sm:px-9 sm:py-5 ${BADGE_CLASSI[colore]}`}
      >
        <IconaOBussola className="h-8 w-8 flex-none sm:h-10 sm:w-10" />
        <p className="py-0.5 text-left font-heading text-base font-bold leading-[1.35] text-kireo-light sm:text-xl">
          {children}
        </p>
      </div>
    </div>
  );
}

const OFFERTA = [
  {
    icona: IconaBussola,
    titolo: "Percorso di orientamento",
    testo: "Test attitudinali e tappe guidate per scoprire la tua direzione",
    accento: "verde",
  },
  {
    icona: IconaCheck,
    titolo: "Ore PCTO mentre ti orienti",
    testo: "Le attività valgono come PCTO, con giustificativi automatici per la tua scuola",
    accento: "arancio",
  },
  {
    icona: IconaMappa,
    titolo: "Approfondimenti su 18 aree",
    testo: "Guide, assistente digitale e strumenti per esplorare ogni mondo professionale",
    accento: "verde",
  },
  {
    icona: IconaCalendario,
    titolo: "Webinar ed eventi",
    testo: "Incontri dal vivo ogni mese con chi i mestieri li fa davvero",
    accento: "verde",
  },
  {
    icona: IconaScudo,
    titolo: "La scelta resta tua",
    testo: "Ti aiutiamo a trovare la tua direzione, con onestà su tempi e difficoltà",
    accento: "verde",
  },
  {
    icona: IconaTraguardo,
    titolo: "Consigli su misura",
    testo: "Alla fine del percorso, indicazioni personalizzate su studio o lavoro, costruite sul tuo profilo attitudinale",
    accento: "verde",
  },
] satisfies { icona: typeof IconaBussola; titolo: string; testo: string; accento: keyof typeof ACCENTO_CLASSI }[];

const FAQ_HOME = [
  {
    domanda: "Quanto costa KIREO?",
    risposta:
      "Niente, per studenti e scuole superiori. Sempre. KIREO si sostiene con i servizi premium offerti alle istituzioni formative, mai con i dati o i soldi degli studenti.",
  },
  {
    domanda: "Le attività valgono davvero come PCTO?",
    risposta:
      "Sì: con la convenzione attiva tra KIREO e la scuola, le ore di orientamento svolte sulla piattaforma sono certificate con giustificativi automatici per la segreteria.",
  },
  {
    domanda: "Serve che la mia scuola sia convenzionata?",
    risposta:
      "Per il percorso PCTO sì. Ma puoi iniziare subito il tuo orientamento: test, guide e webinar sono aperti a tutti gli studenti registrati.",
  },
  {
    domanda: "Chi mi aiuta se ho domande su un'area?",
    risposta:
      "L'assistente digitale KIREO: conosce ogni area di orientamento e risponde alle tue curiosità, gratis, quando vuoi.",
  },
];

// Trust strip disattivata in produzione finché non ci sono partner reali
// (vedi CLAUDE.md, sezione "Regole di business"): quando verrà riattivata,
// PARTNER_PLACEHOLDER va sostituito con i soli partner reali (nome + logo,
// mai categorie generiche, mai istituzioni formative clienti presentate
// come co-costruttori). Struttura tenuta pronta, non cancellata.
const MOSTRA_TRUST_STRIP = false;
const PARTNER_PLACEHOLDER = ["Scuole superiori", "Università", "ITS Academy", "Accademie", "Centri di formazione"];

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
      "Un assistente digitale sempre disponibile per le tue domande",
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
        <div className="mt-12">
          <BadgeCornice colore="arancio">
            Nessun percorso è uguale a un altro: il tuo si costruisce su chi sei.
          </BadgeCornice>
        </div>
      </section>

      {/* Offerta KIREO */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
            {OFFERTA.map((voce) => (
              <div
                key={voce.titolo}
                className="flex min-w-0 flex-col items-start gap-3 rounded-2xl border border-white/5 bg-kireo-card p-4 sm:flex-row sm:gap-4 sm:p-5"
              >
                <span
                  className={`flex h-11 w-11 flex-none items-center justify-center rounded-full border ${ACCENTO_CLASSI[voce.accento]}`}
                >
                  <voce.icona className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="py-0.5 font-heading text-sm font-semibold leading-[1.25] text-kireo-light sm:text-base">
                    {voce.titolo}
                  </h3>
                  <p className="mt-1 text-xs text-kireo-muted sm:text-sm">{voce.testo}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <BadgeCornice colore="verde">
              Tutto questo è 100% gratuito per studenti e scuole. <span className="text-kireo-orange">Sempre.</span>
            </BadgeCornice>
          </div>
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

      {/* FAQ */}
      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <SectionHeading eyebrow="Domande frequenti" title="Le domande che ci fanno più spesso" align="center" />
          <div className="mt-10">
            <FaqAccordion items={FAQ_HOME} />
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
            La direzione giusta non si indovina. Si scopre.
          </p>
          <div className="mt-8">
            <ButtonLink href="/registrazione" variant="outline" className="border-kireo-light/60">
              Inizia il tuo orientamento
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Trust strip: disattivata finché non ci sono partner reali da mostrare (nome + logo). Non cancellata: la struttura serve per quando ci saranno. */}
      {MOSTRA_TRUST_STRIP && (
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="text-center font-sans text-sm font-semibold uppercase tracking-wide text-kireo-muted">
              Costruito con il mondo della scuola
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {PARTNER_PLACEHOLDER.map((nome) => (
                <span key={nome} className="font-heading text-lg font-semibold leading-[1.25] text-kireo-muted/70">
                  {nome}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
