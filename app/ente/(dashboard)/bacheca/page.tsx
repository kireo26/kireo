import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { pianoAPagamento } from "@/lib/ente/pianoSuccessivo";
import CreaPostForm from "@/components/ente/CreaPostForm";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";
import { TESTI_POST, etichettaStatoPost, leggiMotiviPost, prossimoPostDalle, rigaMotivo, testoTettoRaggiunto } from "@/lib/ente/post";

const ETICHETTA_TIPO: Record<string, string> = {
  testo: "Testo",
  immagine: "Immagine",
  link_social: "Link social",
};

export default async function EnteBachecaPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  // I motivi (del rifiuto, di una rimozione) non si leggono dalla tabella:
  // li dà `motivi_post_enti`, solo all'ente del post e all'admin (20261113120000).
  const { data: post, error } = await supabase
    .from("post_enti")
    .select("id, tipo, corpo, stato, created_at, tolto_il")
    .eq("istituzione_id", contesto.istituzioneId)
    .order("created_at", { ascending: false });
  if (error) console.error("[ente] bacheca, post:", descriviErrore(error));
  const motivi = await leggiMotiviPost(
    supabase,
    (post ?? []).filter((p) => p.stato === "tolto" || p.stato === "rifiutato").map((p) => p.id as string),
  );

  const dalle = prossimoPostDalle((post ?? []).map((p) => p.created_at as string), new Date());
  const aPagamento = pianoAPagamento(contesto.pianoNome);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Bacheca</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">I tuoi post</h1>
        <p className="mt-2 text-kireo-muted">{TESTI_POST.intestazione}</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center text-amber-200">
          Non siamo riusciti a leggere i tuoi post: ricarica la pagina.
        </div>
      ) : !post || post.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non hai ancora pubblicato nessun post. Crea il primo qui sotto.
        </div>
      ) : (
        <ul className="space-y-3">
          {post.map((p) => {
            const stato = etichettaStatoPost(p.stato as string);
            const motivo = rigaMotivo(p.stato as string, motivi, p.id as string, (p.tolto_il as string | null) ?? null);
            return (
              <li key={p.id} id={`post-${p.id}`} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stato.classe}`}>
                    {stato.label}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-light/80">
                    {ETICHETTA_TIPO[p.tipo] ?? p.tipo}
                  </span>
                  <span className="text-xs text-kireo-muted">{formattaData(p.created_at, "long")}</span>
                </div>
                <p className="mt-2 text-sm text-kireo-light/90">{p.corpo}</p>
                {motivo && <p className="mt-2 text-xs text-red-300">{motivo}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Nuovo post</h2>
        <p className="mt-1 text-sm text-kireo-muted">{TESTI_POST.tetto}</p>
        <div className="mt-4">
          <CreaPostForm
            istituzioneId={contesto.istituzioneId}
            avvisoTetto={dalle ? testoTettoRaggiunto(dalle) : null}
            pianoAPagamento={aPagamento}
          />
        </div>
      </div>
    </div>
  );
}
