import type { Metadata } from "next";
import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import Card from "@/components/Card";
import CosaEKireo from "@/components/landing/CosaEKireo";
import VideoPresentazione from "@/components/landing/VideoPresentazione";
import SezioneBrochure from "@/components/landing/SezioneBrochure";
import ProvaSociale from "@/components/landing/ProvaSociale";
import RichiestaContattoForm from "@/components/landing/RichiestaContattoForm";
import { materialeDisponibile } from "@/lib/materiali";

// Landing di presentazione per referenti orientamento e docenti,
// raggiungibile solo da link email (funnel scuole): NON linkata da
// menu/footer/sitemap, indice e follow non consentiti ai motori di ricerca.
export const metadata: Metadata = {
  title: "KIREO per le scuole — referenti e docenti",
  description: "Come funziona KIREO per la tua scuola: dashboard referente, verifica studenti, classi, PCTO certificato.",
  robots: { index: false, follow: false },
};

// Un solo punto da aggiornare quando il video sarà pronto: l'id del video
// YouTube (es. "dQw4w9WgXcQ"), o null finché non esiste.
const VIDEO_ID: string | null = null;

const RUOLI = ["Referente orientamento", "Docente", "Vicepreside", "Altro"];

const FOCUS = [
  {
    title: "Dashboard referente",
    description:
      "Tutto in un unico posto: studenti in attesa di verifica, classi, iscrizioni agli eventi, presenze da certificare. Statistiche aggregate sempre aggiornate.",
  },
  {
    title: "Verifica studenti e classi",
    description:
      "Il referente verifica gli studenti che si dichiarano della propria scuola e organizza classi, con permessi delegabili ai tutor per condividere il lavoro.",
  },
  {
    title: "Ore PCTO certificate",
    description:
      "Le attività di orientamento valgono come PCTO: la certificazione delle presenze genera automaticamente i dati per la segreteria, con una catena di responsabilità tracciata.",
  },
  {
    title: "Webinar docenti con attestato",
    description:
      "I docenti della scuola accedono a webinar di formazione continua su AI, valutazione, normativa e burocrazia, con attestato di partecipazione scaricabile.",
  },
];

export default function ScuolePage() {
  const brochureDisponibile = materialeDisponibile("brochure-scuole.pdf");
  const demoDisponibile = false;

  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-2xl">
          <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
            Per le scuole
          </p>
          <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
            Il PCTO che si gestisce da solo. Gratis.
          </h1>
          <p className="mt-6 text-lg text-kireo-muted">
            Una dashboard per il referente, verifica studenti, classi e certificazione delle ore PCTO — mentre i
            docenti si aggiornano con webinar dedicati e attestato di partecipazione.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#richiedi-informazioni"
              className="inline-flex items-center justify-center rounded-full bg-kireo-green px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
            >
              Richiedi informazioni
            </a>
            {demoDisponibile ? (
              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-full border border-kireo-light/30 px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:border-kireo-light/60 hover:bg-white/5"
              >
                Guarda la demo
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/10 px-6 py-3 font-sans text-sm font-semibold text-kireo-muted"
              >
                Demo in arrivo
              </span>
            )}
          </div>
        </div>
      </section>

      <CosaEKireo />

      <VideoPresentazione videoId={VIDEO_ID} titolo="KIREO in due minuti" />

      <SezioneBrochure disponibile={brochureDisponibile} percorsoFile="/materiali/brochure-scuole.pdf" />

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeading eyebrow="Cosa cambia per la scuola" title="Uno strumento pratico, non un altro adempimento" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FOCUS.map((f) => (
              <Card key={f.title} title={f.title} description={f.description} />
            ))}
          </div>
        </div>
      </section>

      <ProvaSociale />

      <section id="richiedi-informazioni" className="mx-auto max-w-2xl px-6 py-20">
        <div className="text-center">
          <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
            Attiva la tua scuola
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-kireo-muted">
            Lasciaci i tuoi dati: ti aiutiamo ad attivare la scuola su KIREO e rispondiamo a ogni domanda su come
            funziona.
          </p>
        </div>
        <div className="mt-10">
          <RichiestaContattoForm origine="scuole" ruoliOpzioni={RUOLI} etichettaBottone="Richiedi informazioni" />
        </div>
      </section>
    </>
  );
}
