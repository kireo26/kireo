import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import SectionHeading from "@/components/SectionHeading";
import GuidaAreaForm from "@/components/GuidaAreaForm";
import ArticoloCard from "@/components/news/ArticoloCard";
import CardEvento from "@/components/app/CardEvento";
import CardEnte from "@/components/app/CardEnte";
import SeguiButton from "@/components/app/SeguiButton";
import CtaAssistenteDigitale from "@/components/app/CtaAssistenteDigitale";
import TracciaVisita from "@/components/app/TracciaVisita";
import FeedPost from "@/components/app/FeedPost";
import { AREE, getAreaBySlug } from "@/data/aree";
import { getArticoliPerArea } from "@/lib/news";
import { getEventiPerArea, getAreeDegliEventi, getIscrizioniStudente, eventoNonFinito } from "@/lib/app/eventi";
import { cercaEnti } from "@/lib/app/esplora";
import { createClient } from "@/lib/supabase/server";
import { getPostDellArea, TESTI_SEZIONE_POST_AREA } from "@/lib/app/postArea";
import { registrazioneRivedibile, RIVEDIBILI_AREA_MASSIMO, TESTI_RIVEDI, testoNessunEventoInProgramma } from "@/lib/eventi/registrazione";
import { leggiPostSalvati } from "@/lib/app/bacheca";

export function generateStaticParams() {
  return AREE.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) return {};
  return {
    title: `${area.nome} — Aree di orientamento — KIREO`,
    description: area.descrizioneBreve,
  };
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) notFound();

  const articoli = getArticoliPerArea(area.slug, 3);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tuttiEventi = await getEventiPerArea(supabase, area.slug);
  const eventiFuturi = tuttiEventi.filter((e) => eventoNonFinito(e));
  // Le dirette già trasmesse (31/10): SOLO quelle che si possono davvero
  // riaprire — un webinar finito la cui registrazione la sonda ha visto
  // partire. Un evento passato senza registrazione resta nella pagina del suo
  // ente come storia, e qui non c'è.
  const rivedibili = tuttiEventi
    .filter((e) => registrazioneRivedibile(e))
    .sort((a, b) => b.data_inizio.localeCompare(a.data_inizio))
    .slice(0, RIVEDIBILI_AREA_MASSIMO);
  const areeEventi = await getAreeDegliEventi(
    supabase,
    [...eventiFuturi, ...rivedibili].map((e) => e.id),
  );
  const iscrizioni = user ? new Set(await getIscrizioniStudente(supabase, user.id)) : new Set<string>();

  const enti = await cercaEnti(supabase, { areaSlug: area.slug });
  const { data: seguitiRighe } = user ? await supabase.from("seguiti").select("istituzione_id").eq("student_id", user.id) : { data: [] };
  const seguiti = new Set((seguitiRighe ?? []).map((s) => s.istituzione_id));

  const postArea = await getPostDellArea(supabase, area.slug);
  // «Salva» solo per chi ha fatto l'accesso; senza, il bottone non c'è (null).
  const salvati = user && postArea.stato === "post" ? await leggiPostSalvati(supabase, postArea.post.map((p) => p.id)) : null;
  const salvatoDi = (id: string) => (salvati === null ? null : salvati.has(id));

  return (
    <>
      <TracciaVisita areaSlug={area.slug} />

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 sm:pt-28">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-base font-bold text-kireo-orange">
          {area.icona}
        </span>
        <p className="mb-4 mt-6 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
          Area di orientamento
        </p>
        <h1 className="py-1 font-heading text-4xl font-bold leading-[1.25] text-kireo-light sm:text-5xl">
          {area.nome}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-kireo-muted">{area.descrizioneEstesa}</p>
      </section>

      <section className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeading eyebrow="Le possibilità" title="Che strade puoi prendere" />
          <ul className="mt-10 space-y-4">
            {area.direzioni.map((d) => (
              <li
                key={d}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-kireo-card p-5 text-sm text-kireo-light/90"
              >
                <span className="mt-0.5 text-kireo-orange">✓</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SectionHeading eyebrow="Contenuti" title="Articoli di quest'area" />
        {articoli.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
            I primi articoli di quest&apos;area arrivano presto.
          </p>
        ) : (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {articoli.map((articolo) => (
                <ArticoloCard key={articolo.slug} articolo={articolo} />
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link href={`/news?area=${area.slug}`} className="text-sm font-medium text-kireo-orange underline underline-offset-2">
                Vedi tutti gli articoli di quest&apos;area
              </Link>
            </div>
          </>
        )}
      </section>

      <section id="guida" className="mx-auto max-w-2xl px-6 py-20">
        <div className="text-center">
          <h2 className="py-1 font-heading text-2xl font-bold leading-[1.25] text-kireo-light sm:text-3xl">
            Scarica la guida di orientamento
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-kireo-muted">
            Una guida gratuita su {area.nome.toLowerCase()}: percorsi, competenze richieste e
            domande utili per capire se fa per te.
          </p>
        </div>
        <div className="mt-10">
          <GuidaAreaForm areaNome={area.nome} areaSlug={area.slug} />
        </div>
      </section>

      <section id="eventi" className="border-t border-white/5 bg-kireo-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeading eyebrow="Partecipa" title="Eventi e webinar" />
          {eventiFuturi.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
              {testoNessunEventoInProgramma(rivedibili.length > 0)}
            </p>
          ) : (
            <ul className="mt-8 space-y-4">
              {eventiFuturi.map((evento) => (
                <CardEvento
                  key={evento.id}
                  evento={evento}
                  areeSlugs={areeEventi[evento.id] ?? [area.slug]}
                  userId={user?.id ?? null}
                  iscritto={iscrizioni.has(evento.id)}
                />
              ))}
            </ul>
          )}
          {rivedibili.length > 0 && (
            <div id="rivedibili" className="mt-12">
              <SectionHeading eyebrow={TESTI_RIVEDI.sezioneEyebrow} title={TESTI_RIVEDI.sezioneTitolo} />
              <ul className="mt-8 space-y-4">
                {rivedibili.map((evento) => (
                  <CardEvento
                    key={evento.id}
                    evento={evento}
                    areeSlugs={areeEventi[evento.id] ?? [area.slug]}
                    userId={user?.id ?? null}
                    iscritto={iscrizioni.has(evento.id)}
                    mostraOre={false}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {enti.length > 0 && (
        <section id="enti" className="border-t border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <SectionHeading eyebrow="Chi forma in quest'area" title="Enti di quest'area" />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {enti.map((ente) => (
                <li key={ente.id}>
                  <CardEnte ente={ente} azioneExtra={<SeguiButton istituzioneId={ente.id} userId={user?.id ?? null} seguitoIniziale={seguiti.has(ente.id)} />} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* I POST DEGLI ENTI (Mario, 31/10): dopo «Enti di quest'area», perché la
          pagina è di KIREO e gli enti ci stanno dentro, non sopra. Solo i più
          recenti (POST_AREA_MASSIMO), e solo di enti per cui l'area è
          approvata ADESSO: un'area revocata toglie il post da qui, non dalla
          bacheca dell'ente. Senza post la sezione non c'è; una lettura fallita
          lo dice. */}
      {(postArea.stato === "non_letto" || postArea.post.length > 0) && (
        <section id="post-enti" className="border-t border-white/5 bg-kireo-card/40">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <SectionHeading eyebrow={TESTI_SEZIONE_POST_AREA.eyebrow} title={TESTI_SEZIONE_POST_AREA.titolo} />
            {postArea.stato === "non_letto" ? (
              <p className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center text-amber-200">
                {TESTI_SEZIONE_POST_AREA.nonLetti}
              </p>
            ) : (
              <ul className="mt-8 space-y-4">
                {postArea.post.map((p) => (
                  <FeedPost key={p.id} post={p} salvato={salvatoDi(p.id)} />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section id="assistente-digitale" className="mx-auto max-w-2xl px-6 py-16">
        <CtaAssistenteDigitale areaSlug={area.slug} areaNome={area.nome} />
      </section>

      <section className="bg-kireo-green">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
            Pronto a scoprire la tua direzione?
          </h2>
          <div className="mt-8">
            <ButtonLink href="/registrazione" variant="outline" className="border-kireo-light/60">
              Inizia il tuo percorso di orientamento
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
