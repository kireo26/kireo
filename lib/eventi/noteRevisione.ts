// La nota di revisione degli eventi, per chi ne ha diritto (20261101100000).
// Un posto solo per le tre letture (l'elenco dell'ente, la coda dell'admin, la
// pagina dell'evento): la colonna non si legge più dalla tabella, e tre
// chiamate scritte a mano divergerebbero.
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mappa evento → nota (`null` se l'evento non ne ha). Gli id per cui la
 * funzione non restituisce niente (non tuoi) NON compaiono. Se la lettura
 * fallisce restituisce `null` invece della mappa: non letta, che non è vuota.
 */
export async function leggiNoteRevisione(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string | null> | null> {
  const note = new Map<string, string | null>();
  if (ids.length === 0) return note;
  const { data, error } = await supabase.rpc("note_revisione_eventi", { p_ids: ids });
  if (error) {
    console.error("[eventi] note_revisione_eventi:", error);
    return null;
  }
  for (const r of (data ?? []) as Array<{ evento_id: string; note_revisione: string | null }>) note.set(r.evento_id, r.note_revisione);
  return note;
}

/** Mette la nota su ogni evento: `undefined` dove la lettura è fallita, `null` dove non c'è. */
export function conNoteRevisione<E extends { id: string }>(eventi: E[], note: Map<string, string | null> | null): (E & { note_revisione?: string | null })[] {
  return eventi.map((e) => ({ ...e, note_revisione: note === null ? undefined : (note.get(e.id) ?? null) }));
}
