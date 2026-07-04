import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import Card from "@/components/Card";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Per le scuole — KIREO",
  description:
    "Aumenta la visibilità della tua istituzione formativa e raggiungi gli studenti giusti con KIREO.",
};

const BENEFICI = [
  {
    title: "Visibilità presso studenti in target",
    description:
      "Il tuo profilo raggiunge studenti diplomandi realmente interessati al tuo settore formativo.",
  },
  {
    title: "Richieste di contatto qualificate",
    description: "Ricevi richieste da studenti che hanno già valutato la tua offerta formativa.",
  },
  {
    title: "Statistiche e insight",
    description:
      "Con i piani Standard e Premium monitora visualizzazioni, interesse e provenienza delle richieste.",
  },
  {
    title: "Presenza sempre aggiornata",
    description: "Gestisci corsi, contenuti e disponibilità direttamente dal tuo profilo.",
  },
];

const PIANI = [
  {
    nome: "Base",
    prezzo: "Gratuito",
    evidenziato: false,
  },
  {
    nome: "Standard",
    prezzo: "Su richiesta",
    evidenziato: true,
  },
  {
    nome: "Premium",
    prezzo: "Su richiesta",
    evidenziato: false,
  },
];

const FEATURE_ROWS: { feature: string; base: boolean; standard: boolean; premium: boolean }[] = [
  { feature: "Profilo istituzione nel catalogo", base: true, standard: true, premium: true },
  { feature: "Gestione corsi ed elenco offerta formativa", base: true, standard: true, premium: true },
  { feature: "Ricezione richieste di contatto", base: true, standard: true, premium: true },
  { feature: "Posizionamento prioritario nei risultati", base: false, standard: true, premium: true },
  { feature: "Statistiche di visibilità e interesse", base: false, standard: true, premium: true },
  { feature: "Contenuti multimediali avanzati (video, gallery)", base: false, standard: false, premium: true },
  { feature: "Referente dedicato KIREO", base: false, standard: false, premium: true },
];

const TIPOLOGIE = [
  "Università statali e telematiche",
  "ITS Academy",
  "Accademie (moda, arte, musica, cinema)",
  "Corsi professionalizzanti e centri di formazione",
];

export default function PerLeScuole() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Per le istituzioni formative
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            Incontra gli studenti giusti per la tua offerta formativa
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            Entra gratis su KIREO con un profilo base e scegli i piani a pagamento per ottenere
            visibilità avanzata e statistiche dettagliate.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contatti" variant="primary">
              Richiedi informazioni
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading eyebrow="Perché KIREO" title="Quattro motivi per esserci" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICI.map((b) => (
            <Card key={b.title} title={b.title} description={b.description} />
          ))}
        </div>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading eyebrow="Piani" title="Scegli il piano più adatto alla tua istituzione" align="center" />

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
                      {[row.base, row.standard, row.premium].map((incluso, idx) => (
                        <td
                          key={idx}
                          className={`p-4 text-center ${
                            isLast && idx === 2 ? "rounded-br-2xl" : ""
                          }`}
                        >
                          {incluso ? (
                            <span className="text-kireo-orange" aria-label="Incluso">
                              ✓
                            </span>
                          ) : (
                            <span className="text-kireo-muted" aria-label="Non incluso">
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="Chi può iscriversi" title="Tipologie di istituzioni ammesse" />
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
    </>
  );
}
