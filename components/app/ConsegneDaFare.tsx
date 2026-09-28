import Link from "next/link";
import { formattaDataOra } from "@/lib/formato";
import type { ConsegnaDaFare } from "@/lib/app/consegneDaFare";

// La porta verso una domanda di fine diretta a cui si può ancora rispondere.
//
// SPARISCE QUANDO NON C'È NIENTE DA FARE, e non lascia un riquadro vuoto: una
// finestra di due giorni è un fatto effimero, e un blocco che dice «nessuna
// domanda in sospeso» occuperebbe tutto l'anno lo spazio di una cosa che
// capita per due giorni.
//
// ⚠️ I testi sono voce: questi li ho scritti io e vanno riletti da Mario.
export default function ConsegneDaFare({ consegne }: { consegne: ConsegnaDaFare[] }) {
  if (consegne.length === 0) return null;

  return (
    <div className="rounded-2xl border border-kireo-orange/40 bg-kireo-card p-6">
      <p className="font-heading text-base font-semibold text-kireo-light">
        {consegne.length === 1 ? "C'è una domanda che ti aspetta" : "Ci sono domande che ti aspettano"}
      </p>
      <ul className="mt-4 space-y-4">
        {consegne.map((c) => (
          <li key={c.eventoId}>
            {/*
              IL PASSIVO NASCONDEVA CHI, e chi ha chiesto è tutto il punto: non
              è un compito che compare nella pagina, è una PERSONA che ha
              chiesto una cosa e aspetta. Quella differenza decide se il
              riquadro somiglia a un dovere o a un invito — e sui compiti a casa
              questi ragazzi hanno già una posizione.
            */}
            <p className="text-sm text-kireo-light">
              Alla fine di <span className="font-semibold">{c.titolo}</span>, chi l&apos;ha fatta ti ha lasciato una
              domanda.
            </p>
            <p className="mt-1 text-xs text-kireo-muted">Puoi rispondere fino al {formattaDataOra(c.scadenza)}.</p>
            <Link
              href={`/app/eventi/${c.eventoId}/live`}
              className="mt-2 inline-block rounded-full bg-kireo-green px-4 py-1.5 text-sm font-semibold text-white hover:bg-kireo-green-light"
            >
              Rispondi
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
