import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { pianoAPagamento } from "@/lib/ente/pianoSuccessivo";
import CreaPostForm from "@/components/ente/CreaPostForm";

const ETICHETTA_STATO: Record<string, { label: string; classe: string }> = {
  in_approvazione: { label: "In approvazione", classe: "bg-kireo-orange/15 text-kireo-orange" },
  approvato: { label: "Approvato", classe: "bg-kireo-green/15 text-kireo-green-light" },
  rifiutato: { label: "Rifiutato", classe: "bg-red-500/15 text-red-300" },
};

const ETICHETTA_TIPO: Record<string, string> = {
  testo: "Testo",
  immagine: "Immagine",
  link_social: "Link social",
};

export default async function EnteBachecaPage() {
  const contesto = await getEnteContext();
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("post_enti")
    .select("id, tipo, corpo, stato, motivo_rifiuto, created_at")
    .eq("istituzione_id", contesto.istituzioneId)
    .order("created_at", { ascending: false });

  const postInRevisione = (post ?? []).filter((p) => p.stato === "in_approvazione").length;

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Bacheca</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">I tuoi post</h1>
        <p className="mt-2 text-kireo-muted">
          Compaiono nel feed degli studenti che ti seguono, dopo la revisione di KIREO.
        </p>
      </div>

      {!post || post.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-6 text-center text-kireo-muted">
          Non hai ancora pubblicato nessun post. Crea il primo qui sotto.
        </div>
      ) : (
        <ul className="space-y-3">
          {post.map((p) => {
            const stato = ETICHETTA_STATO[p.stato] ?? ETICHETTA_STATO.in_approvazione;
            return (
              <li key={p.id} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stato.classe}`}>
                    {stato.label}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kireo-light/80">
                    {ETICHETTA_TIPO[p.tipo] ?? p.tipo}
                  </span>
                  <span className="text-xs text-kireo-muted">{new Date(p.created_at).toLocaleDateString("it-IT", { dateStyle: "long" })}</span>
                </div>
                <p className="mt-2 text-sm text-kireo-light/90">{p.corpo}</p>
                {p.stato === "rifiutato" && p.motivo_rifiuto && (
                  <p className="mt-2 text-xs text-red-300">Motivo del rifiuto: {p.motivo_rifiuto}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Nuovo post</h2>
        <p className="mt-1 text-sm text-kireo-muted">Puoi avere al massimo 3 post in attesa di revisione contemporaneamente.</p>
        <div className="mt-4">
          <CreaPostForm istituzioneId={contesto.istituzioneId} postInRevisione={postInRevisione} pianoAPagamento={pianoAPagamento(contesto.pianoNome)} />
        </div>
      </div>
    </div>
  );
}
