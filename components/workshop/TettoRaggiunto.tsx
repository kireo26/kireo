import Link from "next/link";
import type { AvvisoTetto } from "@/lib/workshop/tetto";

// Quello che vede chi non può cominciare un altro workshop.
//
// Non è una pagina che respinge in silenzio e non è un bottone disabilitato: il
// rifiuto vero lo fa la policy di `workshop_iscrizioni`, questo dice QUALE dei
// due muri è e dove si va. Il testo è un valore (`avvisoTetto`), non tre rami
// qui dentro — così `npm run test:tetto` può provarlo.
export default function TettoRaggiunto({ avviso }: { avviso: AvvisoTetto }) {
  return (
    <div className="rounded-2xl border border-kireo-orange/30 bg-kireo-orange/5 p-6 sm:p-8">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{avviso.titolo}</h2>
      <p className="mt-2 text-sm text-kireo-light/90">{avviso.corpo}</p>
      {avviso.cta && (
        <Link
          href={avviso.cta.href}
          className="mt-5 inline-flex rounded-full bg-kireo-orange px-5 py-2.5 text-sm font-semibold text-kireo-dark hover:bg-kireo-orange/90"
        >
          {avviso.cta.testo} →
        </Link>
      )}
    </div>
  );
}
