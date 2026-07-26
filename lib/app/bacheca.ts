import type { SupabaseClient } from "@supabase/supabase-js";

export type PostBacheca = {
  id: string;
  istituzione_id: string;
  istituzione_nome: string;
  istituzione_slug: string;
  tipo: "testo" | "immagine" | "link_social";
  corpo: string;
  immagine_url: string | null;
  embed_url: string | null;
  created_at: string;
};

const PER_PAGINA = 10;

// Feed degli enti seguiti: post approvati, con quelli di un ente che ha
// ALMENO un evento in evidenza attivo (approvato, non ancora iniziato)
// anteposti — coerente col modello di promozione già in uso per gli
// eventi (in_evidenza), non un meccanismo nuovo.
export async function getFeedBacheca(
  supabase: SupabaseClient,
  studentId: string,
  pagina: number,
): Promise<{ post: PostBacheca[]; totale: number }> {
  try {
    const { data: seguiti } = await supabase.from("seguiti").select("istituzione_id").eq("student_id", studentId);
    const istituzioniSeguite = (seguiti ?? []).map((s) => s.istituzione_id);
    if (istituzioniSeguite.length === 0) return { post: [], totale: 0 };

    const { data: eventiEvidenza } = await supabase
      .from("eventi")
      .select("organizzatore_id")
      .in("organizzatore_id", istituzioniSeguite)
      .eq("in_evidenza", true)
      .eq("stato", "approvato")
      .gte("data_inizio", new Date().toISOString());
    const istituzioniInEvidenza = new Set((eventiEvidenza ?? []).map((e) => e.organizzatore_id));

    const { count } = await supabase
      .from("post_enti")
      .select("id", { count: "exact", head: true })
      .in("istituzione_id", istituzioniSeguite)
      .eq("stato", "approvato");

    const { data, error } = await supabase
      .from("post_enti")
      .select("id, istituzione_id, tipo, corpo, immagine_url, embed_url, created_at, istituzioni(nome, slug)")
      .in("istituzione_id", istituzioniSeguite)
      .eq("stato", "approvato")
      .order("created_at", { ascending: false })
      .range(0, (pagina + 1) * PER_PAGINA - 1);

    if (error) return { post: [], totale: 0 };

    const tuttiOrdinati = ((data ?? []) as Record<string, unknown>[])
      .map((riga) => {
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
          created_at: riga.created_at as string,
        };
      })
      .sort((a, b) => {
        const aEvidenza = istituzioniInEvidenza.has(a.istituzione_id);
        const bEvidenza = istituzioniInEvidenza.has(b.istituzione_id);
        if (aEvidenza !== bEvidenza) return aEvidenza ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    const inizio = pagina * PER_PAGINA;
    return { post: tuttiOrdinati.slice(inizio, inizio + PER_PAGINA), totale: count ?? tuttiOrdinati.length };
  } catch {
    return { post: [], totale: 0 };
  }
}

export const POST_PER_PAGINA = PER_PAGINA;
