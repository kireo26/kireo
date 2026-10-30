import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app/studentContext";
import { leggiGuideScaricate, TESTI_GUIDE_SCARICATE as TS } from "@/lib/app/guideScaricate";
import { leggiPostSalvatiMiei, TESTI_POST_SALVATI as TP } from "@/lib/app/postSalvati";
import { HREF_LE_MIE_COSE, TESTI_LE_MIE_COSE as TLC } from "@/lib/app/leMieCose";
import { TESTI_CONTENUTI, immagineDelPost, CLASSE_IMMAGINE_POST } from "@/lib/post/contenuti";
import { LinkEsterno } from "@/components/app/FeedPost";
import TogliPostSalvato from "@/components/app/TogliPostSalvato";

export const metadata = { title: "Le mie cose — KIREO" };

// LE MIE COSE (Mario, 30/10): le guide degli enti scaricate e i post salvati,
// usciti da /app/guide. Il perché del nome e del posto nel menù sta in
// `lib/app/leMieCose.ts`.
export default async function LeMieCose({ searchParams }: { searchParams: Promise<{ allegato?: string }> }) {
  const { allegato } = await searchParams;
  // L'esito di uno scaricamento non riuscito dall'archivio (la route torna qui con ?allegato=).
  const avvisoAllegato =
    allegato === "non_disponibile" ? TESTI_CONTENUTI.allegatoNonDisponibile : allegato === "errore" ? TESTI_CONTENUTI.allegatoErrore : null;
  await getAppContext();
  const supabase = await createClient();
  const [scaricate, salvati] = await Promise.all([leggiGuideScaricate(supabase), leggiPostSalvatiMiei(supabase)]);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">{TLC.etichetta}</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{TLC.titolo}</h1>
        <p className="mt-2 max-w-2xl text-kireo-muted">{TLC.intestazione}</p>
      </div>

      {/* Le guide degli enti (Mario, 29/10): il gesto dello studente verso un
          ente, che resta anche quando l'ente sostituisce o cancella la guida.
          Mai un link a un file che non c'è più. */}
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
              return (
                <li key={p.salvataggioId} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-xs text-kireo-muted">{TP.riga(p)}</p>
                    <TogliPostSalvato salvataggioId={p.salvataggioId} />
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{p.corpo}</p>
                  {TP.stato(p) && <p className="mt-2 text-xs text-kireo-muted">{TP.stato(p)}</p>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {immagine && <img src={immagine} alt="" className={CLASSE_IMMAGINE_POST} />}
                  <LinkEsterno url={p.linkEsterno} />
                  {p.tipo === "file" && p.stato === "visibile" && p.postId && p.allegatoNome && (
                    <form method="post" action={`/api/scarica-allegato/${p.postId}`} className="mt-3 flex flex-wrap items-center gap-3">
                      <input type="hidden" name="ritorno" value={HREF_LE_MIE_COSE} />
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
