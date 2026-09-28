import Link from "next/link";
import type { Evento } from "@/lib/app/eventi";
import { formattaDataOra } from "@/lib/formato";

export default function StrisciaProssimoEvento({ evento }: { evento: Evento | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-kireo-card px-6 py-4">
      {evento ? (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-kireo-orange">Prossimo evento</p>
            <p className="mt-1 text-sm text-kireo-light">
              {evento.titolo} —{" "}
              {formattaDataOra(evento.data_inizio, "medium")}
            </p>
          </div>
          <Link href="/app/agenda" className="text-sm font-medium text-kireo-orange underline underline-offset-2">
            Vai all&apos;Agenda
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-kireo-muted">Il calendario si sta riempiendo.</p>
          <Link href="/app/agenda" className="text-sm font-medium text-kireo-orange underline underline-offset-2">
            Guarda l&apos;Agenda
          </Link>
        </>
      )}
    </div>
  );
}
