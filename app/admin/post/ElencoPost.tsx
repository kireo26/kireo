import TogliPost from "@/components/admin/TogliPost";
import Ricerca from "@/components/admin/Ricerca";
import Paginazione from "@/components/admin/Paginazione";
import { etichettaStatoPost, leggiMotiviPost, rigaMotivo } from "@/lib/ente/post";
import { immagineDelPost, CLASSE_IMMAGINE_POST } from "@/lib/post/contenuti";
import { intervallo, paginaDa, testoTotale } from "@/lib/admin/pagine";
import { formattaDataOra } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FiltroPost = "tutti" | "pubblicati" | "tolti";

// L'elenco dei post di una scheda: ricerca nel testo e nel nome dell'ente, il
// totale scritto, a pagine. Da qui si toglie un post con il motivo
// (`TogliPost`); la conferma dice quante notifiche sono già partite, e una
// conta fallita arriva come «non contate», non come zero.
export default async function ElencoPost({
  supabase,
  filtro,
  base,
  cerca,
}: {
  supabase: SupabaseClient;
  filtro: FiltroPost;
  base: string;
  cerca: { q?: string; pagina?: string };
}) {
  const q = cerca.q?.trim() || undefined;
  const pagina = paginaDa(cerca.pagina);
  const { da, a } = intervallo(pagina);

  // La ricerca guarda il testo del post e il nome dell'ente.
  let idEnti: string[] = [];
  if (q) {
    const { data: enti } = await supabase.from("istituzioni").select("id").ilike("nome", `%${q}%`).limit(200);
    idEnti = (enti ?? []).map((e) => e.id as string);
  }
  let query = supabase
    .from("post_enti")
    .select("id, tipo, corpo, immagine_url, link_esterno, allegato_nome, stato, visibile, visibile_dal, tolto_il, created_at, istituzioni(nome)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (filtro === "pubblicati") query = query.eq("visibile", true);
  if (filtro === "tolti") query = query.eq("stato", "tolto");
  if (q) {
    const testo = q.replace(/[,()]/g, " ");
    query = idEnti.length > 0 ? query.or(`corpo.ilike.%${testo}%,istituzione_id.in.(${idEnti.join(",")})`) : query.ilike("corpo", `%${testo}%`);
  }
  const { data: postEnti, count, error: errorePostEnti } = await query.range(da, a);
  if (errorePostEnti) console.error("[admin] post degli enti:", descriviErrore(errorePostEnti));

  const idPost = (postEnti ?? []).map((p) => p.id as string);
  const { data: notifichePost, error: erroreNotifichePost } =
    idPost.length > 0
      ? await supabase.from("notifiche_studenti").select("riferimento_id").eq("tipo", "nuovo_post").in("riferimento_id", idPost)
      : { data: [] as { riferimento_id: string }[], error: null };
  if (erroreNotifichePost) console.error("[admin] notifiche dei post:", descriviErrore(erroreNotifichePost));
  const notifichePerPost = new Map<string, number>();
  for (const n of notifichePost ?? []) notifichePerPost.set(n.riferimento_id, (notifichePerPost.get(n.riferimento_id) ?? 0) + 1);
  const motiviPost = await leggiMotiviPost(supabase, (postEnti ?? []).filter((p) => p.stato === "tolto").map((p) => p.id as string));
  const totale = errorePostEnti ? null : (count ?? null);

  return (
    <div className="space-y-4">
      <Ricerca base={base} q={q} segnaposto="Cerca nel testo o per nome dell'ente" />
      {errorePostEnti ? (
        <p className="text-sm text-amber-200">Non siamo riusciti a leggere i post: ricarica la pagina.</p>
      ) : (
        <>
          <p className="text-sm text-kireo-light">{testoTotale(totale, pagina, postEnti?.length ?? 0)}</p>
          {postEnti && postEnti.length > 0 && (
          <ul className="space-y-4">
            {postEnti.map((p) => {
              const organizzatore = Array.isArray(p.istituzioni) ? p.istituzioni[0] : p.istituzioni;
              const stato = etichettaStatoPost(p.stato as string);
              const motivo = rigaMotivo(p.stato as string, motiviPost, p.id as string, (p.tolto_il as string | null) ?? null);
              return (
                <li key={p.id} id={`post-${p.id}`} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <p className="font-heading text-sm font-semibold text-kireo-light">
                    {organizzatore?.nome ?? "—"} ·{" "}
                    <span className="text-xs font-normal uppercase tracking-wide text-kireo-muted">{p.tipo}</span>{" "}
                    <span className={`ml-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stato.classe}`}>{stato.label}</span>
                  </p>
                  <p className="mt-1 text-xs text-kireo-muted">{formattaDataOra(p.created_at, "long")}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-kireo-light/90">{p.corpo}</p>
                  {/* Un'immagine fuori dal nostro spazio dei file non si carica
                      nemmeno qui: si mostra l'indirizzo, che è il motivo per
                      cui toglierla (lib/post/contenuti.ts). */}
                  {p.immagine_url &&
                    (immagineDelPost(p.immagine_url as string, process.env.NEXT_PUBLIC_SUPABASE_URL) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.immagine_url as string} alt="" className={CLASSE_IMMAGINE_POST} />
                    ) : (
                      <p className="mt-2 text-xs text-red-300">Immagine fuori dallo spazio dei file di KIREO, non mostrata: {p.immagine_url as string}</p>
                    ))}
                  {p.allegato_nome && <p className="mt-2 text-xs text-kireo-light">File: {p.allegato_nome as string}</p>}
                  {/* L'indirizzo per intero, e non l'etichetta che vede lo studente:
                      chi decide se togliere un post deve leggere dove porta. */}
                  {p.link_esterno && (
                    <a href={p.link_esterno as string} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-xs text-kireo-orange underline underline-offset-2">
                      Link: {p.link_esterno as string}
                    </a>
                  )}
                  {motivo && <p className="mt-2 text-xs text-red-300">{motivo}</p>}
                  {p.visibile && (
                    <TogliPost id={p.id as string} notifiche={erroreNotifichePost ? null : (notifichePerPost.get(p.id as string) ?? 0)} />
                  )}
                </li>
              );
            })}
          </ul>
          )}
          <Paginazione base={base} pagina={pagina} totale={totale} q={q} />
        </>
      )}
    </div>
  );
}
