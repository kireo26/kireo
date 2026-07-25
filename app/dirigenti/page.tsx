import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";
import Card from "@/components/Card";
import CosaEKireo from "@/components/landing/CosaEKireo";
import VideoPresentazione from "@/components/landing/VideoPresentazione";
import SezioneBrochure from "@/components/landing/SezioneBrochure";
import ProvaSociale from "@/components/landing/ProvaSociale";
import RichiestaContattoForm from "@/components/landing/RichiestaContattoForm";
import { materialeDisponibile } from "@/lib/materiali";

// Landing di presentazione per Dirigenti Scolastici, raggiungibile solo da
// link email (funnel scuole): NON linkata da menu/footer/sitemap, indice e
// follow non consentiti ai motori di ricerca.
export const metadata: Metadata = {
  title: "KIREO per i Dirigenti Scolastici",
  description: "Orientamento e PCTO gratuiti per la tua scuola: come funziona KIREO e cosa prevede la convenzione.",
  robots: { index: false, follow: false },
};

// Un solo punto da aggiornare quando il video sarà pronto: l'id del video
// YouTube (es. "dQw4w9WgXcQ"), o null finché non esiste.
const VIDEO_ID: string | null = null;

const RUOLI = ["Dirigente Scolastico", "Vicepreside", "Altro"];

export default function DirigentiPage() {
  const brochureDisponibile = materialeDisponibile("brochure-dirigenti.pdf");

  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Per i Dirigenti Scolastici
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            Un servizio di orientamento e PCTO che la scuola può attivare senza oneri.
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            KIREO offre agli istituti secondari un percorso di orientamento certificato, valido come PCTO, con
            giustificativi automatici e nessun costo per la scuola.
          </p>
          <div className="mt-8">
            <a
              href="#richiedi-informazioni"
              className="inline-flex items-center justify-center rounded-full bg-kireo-green px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
            >
              Richiedi informazioni
            </a>
          </div>
        </div>
      </section>

      <CosaEKireo />

      <VideoPresentazione videoId={VIDEO_ID} titolo="KIREO in due minuti" />

      <SezioneBrochure disponibile={brochureDisponibile} percorsoFile="/materiali/brochure-dirigenti.pdf" />

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeading eyebrow="La convenzione" title="Cosa prevede l'adesione" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <Card
              title="Autonomia negoziale del Dirigente Scolastico"
              description="La firma della convenzione con KIREO rientra nell'autonomia negoziale del Dirigente Scolastico, come servizio gratuito di orientamento e PCTO per gli studenti."
            />
            <Card
              title="Nessun onere per la scuola"
              description="KIREO non richiede alcun costo economico agli istituti secondari, oggi e in futuro: il servizio resta gratuito per studenti e scuole."
            />
            <Card
              title="Durata e recesso"
              description="La convenzione ha una durata di 12 mesi, con recesso libero in qualsiasi momento e senza vincoli per la scuola."
            />
            <Card
              title="Dati degli studenti sempre su KIREO"
              description="I dati degli studenti restano su KIREO e non vengono mai ceduti a terzi: nessuna profilazione condivisa con enti esterni."
            />
          </div>
          <p className="mt-6 text-xs text-kireo-muted">
            I termini definitivi saranno riportati nel testo della convenzione, in corso di validazione legale.
          </p>
        </div>
      </section>

      <ProvaSociale />

      <section id="richiedi-informazioni" className="mx-auto max-w-2xl px-6 py-20">
        <div className="text-center">
          <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
            Richiedi la bozza di convenzione
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-kireo-muted">
            Lasciaci i tuoi dati: ti inviamo la bozza di convenzione e restiamo a disposizione per qualunque domanda.
          </p>
        </div>
        <div className="mt-10">
          <RichiestaContattoForm origine="dirigenti" ruoliOpzioni={RUOLI} etichettaBottone="Richiedi informazioni" />
        </div>
      </section>
    </>
  );
}
