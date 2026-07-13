import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/Button";
import Card from "@/components/Card";
import SectionHeading from "@/components/SectionHeading";
import RichiestaAccessoEnteForm from "@/components/RichiestaAccessoEnteForm";

export const metadata: Metadata = {
  title: "Per le istituzioni formative — KIREO",
  description:
    "Università, ITS Academy, accademie ed enti di formazione: incontra su KIREO studenti già orientati verso di te.",
};

const BENEFICI = [
  {
    title: "Studenti con una direzione",
    description:
      "Chi ti trova su KIREO ha completato un percorso di orientamento: conosce le proprie attitudini e cerca un percorso coerente. Non curiosi, ma persone motivate.",
  },
  {
    title: "Coerenza attitudinale",
    description:
      "La tua offerta formativa viene mostrata agli studenti il cui profilo attitudinale è coerente con essa. Meno dispersione, più qualità dei contatti.",
  },
  {
    title: "Profilo verificato",
    description:
      "La tua istituzione appare con un profilo completo: eventi, guida scaricabile, sito ufficiale. Verificato da KIREO, aggiornabile in autonomia.",
  },
  {
    title: "Statistiche di interesse",
    description:
      "Scopri quanti studenti hai raggiunto, quanti hanno scaricato la tua guida o si sono iscritti alla newsletter — solo dati aggregati e anonimi, mai un elenco di studenti (in base al piano attivo).",
  },
];

// Nomi dei piani allineati all'enum piani.nome (free/plus/premium) invece
// dei precedenti Base/Standard/Premium — stessi prezzi già comunicati.
const PIANI = [
  { nome: "Free", prezzo: "Gratis", evidenziato: false },
  { nome: "Plus", prezzo: "€290 / anno", evidenziato: true },
  { nome: "Premium", prezzo: "€590 / anno", evidenziato: false },
];

const FEATURE_ROWS: { feature: string; base: string; standard: string; premium: string }[] = [
  { feature: "Profilo istituzione verificato", base: "✓", standard: "✓", premium: "✓" },
  { feature: "Eventi/webinar proposti all'anno", base: "3", standard: "5", premium: "15" },
  { feature: "Newsletter agli iscritti all'anno", base: "—", standard: "2", premium: "5" },
  { feature: "CTA verso il sito esterno all'anno", base: "—", standard: "1", premium: "5" },
  { feature: "Comunicazioni mirate KIREO all'anno", base: "—", standard: "—", premium: "5" },
  { feature: "Statistiche aggregate", base: "✓", standard: "✓", premium: "✓" },
];

const TIPOLOGIE = [
  "Università statali e telematiche riconosciute dal MIM",
  "ITS Academy",
  "Accademie di belle arti, musica e spettacolo",
  "Scuole di formazione professionale",
  "Enti di formazione accreditati",
  "Academy aziendali e alta formazione",
];

function CellValue({ value }: { value: string }) {
  if (value === "✓") {
    return (
      <span className="text-kireo-orange" aria-label="Incluso">
        ✓
      </span>
    );
  }
  if (value === "—") {
    return (
      <span className="text-kireo-muted" aria-label="Non incluso">
        —
      </span>
    );
  }
  return <span className="text-kireo-light/90">{value}</span>;
}

export default function IstituzioniPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Per le istituzioni formative
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            Incontra studenti già orientati.
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            Università, ITS Academy, accademie, enti di formazione: su KIREO le opportunità
            formative vengono mostrate agli studenti al termine del loro percorso di orientamento,
            in base alle attitudini emerse. Contatti qualificati, non traffico generico.
          </p>
          <div className="mt-8">
            <ButtonLink href="#richiedi-accesso" variant="primary">
              Registra la tua istituzione
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading eyebrow="Perché KIREO" title="La differenza è chi arriva da te." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICI.map((b) => (
            <Card key={b.title} title={b.title} description={b.description} />
          ))}
        </div>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading
            eyebrow="Piani e prezzi"
            title="Entra gratis. Cresci quando vuoi."
            description="Il piano Free è gratuito per sempre. I piani a pagamento aggiungono visibilità e strumenti, mai accesso privilegiato agli studenti: la coerenza attitudinale non si compra."
            align="center"
          />

          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="rounded-tl-2xl bg-kireo-card p-4 font-sans font-medium text-kireo-muted">
                    Funzionalità
                  </th>
                  {PIANI.map((p, idx) => (
                    <th
                      key={p.nome}
                      className={`p-4 text-center font-heading text-base font-semibold leading-[1.25] ${
                        idx === PIANI.length - 1 ? "rounded-tr-2xl" : ""
                      } ${p.evidenziato ? "bg-kireo-green text-kireo-light" : "bg-kireo-card text-kireo-light"}`}
                    >
                      {p.nome}
                      <div className="mt-1 font-sans text-xs font-normal opacity-80">{p.prezzo}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row, i) => {
                  const isLast = i === FEATURE_ROWS.length - 1;
                  return (
                    <tr key={row.feature} className={i % 2 === 0 ? "bg-kireo-dark" : "bg-kireo-dark/60"}>
                      <td className={`p-4 text-kireo-light/90 ${isLast ? "rounded-bl-2xl" : ""}`}>
                        {row.feature}
                      </td>
                      {[row.base, row.standard, row.premium].map((value, idx) => (
                        <td
                          key={idx}
                          className={`p-4 text-center ${isLast && idx === 2 ? "rounded-br-2xl" : ""}`}
                        >
                          <CellValue value={value} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-center text-xs text-kireo-muted">
            I prezzi sono indicativi e potranno essere aggiornati al lancio ufficiale. Le
            istituzioni che aderiscono in fase beta ricevono 12 mesi di piano Plus inclusi.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading title="Chi può aderire" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {TIPOLOGIE.map((t) => (
            <li
              key={t}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-kireo-card p-5 text-kireo-light/90"
            >
              <span className="text-kireo-orange">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section id="richiedi-accesso" className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-2xl px-6 py-20">
          <SectionHeading
            eyebrow="Richiedi l'accesso"
            title="Registra la tua istituzione"
            description="Crei subito un profilo, che resta in attesa di attivazione manuale da parte di KIREO prima di comparire pubblicamente."
            align="center"
          />
          <div className="mt-10">
            <Suspense fallback={null}>
              <RichiestaAccessoEnteForm />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="bg-kireo-green">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
            Un ecosistema che funziona se è onesto.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-kireo-light/90">
            KIREO mostra agli studenti le opportunità coerenti con chi sono — non quelle di chi
            paga di più. È questa la ragione per cui gli studenti si fidano, le scuole aderiscono,
            e i contatti che ricevi valgono.
          </p>
          <div className="mt-8">
            <ButtonLink href="#richiedi-accesso" variant="outline" className="border-kireo-light/60">
              Registra la tua istituzione
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
