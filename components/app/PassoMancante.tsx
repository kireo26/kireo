import Link from "next/link";
import type { Cancello } from "@/lib/percorso/cancelli";

// Quello che uno studente legge quando un cancello è chiuso.
//
// NON È UN ERRORE, e il riquadro non deve sembrarlo: è il percorso che dice
// dove si passa. Tono e colori sono quelli della card «Il tuo percorso», non
// quelli di un messaggio rosso — chi arriva qui non ha sbagliato niente, è
// solo arrivato prima.
//
// DICE IL PASSO E LO RENDE CLICCABILE. Senza il link la frase è una porta
// chiusa con scritto sopra il nome della chiave.
export default function PassoMancante({ cancello, titolo }: { cancello: Cancello; titolo: string }) {
  return (
    <div className="rounded-2xl border border-kireo-orange/20 bg-kireo-card p-6 sm:p-8">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{titolo}</h2>
      <p className="mt-2 text-sm text-kireo-light/90">{cancello.passoMancante}</p>
      <Link
        href={cancello.href}
        className="mt-5 inline-flex rounded-full bg-kireo-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-kireo-green-light"
      >
        {cancello.cta}
      </Link>
    </div>
  );
}
