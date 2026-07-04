import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Per i docenti — KIREO",
  description:
    "Formazione continua e gratuita per i docenti su intelligenza artificiale, valutazione, etica e riduzione della burocrazia.",
};

const TEMI_DOCENTI = [
  {
    badge: "AI in classe",
    titolo: "L'AI nella didattica quotidiana",
    testo:
      "Creare esercizi, verifiche e materiali personalizzati con gli strumenti AI. Dalla teoria alla pratica: cosa funziona davvero in aula e cosa no.",
  },
  {
    badge: "Valutazione",
    titolo: "Valutare nell'era dell'AI",
    testo:
      "Se un tema si genera in pochi secondi, la verifica va ripensata: valutare il processo e il pensiero critico, non solo il prodotto. Metodi e strumenti concreti.",
  },
  {
    badge: "Etica & Privacy",
    titolo: "Regole, privacy e uso responsabile",
    testo:
      "Cosa dicono le linee guida MIM e l'AI Act: cosa si può fare, cosa è vietato (come inserire dati degli studenti nei chatbot) e come costruire una policy d'istituto.",
  },
  {
    badge: "Meno burocrazia",
    titolo: "L'AI che ti restituisce tempo",
    testo:
      "Programmazioni, relazioni, comunicazioni, documentazione: come usare l'AI per alleggerire il carico amministrativo e tornare a fare il mestiere che hai scelto.",
  },
];

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 19V5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2Z"
      />
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
    </svg>
  );
}

const RISORSE_DOCENTI = [
  { icon: CalendarIcon, testo: "Webinar mensili gratuiti con attestato di partecipazione" },
  { icon: BookIcon, testo: "Biblioteca di guide e materiali pronti per l'aula, scaricabili" },
  { icon: MailIcon, testo: "Newsletter con le novità su AI e scuola, una volta al mese" },
];

export default function PerIDocenti() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Per i docenti
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            L&apos;aggiornamento che la scuola ti chiede. Gratis.
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            Le linee guida ministeriali chiedono a ogni istituto di formare i docenti
            sull&apos;intelligenza artificiale entro il 2026, e dal 2 agosto 2026 l&apos;AI Act
            europeo rende l&apos;alfabetizzazione AI un obbligo. KIREO ti tiene al passo: webinar
            gratuiti, materiali scaricabili e aggiornamenti continui — con attestato di
            partecipazione.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contatti" variant="primary">
              Iscriviti
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading eyebrow="I temi" title="Quattro filoni, sempre aggiornati" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {TEMI_DOCENTI.map((t) => (
            <div key={t.titolo} className="rounded-2xl border border-white/5 bg-kireo-card p-6">
              <span className="inline-block rounded-full bg-kireo-green/15 px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wide text-kireo-orange">
                {t.badge}
              </span>
              <h2 className="mt-4 py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
                {t.titolo}
              </h2>
              <p className="mt-2 text-sm text-kireo-muted">{t.testo}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-6 sm:grid-cols-3">
            {RISORSE_DOCENTI.map(({ icon: Icon, testo }) => (
              <div key={testo} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-kireo-green/15 text-kireo-orange">
                  <Icon />
                </span>
                <p className="text-sm text-kireo-light/90">{testo}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <ButtonLink href="/contatti" variant="primary">
              Iscriviti
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
