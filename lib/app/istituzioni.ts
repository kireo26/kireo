import type { SupabaseClient } from "@supabase/supabase-js";

export type IstituzionePubblica = {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  descrizione: string | null;
  immagine_copertina_url: string | null;
  sito_ufficiale: string | null;
};

const COLONNE_ISTITUZIONE_PUBBLICA = "id, nome, slug, tipo, descrizione, immagine_copertina_url, sito_ufficiale";

// Solo istituzioni attive sono selezionabili da anon/authenticated (RLS),
// quindi questa non ha bisogno di controllare lo stato lato applicazione.
export async function getIstituzionePubblicaBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<IstituzionePubblica | null> {
  try {
    const { data, error } = await supabase
      .from("istituzioni")
      .select(COLONNE_ISTITUZIONE_PUBBLICA)
      .eq("slug", slug)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export type GuidaEnte = { id: string; titolo: string; pdf_url: string };

export async function getGuideEnte(supabase: SupabaseClient, istituzioneId: string): Promise<GuidaEnte[]> {
  try {
    const { data, error } = await supabase
      .from("guide_enti")
      .select("id, titolo, pdf_url")
      .eq("istituzione_id", istituzioneId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function isIscrittoNewsletter(supabase: SupabaseClient, studentId: string, istituzioneId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("newsletter_iscrizioni")
      .select("id")
      .eq("student_id", studentId)
      .eq("istituzione_id", istituzioneId)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

const ETICHETTE_TIPO_ISTITUZIONE: Record<string, string> = {
  universita: "Università",
  its: "ITS Academy",
  academy: "Accademia",
  ente_professionale: "Ente di formazione professionale",
  altro: "Istituzione formativa",
};

export function etichettaTipoIstituzione(tipo: string): string {
  return ETICHETTE_TIPO_ISTITUZIONE[tipo] ?? "Istituzione formativa";
}
