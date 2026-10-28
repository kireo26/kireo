import type { SupabaseClient } from "@supabase/supabase-js";
import { descriviErrore } from "@/lib/erroreSupabase";

export type PostBacheca = {
  id: string;
  istituzione_id: string;
  istituzione_nome: string;
  istituzione_slug: string;
  tipo: "testo" | "immagine" | "link_social";
  corpo: string;
  immagine_url: string | null;
  embed_url: string | null;
  // Quando il post è diventato visibile agli studenti: `approvato_il`, scritto
  // dal database (20261110100000). Non `created_at`: un post scritto lunedì e
  // approvato mercoledì, per chi legge, nasce mercoledì.
  pubblicato_il: string;
};

// L'ESITO HA TRE FACCE, e non due (Mario, 28/10). Prima una lettura fallita
// tornava «nessun post», e la pagina diceva «non segui ancora nessun ente» a
// chi ne segue sei; quando la Bacheca diventa la home, quella frase la legge
// chiunque passi nel momento sbagliato.
export type EsitoBacheca =
  | { stato: "non_letto" }
  | { stato: "nessun_ente" }
  | { stato: "post"; post: PostBacheca[]; cursoreSuccessivo: string | null };

export const POST_PER_PAGINA = 10;

// IL CURSORE (Mario, 28/10). L'ordine è `approvato_il` decrescente, con `id`
// a spezzare i pari; la pagina dopo comincia DOPO l'ultimo post visto, non
// dopo i primi N. Così un post approvato mentre si scorre non fa ricomparire
// l'ultimo della pagina prima, e non ne fa saltare uno: in un flusso che si
// scrolla un post che salta non torna, e nessuno sa che è saltato.
// E l'ordine lo decide il database e basta: niente riordino in JavaScript
// dopo il `range`, che era la causa dei salti (la spinta agli enti con un
// evento in evidenza riordinava ogni pagina dopo averla tagliata; nessun testo
// la prometteva agli enti, ed è uscita).
export function codificaCursore(p: { pubblicato_il: string; id: string }): string {
  return `${p.pubblicato_il}~${p.id}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Solo i caratteri di un istante come lo scrive Postgres
// («2026-10-28T14:23:24.472898+00:00»): il valore finisce in un filtro.
const ISTANTE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

// Un cursore che non si legge non è un errore dello studente: si riparte
// dall'inizio. ⚠️ L'istante passa COM'È, senza `new Date()`: JavaScript tiene i
// millisecondi e il database i microsecondi, e un cursore troncato farebbe
// saltare un post pubblicato nello stesso millesimo, qualche microsecondo
// dopo l'ultimo visto — il salto che il cursore esiste per non fare.
export function leggiCursore(valore: string | undefined): { quando: string; id: string } | null {
  if (!valore) return null;
  const [quando, id, ...resto] = valore.split("~");
  if (resto.length > 0 || !quando || !id || !UUID.test(id) || !ISTANTE.test(quando)) return null;
  return { quando, id };
}

export async function getFeedBacheca(
  supabase: SupabaseClient,
  studentId: string,
  cursore: { quando: string; id: string } | null,
): Promise<EsitoBacheca> {
  try {
    const { data: seguiti, error: erroreSeguiti } = await supabase
      .from("seguiti")
      .select("istituzione_id")
      .eq("student_id", studentId);
    if (erroreSeguiti || !seguiti) {
      if (erroreSeguiti) console.error("Bacheca, enti seguiti:", descriviErrore(erroreSeguiti));
      return { stato: "non_letto" };
    }
    const istituzioniSeguite = seguiti.map((s) => s.istituzione_id as string);
    if (istituzioniSeguite.length === 0) return { stato: "nessun_ente" };

    let query = supabase
      .from("post_enti")
      .select("id, istituzione_id, tipo, corpo, immagine_url, embed_url, approvato_il, istituzioni(nome, slug)")
      .in("istituzione_id", istituzioniSeguite)
      .eq("stato", "approvato")
      .order("approvato_il", { ascending: false })
      .order("id", { ascending: false })
      .limit(POST_PER_PAGINA + 1);
    if (cursore) {
      query = query.or(`approvato_il.lt.${cursore.quando},and(approvato_il.eq.${cursore.quando},id.lt.${cursore.id})`);
    }
    const { data, error } = await query;
    if (error || !data) {
      if (error) console.error("Bacheca, post:", descriviErrore(error));
      return { stato: "non_letto" };
    }

    const righe = (data as Record<string, unknown>[]).map((riga) => {
      const org = riga.istituzioni as { nome: string; slug: string } | { nome: string; slug: string }[] | null;
      const istituzione = Array.isArray(org) ? org[0] : org;
      return {
        id: riga.id as string,
        istituzione_id: riga.istituzione_id as string,
        istituzione_nome: istituzione?.nome ?? "Istituzione",
        istituzione_slug: istituzione?.slug ?? "",
        tipo: riga.tipo as PostBacheca["tipo"],
        corpo: riga.corpo as string,
        immagine_url: (riga.immagine_url as string | null) ?? null,
        embed_url: (riga.embed_url as string | null) ?? null,
        pubblicato_il: riga.approvato_il as string,
      };
    });
    const post = righe.slice(0, POST_PER_PAGINA);
    const ultimo = post[post.length - 1];
    const cursoreSuccessivo = righe.length > POST_PER_PAGINA && ultimo ? codificaCursore(ultimo) : null;
    return { stato: "post", post, cursoreSuccessivo };
  } catch (errore) {
    console.error("Bacheca, lettura non riuscita:", errore);
    return { stato: "non_letto" };
  }
}
