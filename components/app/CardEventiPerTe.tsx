import Link from "next/link";
import type { Evento } from "@/lib/app/eventi";

export default function CardEventiPerTe({ eventi }: { eventi: Evento[] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-kireo-card p-6">
      <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Prossimi eventi per te</h2>
      {eventi.length === 0 ? (
        <p className="mt-3 text-sm text-kireo-muted">
          Nessun evento in programma per le tue aree, per ora.{" "}
          <Link href="/app/agenda" className="text-kireo-orange underline underline-offset-2">
            Guarda tutta l&apos;Agenda
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {eventi.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-kireo-light">
                  {e.in_evidenza && <span className="mr-1.5 text-kireo-orange">★</span>}
                  {e.titolo}
                </p>
                <p className="text-xs text-kireo-muted">
                  {new Date(e.data_inizio).toLocaleDateString("it-IT", { dateStyle: "long" })}
                </p>
              </div>
              {e.ore_pcto > 0 && (
                <span className="flex-none rounded-full bg-kireo-green/15 px-2.5 py-0.5 text-xs font-semibold text-kireo-green-light">
                  {e.ore_pcto}h PCTO
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/app/agenda" className="mt-4 inline-block text-sm font-medium text-kireo-orange underline underline-offset-2">
        Vai all&apos;Agenda
      </Link>
    </div>
  );
}
