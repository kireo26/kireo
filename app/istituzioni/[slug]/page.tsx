import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIstituzionePubblicaBySlug, getGuideEnte, isIscrittoNewsletter, etichettaTipoIstituzione } from "@/lib/app/istituzioni";
import { getEventiIstituzione, getAreeDegliEventi, getIscrizioniStudente } from "@/lib/app/eventi";
import GuidaEnteForm from "@/components/app/GuidaEnteForm";
import IscrivitiNewsletterButton from "@/components/app/IscrivitiNewsletterButton";
import CardEvento from "@/components/app/CardEvento";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const istituzione = await getIstituzionePubblicaBySlug(supabase, slug);
  if (!istituzione) return {};
  return {
    title: `${istituzione.nome} — KIREO`,
    description: istituzione.descrizione ?? `Profilo di ${istituzione.nome} su KIREO.`,
  };
}

export default async function IstituzionePubblicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const istituzione = await getIstituzionePubblicaBySlug(supabase, slug);
  if (!istituzione) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [guide, eventi] = await Promise.all([
    getGuideEnte(supabase, istituzione.id),
    getEventiIstituzione(supabase, istituzione.id),
  ]);

  const areeEventi = await getAreeDegliEventi(
    supabase,
    eventi.map((e) => e.id),
  );

  const iscrizioniEventi = user ? new Set(await getIscrizioniStudente(supabase, user.id)) : new Set<string>();
  const iscrittoNewsletter = user ? await isIscrittoNewsletter(supabase, user.id, istituzione.id) : false;
  const guidaPrincipale = guide[0] ?? null;

  return (
    <>
      <section className="border-b border-white/5">
        {istituzione.immagine_copertina_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={istituzione.immagine_copertina_url} alt="" className="h-56 w-full object-cover sm:h-72" />
        ) : (
          <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-kireo-green/30 to-kireo-orange/20 sm:h-72">
            <span className="font-heading text-5xl font-bold text-kireo-light/40">{istituzione.nome.charAt(0)}</span>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <p className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
          {etichettaTipoIstituzione(istituzione.tipo)}
        </p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          {istituzione.nome}
        </h1>
        {istituzione.descrizione && <p className="mt-4 max-w-2xl text-lg text-kireo-muted">{istituzione.descrizione}</p>}
        {istituzione.sito_ufficiale && (
          <a
            href={istituzione.sito_ufficiale}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-medium text-kireo-orange underline underline-offset-2"
          >
            Sito ufficiale ↗
          </a>
        )}
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="py-0.5 font-heading text-2xl font-bold leading-[1.25] text-kireo-light">Eventi</h2>
          {eventi.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
              Nessun evento in programma al momento.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {eventi.map((evento) => (
                <CardEvento
                  key={evento.id}
                  evento={evento}
                  areeSlugs={areeEventi[evento.id] ?? []}
                  userId={user?.id ?? null}
                  iscritto={iscrizioniEventi.has(evento.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {guidaPrincipale && (
        <section id="guida" className="mx-auto max-w-2xl px-6 py-20">
          <div className="text-center">
            <h2 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">
              Scarica la guida di {istituzione.nome}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-kireo-muted">{guidaPrincipale.titolo}</p>
          </div>
          <div className="mt-10">
            <GuidaEnteForm istituzioneId={istituzione.id} istituzioneNome={istituzione.nome} pdfUrl={guidaPrincipale.pdf_url} />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h2 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">
          Resta aggiornato
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-kireo-muted">
          Iscriviti alla newsletter di {istituzione.nome} per ricevere aggiornamenti su corsi ed eventi.
        </p>
        <div className="mt-6 flex justify-center">
          <IscrivitiNewsletterButton istituzioneId={istituzione.id} userId={user?.id ?? null} iscrittoIniziale={iscrittoNewsletter} />
        </div>
      </section>
    </>
  );
}
