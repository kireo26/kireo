import type { SupabaseClient } from "@supabase/supabase-js";
import { descriviErrore } from "@/lib/erroreSupabase";

export type PostBacheca = {
  id: string;
  istituzione_id: string;
  istituzione_nome: string;
  istituzione_slug: string;
  // `link_social` è uscito dal 20261120100000 (nessun post l'ha mai avuto).
  tipo: "testo" | "immagine" | "file";
  corpo: string;
  immagine_url: string | null;
  // Il link facoltativo di qualsiasi post (20261120100000), e il nome del file.
  // Il percorso del file non si legge qui: lo dà la route che scrive la traccia.
  link_esterno: string | null;
  allegato_nome: string | null;
  // Quando il post è diventato visibile agli studenti: `visibile_dal`, scritto
  // dal database (20261113110000). Per i post di prima del 29/10 è la data di
  // approvazione (un post scritto lunedì e approvato mercoledì, per chi legge,
  // nasce mercoledì); dopo, l'istante della pubblicazione.
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

// IL CURSORE (Mario, 28/10). L'ordine è `visibile_dal` decrescente, con `id`
// a spezzare i pari; la pagina dopo comincia DOPO l'ultimo post visto, non
// dopo i primi N. Così un post pubblicato mentre si scorre non fa ricomparire
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

const COLONNE = "id, istituzione_id, tipo, corpo, immagine_url, link_esterno, allegato_nome, visibile_dal, istituzioni(nome, slug)";

function daRiga(riga: Record<string, unknown>): PostBacheca {
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
    link_esterno: (riga.link_esterno as string | null) ?? null,
    allegato_nome: (riga.allegato_nome as string | null) ?? null,
    pubblicato_il: riga.visibile_dal as string,
  };
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
      .select(COLONNE)
      .in("istituzione_id", istituzioniSeguite)
      // Cosa è visibile lo dice il database (`post_stato_visibile`, da cui nasce
      // la colonna): qui non si ripete l'elenco degli stati.
      .eq("visibile", true)
      .order("visibile_dal", { ascending: false })
      .order("id", { ascending: false })
      .limit(POST_PER_PAGINA + 1);
    if (cursore) {
      query = query.or(`visibile_dal.lt.${cursore.quando},and(visibile_dal.eq.${cursore.quando},id.lt.${cursore.id})`);
    }
    const { data, error } = await query;
    if (error || !data) {
      if (error) console.error("Bacheca, post:", descriviErrore(error));
      return { stato: "non_letto" };
    }

    const righe = (data as Record<string, unknown>[]).map(daRiga);
    const post = righe.slice(0, POST_PER_PAGINA);
    const ultimo = post[post.length - 1];
    const cursoreSuccessivo = righe.length > POST_PER_PAGINA && ultimo ? codificaCursore(ultimo) : null;
    return { stato: "post", post, cursoreSuccessivo };
  } catch (errore) {
    console.error("Bacheca, lettura non riuscita:", errore);
    return { stato: "non_letto" };
  }
}

// IL POST DI UNA NOTIFICA (29/10). Fino a oggi «Nuovo post di un ente che segui»
// portava a `/app/bacheca` e basta: se il post era stato tolto, lo studente
// cercava una cosa che non c'era e nessuno gli diceva perché, e se era l'unico
// leggeva «non hanno ancora pubblicato niente», che era falso. Ora la notifica
// porta `?post=<id>`, e la pagina dice quale dei tre casi è: il post c'è, non
// c'è più, o non l'abbiamo potuto leggere.
export type EsitoPostNotifica = { stato: "non_letto" } | { stato: "non_piu_visibile" } | { stato: "post"; post: PostBacheca };

export function leggiIdPost(valore: string | undefined): string | null {
  return valore && UUID.test(valore) ? valore : null;
}

export async function getPostDellaNotifica(supabase: SupabaseClient, id: string): Promise<EsitoPostNotifica> {
  try {
    const { data, error } = await supabase.from("post_enti").select(COLONNE).eq("id", id).eq("visibile", true).maybeSingle();
    if (error) {
      console.error("Bacheca, post della notifica:", descriviErrore(error));
      return { stato: "non_letto" };
    }
    // Zero righe: non è visibile (tolto, o mai esistito). Chi legge non vede le
    // righe tolte, quindi «perché» non si può dire, e non si inventa.
    if (!data) return { stato: "non_piu_visibile" };
    return { stato: "post", post: daRiga(data as Record<string, unknown>) };
  } catch (errore) {
    console.error("Bacheca, post della notifica:", errore);
    return { stato: "non_letto" };
  }
}

/**
 * Quali dei post chiesti lo studente ha salvato. `null` se la lettura non è
 * riuscita: «non letto», e il bottone «Salva» non afferma niente invece di
 * dire «non salvato» a chi l'ha salvato.
 */
export async function leggiPostSalvati(supabase: SupabaseClient, ids: string[]): Promise<Set<string> | null> {
  if (ids.length === 0) return new Set();
  try {
    const { data, error } = await supabase.from("post_salvati").select("post_id").in("post_id", ids);
    if (error || !data) {
      if (error) console.error("Bacheca, post salvati:", descriviErrore(error));
      return null;
    }
    return new Set(data.map((r) => r.post_id as string));
  } catch (errore) {
    console.error("Bacheca, post salvati:", errore);
    return null;
  }
}
