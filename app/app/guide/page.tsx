import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { AREE } from "@/data/aree";
import { guideDiArea, statoSblocco, GATE_GUIDE_ATTIVO, guidaPronta, TESTO_SBLOCCO_GUIDE } from "@/lib/guide/config";
import { caricaContestoGuide } from "@/lib/guide/statoStudente";
import { leggiGuideScaricate, TESTI_GUIDE_SCARICATE as TS } from "@/lib/app/guideScaricate";
import { leggiPostSalvatiMiei, TESTI_POST_SALVATI as TP } from "@/lib/app/postSalvati";
import { TESTI_CONTENUTI, immagineDelPost, piattaformaDelLink } from "@/lib/post/contenuti";
import TogliPostSalvato from "@/components/app/TogliPostSalvato";

export const metadata = { title: "Guide di orientamento — KIREO" };

// Indice della sezione Guide: le 18 aree, ognuna con quante guide sono
// disponibili (PDF pronto) e quante sbloccate. Il dettaglio è in
// /app/guide/[areaSlug]. Dal 2026-09-26 il cancello è ACCESO: le tre guide di
// ogni area restano tutte VISIBILI — una guida che non si sa di avere davanti
// non invoglia nessuno — ma solo quelle sbloccate si aprono.
export default async function GuideHome({ searchParams }: { searchParams: Promise<{ allegato?: string }> }) {
  const { allegato } = await searchParams;
  // L'esito di uno scaricamento non riuscito dall'archivio (la route torna qui con ?allegato=).
  const avvisoAllegato =
    allegato === "non_disponibile" ? TESTI_CONTENUTI.allegatoNonDisponibile : allegato === "errore" ? TESTI_CONTENUTI.allegatoErrore : null;
  const contesto = await getAppContext();
  const supabase = await createClient();
  const [ctx, scaricate, salvati] = await Promise.all([
    caricaContestoGuide(supabase, contesto.userId),
    leggiGuideScaricate(supabase),
    leggiPostSalvatiMiei(supabase),
  ]);

  const righe = AREE.map((a) => {
    const guide = guideDiArea(a.slug);
    const s = ctx.segnale(a.slug);
    const disponibili = guide.filter((g) => guidaPronta(a.slug, g.livello)).length;
    const sbloccate = guide.filter((g) => statoSblocco(g.livello, s).sbloccata).length;
    return { slug: a.slug, nome: a.nome, icona: a.icona, disponibili, sbloccate };
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Guide</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Le guide di orientamento</h1>
        {/* Stessa frase della pagina di area, e dallo stesso posto: era la
            SECONDA copia scritta a mano della regola di sblocco, ferma alla
            versione di prima della sequenza come la prima. */}
        <p className="mt-2 max-w-2xl text-kireo-muted">
          Per ogni area, fino a tre guide di profondità crescente: una panoramica, le strade che puoi prendere, e come partire davvero. {TESTO_SBLOCCO_GUIDE}
        </p>
      </div>

      <h2 className="font-heading text-xl font-semibold text-kireo-light">{TS.titoloKireo}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {righe.map((r) => (
          <Link key={r.slug} href={`/app/guide/${r.slug}`} className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-kireo-card p-5 transition hover:border-kireo-green/50">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-sm font-bold text-kireo-orange">{r.icona}</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-semibold text-kireo-light group-hover:text-kireo-orange">{r.nome}</h2>
              <p className="mt-0.5 text-xs text-kireo-muted">
                {r.disponibili > 0 ? `${r.disponibili} di 3 pronte` : "Guide in preparazione"}
                {GATE_GUIDE_ATTIVO ? ` · ${r.sbloccate}/3 sbloccate` : ""}
              </p>
            </div>
            <span className="flex-none text-sm text-kireo-green-light group-hover:underline">Apri →</span>
          </Link>
        ))}
      </div>

      {/* La seconda sezione (Mario, 29/10): il gesto dello studente verso un
          ente, che resta anche quando l'ente sostituisce o cancella la guida.
          Mai un link a un file che non c'è più. Dal 30/10 qui sotto ci sono
          anche i post salvati: un archivio solo dello studente (Mario). */}
      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">{TS.titoloEnti}</h2>
        {scaricate === null ? (
          <p className="text-sm text-kireo-muted">{TS.nonLetto}</p>
        ) : scaricate.length === 0 ? (
          <p className="text-sm text-kireo-muted">{TS.nessuna}</p>
        ) : (
          <ul className="space-y-3">
            {scaricate.map((g) => (
              <li key={g.guidaId} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-base font-semibold text-kireo-light">{g.titolo}</p>
                  <p className="mt-0.5 text-xs text-kireo-muted">{TS.riga(g)}</p>
                  {TS.stato(g) && <p className="mt-2 text-xs text-kireo-muted">{TS.stato(g)}</p>}
                </div>
                {g.pdfUrl && (
                  <a href={g.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex-none text-sm text-kireo-green-light hover:underline">
                    {TS.apri} →
                  </a>
                )}
              </li>
            ))}
          </ul>
                )}
      </section>

      {/* I post salvati (30/10, 20261119110000): la copia del momento del
          salvataggio, con lo stato di oggi. Di un post che non è più nel
          flusso resta il testo, non l'immagine, il link o il file: vedi
          `lib/app/postSalvati.ts`. */}
      <section id="salvati" className="space-y-4">
        <h2 className="font-heading text-xl font-semibold text-kireo-light">{TP.titolo}</h2>
        {avvisoAllegato && (
          <p id="allegato" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            {avvisoAllegato}
          </p>
        )}
        {salvati === null ? (
          <p className="text-sm text-kireo-muted">{TP.nonLetto}</p>
        ) : salvati.length === 0 ? (
          <p className="text-sm text-kireo-muted">{TP.nessuno}</p>
        ) : (
          <ul className="space-y-3">
            {salvati.map((p) => {
              const immagine = immagineDelPost(p.immagineUrl, process.env.NEXT_PUBLIC_SUPABASE_URL);
              const piattaforma = piattaformaDelLink(p.linkUrl);
              return (
                <li key={p.salvataggioId} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-xs text-kireo-muted">{TP.riga(p)}</p>
                    <TogliPostSalvato salvataggioId={p.salvataggioId} />
                  </div>
                  {p.linkTitolo && <p className="mt-2 font-heading text-sm font-semibold text-kireo-light">{p.linkTitolo}</p>}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{p.corpo}</p>
                  {TP.stato(p) && <p className="mt-2 text-xs text-kireo-muted">{TP.stato(p)}</p>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {immagine && <img src={immagine} alt="" className="mt-3 max-h-72 w-full rounded-xl object-cover" />}
                  {p.linkRiga && <p className="mt-2 text-sm text-kireo-light/80">{p.linkRiga}</p>}
                  {p.linkUrl && piattaforma && (
                    <p className="mt-2 text-sm">
                      <a href={p.linkUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-kireo-orange underline underline-offset-2">
                        {TESTI_CONTENUTI.apriSu(piattaforma)}
                      </a>{" "}
                      <span className="text-xs text-kireo-muted">{TESTI_CONTENUTI.fuoriDaKireo}</span>
                    </p>
                  )}
                  {p.tipo === "file" && p.stato === "visibile" && p.postId && p.allegatoNome && (
                    <form method="post" action={`/api/scarica-allegato/${p.postId}`} className="mt-3 flex flex-wrap items-center gap-3">
                      <input type="hidden" name="ritorno" value="/app/guide" />
                      <span className="text-sm text-kireo-light">📄 {p.allegatoNome}</span>
                      <button type="submit" className="text-sm font-medium text-kireo-orange underline underline-offset-2">
                        {TESTI_CONTENUTI.scaricaFile}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
