import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app/studentContext";
import { leggiGuideScaricate, TESTI_GUIDE_SCARICATE as TS } from "@/lib/app/guideScaricate";
import { leggiPostSalvatiMiei, TESTI_POST_SALVATI as TP } from "@/lib/app/postSalvati";
import Link from "next/link";
import {
  TESTI_LE_MIE_COSE as TLC,
  TESTI_LISTA as TL,
  FILTRI_LE_MIE_COSE,
  filtroDaIndirizzo,
  hrefFiltro,
  listaLeMieCose,
} from "@/lib/app/leMieCose";
import { TESTI_CONTENUTI, immagineDelPost, CLASSE_IMMAGINE_POST } from "@/lib/post/contenuti";
import { LinkEsterno } from "@/components/app/FeedPost";
import TogliPostSalvato from "@/components/app/TogliPostSalvato";
import TogliRegistrazioneSalvata from "@/components/app/TogliRegistrazioneSalvata";
import { leggiRegistrazioniSalvate, TESTI_REGISTRAZIONI_SALVATE as TR } from "@/lib/app/registrazioniSalvate";
import { hrefRivedi, TESTI_RIVEDI, urlYoutube } from "@/lib/eventi/registrazione";

export const metadata = { title: "Le mie cose — KIREO" };

// LE MIE COSE (Mario, 30/10): le guide degli enti scaricate e i post salvati,
// usciti da /app/guide. Il perché del nome e del posto nel menù sta in
// `lib/app/leMieCose.ts`.
export default async function LeMieCose({ searchParams }: { searchParams: Promise<{ allegato?: string; tipo?: string }> }) {
  const { allegato, tipo } = await searchParams;
  const filtro = filtroDaIndirizzo(tipo);
  // L'esito di uno scaricamento non riuscito dall'archivio (la route torna qui con ?allegato=).
  const avvisoAllegato =
    allegato === "non_disponibile" ? TESTI_CONTENUTI.allegatoNonDisponibile : allegato === "errore" ? TESTI_CONTENUTI.allegatoErrore : null;
  await getAppContext();
  const supabase = await createClient();
  const [scaricate, salvati, registrazioni] = await Promise.all([
    leggiGuideScaricate(supabase),
    leggiPostSalvatiMiei(supabase),
    leggiRegistrazioniSalvate(supabase),
  ]);
  const lista = listaLeMieCose(scaricate, salvati, registrazioni, filtro);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">{TLC.etichetta}</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">{TLC.titolo}</h1>
        <p className="mt-2 max-w-2xl text-kireo-muted">{TLC.intestazione}</p>
      </div>

      {/* LA LISTA UNICA (Mario, 30/10): guide e post insieme, in ordine di
          gesto, con i filtri nell'indirizzo (?tipo=) così «indietro» ritrova
          il filtro. Perché si legge intera e come si ordina: vedi
          `lib/app/leMieCose.ts`. */}
      <nav aria-label="Filtra" className="flex flex-wrap gap-2">
        {FILTRI_LE_MIE_COSE.map((f) => (
          <Link
            key={f}
            href={hrefFiltro(f)}
            aria-current={f === filtro ? "page" : undefined}
            className={
              f === filtro
                ? "rounded-full bg-kireo-green px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-white/10 px-4 py-1.5 text-sm text-kireo-muted hover:text-kireo-light"
            }
          >
            {TL.filtri[f]}
          </Link>
        ))}
      </nav>

      <section id="salvati" className="space-y-4">
        {avvisoAllegato && (
          <p id="allegato" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            {avvisoAllegato}
          </p>
        )}
        {lista.nonLette.map((s) => (
          <p key={s} className="text-sm text-kireo-muted">{TL.nonLette[s]}</p>
        ))}
        {lista.vuoto && <p className="text-sm text-kireo-muted">{lista.vuoto}</p>}
        {lista.voci.length > 0 && (
          <ul className="space-y-3">
            {lista.voci.map((v) => {
              if (v.tipo === "guida") {
                const g = v.guida;
                return (
                  <li key={`guida-${v.chiave}`} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/5 bg-kireo-card p-5">
                    <div className="min-w-0 flex-1">
                      <Segno testo={TL.segno.guida} />
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
                );
              }
              if (v.tipo === "registrazione") {
                // L'identità è quella copiata al gesto; il bottone lo decide
                // lo stato di adesso (`dove`), e senza bottone una riga dice
                // perché. Rivedere non conta come partecipazione, anche da qui.
                const reg = v.registrazione;
                return (
                  <li key={`registrazione-${v.chiave}`} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Segno testo={TL.segno.registrazione} />
                        <p className="font-heading text-base font-semibold text-kireo-light">{reg.titolo}</p>
                        <p className="mt-0.5 text-xs text-kireo-muted">{TR.riga(reg)}</p>
                      </div>
                      <TogliRegistrazioneSalvata salvataggioId={reg.salvataggioId} />
                    </div>
                    {reg.dove === "kireo" && reg.eventoId && (
                      <div className="mt-3">
                        <Link href={hrefRivedi(reg.eventoId)} className="text-sm font-medium text-kireo-orange underline underline-offset-2">
                          {TESTI_RIVEDI.bottone}
                        </Link>
                        <p className="mt-1 text-xs text-kireo-muted">{TESTI_RIVEDI.nonConta}</p>
                      </div>
                    )}
                    {reg.dove === "youtube" && reg.videoAdesso && (
                      <div className="mt-3">
                        <a href={urlYoutube(reg.videoAdesso)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-kireo-orange underline underline-offset-2">
                          {TESTI_RIVEDI.bottoneYoutube} ↗
                        </a>
                        <p className="mt-1 text-xs text-kireo-muted">{TESTI_CONTENUTI.fuoriDaKireo}</p>
                        <p className="mt-0.5 text-xs text-kireo-muted">{TESTI_RIVEDI.nonConta}</p>
                      </div>
                    )}
                    {reg.perche && <p className="mt-2 text-xs text-kireo-muted">{TR.perche[reg.perche]}</p>}
                  </li>
                );
              }
              const p = v.post;
              const immagine = immagineDelPost(p.immagineUrl, process.env.NEXT_PUBLIC_SUPABASE_URL);
              return (
                <li key={`post-${v.chiave}`} className="rounded-2xl border border-white/5 bg-kireo-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Segno testo={TL.segno.post} />
                      <p className="text-xs text-kireo-muted">{TP.riga(p)}</p>
                    </div>
                    <TogliPostSalvato salvataggioId={p.salvataggioId} />
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{p.corpo}</p>
                  {TP.stato(p) && <p className="mt-2 text-xs text-kireo-muted">{TP.stato(p)}</p>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {immagine && <img src={immagine} alt="" className={CLASSE_IMMAGINE_POST} />}
                  <LinkEsterno url={p.linkEsterno} />
                  {p.tipo === "file" && p.stato === "visibile" && p.postId && p.allegatoNome && (
                    <form method="post" action={`/api/scarica-allegato/${p.postId}`} className="mt-3 flex flex-wrap items-center gap-3">
                      <input type="hidden" name="ritorno" value={hrefFiltro(filtro)} />
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

// Il segno piccolo che dice cos'è una riga: in una lista sola fa il lavoro che
// prima facevano i due titoli di sezione.
function Segno({ testo }: { testo: string }) {
  return (
    <span className="mb-1.5 inline-block rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-kireo-muted">
      {testo}
    </span>
  );
}
