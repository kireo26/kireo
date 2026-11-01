import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";
import { TESTI_USCITA_COMUNICAZIONI as T } from "@/lib/app/comunicazioniKireo";

// La pagina del link «Disiscriviti dalle comunicazioni facoltative» in fondo
// alle email a uno studente (01/11, 20261126100000). Il codice dice per chi:
// la sessione non c'entra, e chi non è collegato non deve fare l'accesso.
// ⚠️ Aprirla NON ritira il consenso: lo fa il bottone. I filtri antispam aprono
// da soli i link delle email.
export const metadata: Metadata = {
  title: "Disiscrizione — KIREO",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UscitaComunicazioni({
  params,
  searchParams,
}: {
  params: Promise<{ codice: string }>;
  searchParams: Promise<{ esito?: string }>;
}) {
  const { codice } = await params;
  const { esito } = await searchParams;

  // undefined = non letto; null = il codice non corrisponde a un account.
  let stato: { consenso: boolean | null } | null | undefined = null;
  if (esito !== "fatto" && UUID.test(codice)) {
    try {
      // Con la service role: la funzione la esegue solo il server, e dalla
      // richiesta arriva solo il codice, che la funzione ricontrolla.
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase.rpc("consenso_kireo_con_codice_info", { p_codice: codice });
      if (error) throw error;
      const riga = Array.isArray(data) ? data[0] : null;
      stato = riga ? { consenso: (riga.consenso as boolean | null) ?? null } : null;
    } catch (e) {
      console.error("[disiscrizione/consenso]:", descriviErrore(e));
      stato = undefined;
    }
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-20">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">{T.titolo}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-kireo-muted">
        {esito === "fatto" ? (
          <p className="text-kireo-light">{T.fatto}</p>
        ) : esito === "errore" || stato === undefined ? (
          <p className="text-red-300">{T.errore}</p>
        ) : stato === null ? (
          <p>{T.sconosciuto}</p>
        ) : stato.consenso === false ? (
          <p className="text-kireo-light">{T.giaNo}</p>
        ) : (
          <>
            <p>{T.domanda}</p>
            <form method="post" action={`/api/consenso/uscita/${encodeURIComponent(codice)}`}>
              <button
                type="submit"
                className="rounded-full bg-kireo-green px-6 py-3 font-semibold text-kireo-light hover:bg-kireo-green-light"
              >
                {T.bottone}
              </button>
            </form>
          </>
        )}
        <p>{T.newsletter}</p>
      </div>
    </section>
  );
}
