import type { Metadata } from "next";
import RichiestaContattoForm from "@/components/landing/RichiestaContattoForm";
import SectionHeading from "@/components/SectionHeading";

// ⚠️ L'indirizzo pubblico di KIREO, e l'unico che compare sul sito: la copia
// personale di Mario sta solo in `app/api/richiesta-contatto/route.ts`, che
// gira sul server. `npm run test:contatti` lo pretende.
const EMAIL_PUBBLICA = "info@kireo.it";

const RUOLI = ["Studente", "Istituzione formativa", "Docente", "Altro"];

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

            {/* L'indirizzo c'è perché una persona deve poter scrivere anche
                senza passare da un modulo — e perché i testi che si scusano
                («scrivici da Contatti») devono atterrare su qualcosa di vero
                anche il giorno in cui il modulo si rompe. */}
            <p className="mt-8 text-sm text-kireo-muted">
              Preferisci scrivere direttamente?{" "}
              <a
                href={`mailto:${EMAIL_PUBBLICA}`}
                className="text-kireo-orange underline underline-offset-2"
              >
                {EMAIL_PUBBLICA}
              </a>
            </p>
          </div>

          <RichiestaContattoForm
            origine="contatti"
            ruoliOpzioni={RUOLI}
            etichettaBottone="Invia messaggio"
            mostraIstituto={false}
            mostraCodiceMeccanografico={false}
            conferma={{
              titolo: "Messaggio inviato",
              testo:
                "Grazie! Lo leggiamo e ti rispondiamo il prima possibile. Ti abbiamo mandato un'email di conferma: se non la vedi, controlla la posta indesiderata.",
            }}
          />
        </div>
      </section>
    </>
  );
}
