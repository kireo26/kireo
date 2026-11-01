import Link from "next/link";
import type { GruppoFlusso } from "@/lib/admin/flusso";
import { GIORNI_FINESTRA_ADMIN } from "@/lib/admin/menu";
import { formattaDataOra } from "@/lib/formato";

// I gruppi del flusso (lib/admin/flusso.ts), una copia sola per «Notifiche» e
// per la pagina di un ente. Un gruppo non letto lo dice, e non è un gruppo vuoto.
export default function GruppiFlusso({ gruppi }: { gruppi: GruppoFlusso[] }) {
  return (
    <>
      {gruppi.map((g) => (
        <section key={g.chiave} id={`flusso-${g.chiave}`}>
          <h3 className="font-heading text-base font-semibold text-kireo-light">
            {g.titolo}{" "}
            <span className="text-sm font-normal text-kireo-muted">· {g.totale === null ? "non letto" : g.totale}</span>
          </h3>
          {g.totale === null ? (
            <p className="mt-2 text-sm text-amber-200">Non siamo riusciti a leggerlo: ricarica la pagina.</p>
          ) : g.righe.length === 0 ? (
            <p className="mt-2 text-sm text-kireo-muted">Niente negli ultimi {GIORNI_FINESTRA_ADMIN} giorni.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {g.righe.map((r) => (
                <li key={r.id} className="text-sm text-kireo-light/90">
                  {r.testo}
                  {r.date.map((d) => (
                    <span key={d.etichetta} className="text-xs text-kireo-muted">
                      {" "}· {d.etichetta} {formattaDataOra(d.quando, "long")}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
          <Link href={g.href} className="mt-2 inline-block text-xs text-kireo-orange underline underline-offset-2">
            Vai all&apos;elenco intero →
          </Link>
        </section>
      ))}
    </>
  );
}
