import type { Metadata } from "next";
import Link from "next/link";

// Pagina di gestione della disiscrizione dalle comunicazioni FACOLTATIVE
// (promemoria, progressione, nudge, newsletter). È la destinazione del link
// di unsubscribe presente nel footer di tutti i template email
// (lib/email/templates.ts).
//
// Stato onesto per costruzione: oggi KIREO invia SOLO email di servizio
// (richieste dall'utente o conseguenti a una sua azione — conferma richiesta
// di contatto, follow-up guida, conferma registrazione, reset password) e
// comunicazioni B2B. Le comunicazioni facoltative agli studenti — con il
// relativo consenso e il motore di mailing — sono un cantiere a parte, non
// ancora attivo: finché non lo sono, non c'è alcuna preferenza da revocare
// in autonomia. La pagina lo dice apertamente e indirizza a un canale reale
// (la pagina Contatti) per qualunque richiesta immediata, invece di simulare
// una disiscrizione che oggi non avrebbe nulla su cui agire.
//
// noindex: pagina di utilità raggiunta solo dal link nelle email, non
// pensata per la ricerca (stesso trattamento delle landing del funnel).
export const metadata: Metadata = {
  title: "Disiscrizione — KIREO",
  description: "Gestisci le comunicazioni facoltative che ricevi da KIREO.",
  robots: { index: false, follow: false },
};

export default function Disiscrizione() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
        Comunicazioni
      </p>
      <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light">
        Disiscrizione dalle comunicazioni facoltative
      </h1>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-kireo-muted">
        <div>
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
            Due tipi di email
          </h2>
          <p className="mt-3">
            KIREO distingue due categorie di email. Le <strong className="text-kireo-light">email di servizio</strong>{" "}
            sono quelle che hai richiesto tu o che seguono direttamente a una tua azione: la conferma di una richiesta di
            contatto, il link a una guida che hai scaricato, la conferma della registrazione o il reimposta password. Non
            puoi disiscriverti da queste, perché servono a completare qualcosa che hai avviato.
          </p>
          <p className="mt-3">
            Le <strong className="text-kireo-light">comunicazioni facoltative</strong> — promemoria, aggiornamenti sul tuo
            percorso, suggerimenti, newsletter — sono un&apos;altra cosa: le ricevi solo se hai dato il consenso, e da
            queste puoi sempre disiscriverti.
          </p>
        </div>

        <div>
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
            La situazione oggi
          </h2>
          <p className="mt-3">
            Al momento KIREO invia soltanto email di servizio: le comunicazioni facoltative agli studenti non sono ancora
            attive. Non c&apos;è quindi alcuna preferenza da revocare in autonomia in questo momento. Quando le
            comunicazioni facoltative saranno disponibili, potrai gestirle e disattivarle da questa pagina e dalla tua
            area personale.
          </p>
        </div>

        <div>
          <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
            Hai bisogno subito?
          </h2>
          <p className="mt-3">
            Se vuoi comunque segnalarci qualcosa sulle email che ricevi, scrivici dalla{" "}
            <Link href="/contatti" className="text-kireo-orange underline underline-offset-2">
              pagina Contatti
            </Link>
            : ce ne occupiamo noi. Per capire come trattiamo i tuoi dati, consulta l&apos;{" "}
            <Link href="/privacy" className="text-kireo-orange underline underline-offset-2">
              informativa sulla privacy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
