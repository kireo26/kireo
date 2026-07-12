import type { SupabaseClient } from "@supabase/supabase-js";

export type ProssimoWebinar = { id: string; titolo: string; data_ora: string };

// La tabella `webinars` arriva con la migration della Fase 4 (Agenda),
// preparata ma non ancora applicata: finché non esiste, o finché non ci
// sono webinar pubblicati, il risultato è onestamente null — mai un errore
// mostrato allo studente in Home.
export async function getProssimoWebinar(supabase: SupabaseClient): Promise<ProssimoWebinar | null> {
  try {
    const { data, error } = await supabase
      .from("webinars")
      .select("id, titolo, data_ora")
      .eq("pubblicato", true)
      .gte("data_ora", new Date().toISOString())
      .order("data_ora", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}
