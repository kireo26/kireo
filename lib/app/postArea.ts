import type { SupabaseClient } from "@supabase/supabase-js";
import { descriviErrore } from "@/lib/erroreSupabase";
import { AREE } from "@/data/aree";
import { COLONNE, daRiga, type PostBacheca } from "@/lib/app/bacheca";

// I POST DEGLI ENTI NELLA PAGINA DI UN'AREA (Mario, 31/10).
//
// La pagina dell'area è di KIREO: gli enti ci stanno dentro, non sopra. Per
// questo la sezione sta dopo «Enti di quest'area» e ha un TETTO: con 3 post al
// giorno per ente e più enti per area, senza tetto diventerebbe un flusso
// infinito, e tutto il resto della pagina — il motivo per cui esiste — finirebbe
// sotto la piega. Gli altri post stanno nella pagina di ogni ente.
export const POST_AREA_MASSIMO = 3;

// Al massimo due aree per post, solo fra quelle approvate (il trigger
// `post_enti_aree_approvate` lo ripete nel database).
export const MAX_AREE_POST = 2;

// ⚠️ UN'AREA REVOCATA: il post esce dalla pagina dell'area e resta nella
// bacheca dell'ente (Mario, 31/10). La regola sta QUI, nella lettura: un post
// si mostra solo se l'area è approvata per quell'ente ADESSO, e l'ente è attivo.
// La colonna `aree` non si ripulisce, quindi se l'area torna approvata il post
// torna. Prima si leggono gli enti con l'area approvata, poi i loro post.
export type EsitoPostArea = { stato: "non_letto" } | { stato: "post"; post: PostBacheca[] };

export async function getPostDellArea(supabase: SupabaseClient, areaSlug: string): Promise<EsitoPostArea> {
  try {
    const { data: aree, error: erroreAree } = await supabase
      .from("istituzioni_aree")
      .select("istituzione_id, istituzioni!inner(stato)")
      .eq("area_slug", areaSlug)
      .eq("stato", "approvata")
      .eq("istituzioni.stato", "attiva");
    if (erroreAree || !aree) {
      if (erroreAree) console.error("Pagina area, enti con l'area approvata:", descriviErrore(erroreAree));
      return { stato: "non_letto" };
    }
    const enti = aree.map((r) => r.istituzione_id as string);
    if (enti.length === 0) return { stato: "post", post: [] };

    const { data, error } = await supabase
      .from("post_enti")
      .select(COLONNE)
      .eq("visibile", true)
      .contains("aree", [areaSlug])
      .in("istituzione_id", enti)
      .order("visibile_dal", { ascending: false })
      .order("id", { ascending: false })
      .limit(POST_AREA_MASSIMO);
    if (error || !data) {
      if (error) console.error("Pagina area, post:", descriviErrore(error));
      return { stato: "non_letto" };
    }
    return { stato: "post", post: (data as Record<string, unknown>[]).map(daRiga) };
  } catch (errore) {
    console.error("Pagina area, lettura dei post non riuscita:", errore);
    return { stato: "non_letto" };
  }
}

// Le aree che un ente può dare a un post: solo le APPROVATE, e solo fra le 18
// aree di orientamento (i filoni per i docenti non hanno una pagina d'area).
// null = non lette: il modulo lo dice e il post si pubblica senza aree.
export async function leggiAreeApprovateEnte(supabase: SupabaseClient, istituzioneId: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from("istituzioni_aree")
      .select("area_slug")
      .eq("istituzione_id", istituzioneId)
      .eq("stato", "approvata");
    if (error || !data) {
      if (error) console.error("[ente] aree approvate:", descriviErrore(error));
      return null;
    }
    const slug = new Set(AREE.map((a) => a.slug));
    return data.map((r) => r.area_slug as string).filter((s) => slug.has(s));
  } catch {
    return null;
  }
}

// Testi del campo nel modulo del post. La riga sotto la scelta è di Mario;
// le altre due sono mie e provvisorie.
export const TESTI_AREE_POST = {
  etichetta: "In quale area mostrarlo (facoltativo, al massimo 2)",
  riga: "Il post comparirà nella pagina di quest'area, anche agli studenti che non ti seguono.",
  nessuna:
    "Un post si può mostrare nella pagina di un'area solo fra le aree che KIREO ha approvato per te, e per ora non ce n'è nessuna. Le aree si scelgono nel profilo.",
  nonLette: "Non siamo riusciti a leggere le tue aree approvate: puoi pubblicare il post, ma per ora senza un'area.",
  troppe: `Puoi scegliere al massimo ${MAX_AREE_POST} aree.`,
  nonApprovata: "Una delle aree scelte non è più approvata per te: ricarica la pagina e scegli di nuovo.",
} as const;

// Testi della sezione nella pagina dell'area (miei e provvisori).
export const TESTI_SEZIONE_POST_AREA = {
  eyebrow: "Dagli enti",
  titolo: "Cosa dicono gli enti di quest'area",
  nonLetti: "Non siamo riusciti a leggere i post degli enti di quest'area: ricarica la pagina.",
} as const;
