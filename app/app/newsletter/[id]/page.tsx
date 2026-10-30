import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { descriviErrore } from "@/lib/erroreSupabase";
import { formattaData } from "@/lib/formato";

// La newsletter di un ente dentro KIREO (30/10): la notifica arriva a tutti i
// destinatari il giorno scelto, anche a chi per email è rimasto in coda. La
// legge solo chi l'ha ricevuta (`newsletter_per_me`). Il testo dell'ente è
// testo: React lo scrive come tale, e gli a capo restano a capo.
export default async function NewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  await getAppContext();
  const { id } = await params;
  const supabase = await createClient();

  let nl: { oggetto: string; corpo: string; ente_nome: string; ente_slug: string; giorno: string } | null | undefined;
  try {
    const { data, error } = await supabase.rpc("newsletter_per_me", { p_id: id });
    if (error) throw error;
    nl = Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error("[newsletter studente]:", descriviErrore(e));
    nl = undefined;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {nl === undefined ? (
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-kireo-muted">
          Non siamo riusciti a leggere questa newsletter: ricarica la pagina.
        </p>
      ) : nl === null ? (
        <p className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-kireo-muted">
          Questa newsletter non è fra quelle che hai ricevuto.
        </p>
      ) : (
        <article className="rounded-2xl border border-white/5 bg-kireo-card p-6">
          <p className="text-xs text-kireo-muted">
            Newsletter di{" "}
            <Link href={`/istituzioni/${nl.ente_slug}`} className="text-kireo-orange underline underline-offset-2">
              {nl.ente_nome}
            </Link>{" "}
            · {formattaData(nl.giorno, "long")}
          </p>
          <h1 className="mt-2 py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">{nl.oggetto}</h1>
          <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-kireo-light/90">{nl.corpo}</div>
          <p className="mt-6 text-xs text-kireo-muted">
            Non la vuoi più? La togli dal tuo{" "}
            <Link href="/app/profilo" className="text-kireo-orange underline underline-offset-2">
              profilo
            </Link>
            , in Comunicazioni.
          </p>
        </article>
      )}
    </div>
  );
}
