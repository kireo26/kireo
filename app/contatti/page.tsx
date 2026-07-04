import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Contatti — KIREO",
  description: "Scrivici per informazioni su KIREO: studenti, istituzioni, docenti e media.",
};

const TARGET = [
  {
    titolo: "Studenti",
    testo:
      "Hai domande sul tuo profilo o su come trovare il percorso giusto per te? Scrivici, ti rispondiamo il prima possibile.",
  },
  {
    titolo: "Istituzioni formative",
    testo:
      "Vuoi presentare la tua offerta formativa su KIREO o richiedere informazioni sui piani Standard e Premium? Contattaci.",
  },
  {
    titolo: "Docenti",
    testo:
      "Sei interessato ai webinar, alle risorse scaricabili o alla newsletter per docenti? Fatti sentire.",
  },
  {
    titolo: "Media e partner",
    testo:
      "Per richieste stampa, collaborazioni o partnership con KIREO, scrivici indicando il motivo del contatto.",
  },
];

export default function Contatti() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Contatti
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            Parliamone
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            Che tu sia uno studente, un&apos;istituzione, un docente o un partner, siamo qui per
            ascoltarti.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title="Come possiamo aiutarti" />
            <div className="mt-8 space-y-6">
              {TARGET.map((t) => (
                <div key={t.titolo}>
                  <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
                    {t.titolo}
                  </h3>
                  <p className="mt-1 text-sm text-kireo-muted">{t.testo}</p>
                </div>
              ))}
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </>
  );
}
