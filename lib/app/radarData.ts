import type { SupabaseClient } from "@supabase/supabase-js";

// Punteggio di esplorazione per area dalla vista score_aree (somma dei pesi
// in activity_log). Non esplode se vista/tabella non esistono ancora
// (migration non applicata): errore o dati assenti producono {} — stato
// zero del radar, non un crash.
export async function getValoriRadar(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase.from("score_aree").select("area_slug, punteggio").eq("student_id", userId);
    if (error) return {};

    const valori: Record<string, number> = {};
    for (const riga of data ?? []) {
      valori[riga.area_slug] = riga.punteggio;
    }
    return valori;
  } catch {
    return {};
  }
}
