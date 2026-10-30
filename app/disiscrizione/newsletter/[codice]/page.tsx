import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";
import { TESTI_USCITA } from "@/lib/newsletter/uscita";

// La pagina del link «Non voglio più riceverla» in fondo a ogni newsletter
// (30/10). ⚠️ Aprirla NON toglie l'iscrizione: lo fa il bottone. I filtri
// antispam aprono da soli i link delle email, e una pagina che disiscrive al
// caricamento toglierebbe la newsletter a chi non ha premuto niente.
export const metadata: Metadata = {
  title: "Esci dalla newsletter — KIREO",
  robots: { index: false, follow: false },
};

export default async function UscitaNewsletter({
  params,
  searchParams,
}: {
  params: Promise<{ codice: string }>;
  searchParams: Promise<{ esito?: string }>;
}) {
  const { codice } = await params;
  const { esito } = await searchParams;

  let ente: string | null | undefined = null;
  if (esito !== "uscito") {
    try {
      // Con la service role: la funzione la esegue solo il server, e dalla
    // richiesta arriva solo il codice, che la funzione ricontrolla.
    const supabase = createServiceRoleClient();
      const { data, error } = await supabase.rpc("uscita_newsletter_info", { p_codice: codice });
      if (error) throw error;
      ente = (Array.isArray(data) ? data[0]?.ente_nome : null) ?? null;
    } catch (e) {
      console.error("[disiscrizione/newsletter]:", descriviErrore(e));
      ente = undefined;
    }
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-20">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">{TESTI_USCITA.titolo}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-kireo-muted">
        {esito === "uscito" ? (
          <p className="text-kireo-light">{TESTI_USCITA.fatto}</p>
        ) : esito === "errore" || ente === undefined ? (
          <p className="text-red-300">{TESTI_USCITA.errore}</p>
        ) : ente === null ? (
          <p>{TESTI_USCITA.sconosciuto}</p>
        ) : (
          <>
            <p>{TESTI_USCITA.domanda(ente)}</p>
            <form method="post" action={`/api/newsletter/uscita/${encodeURIComponent(codice)}`}>
              <button
                type="submit"
                className="rounded-full bg-kireo-green px-6 py-3 font-semibold text-kireo-light hover:bg-kireo-green-light"
              >
                {TESTI_USCITA.bottone}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
