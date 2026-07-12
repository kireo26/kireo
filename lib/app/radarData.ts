import type { SupabaseClient } from "@supabase/supabase-js";

type RigaAttivita = { activities: { area: string | null } | { area: string | null }[] | null };

// Conta le attività completate per area, per il radar attitudinale in Home.
// Assume che activities.area contenga lo slug esatto di data/aree.ts: è una
// convenzione da rispettare quando si popola il catalogo attività (oggi la
// tabella è vuota, quindi questo restituisce sempre {}).
export async function getValoriRadar(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("student_activities")
    .select("activities(area)")
    .eq("student_id", userId)
    .eq("stato", "completata");

  const valori: Record<string, number> = {};
  for (const riga of (data ?? []) as RigaAttivita[]) {
    const rel = riga.activities;
    const area = Array.isArray(rel) ? rel[0]?.area : rel?.area;
    if (!area) continue;
    valori[area] = (valori[area] ?? 0) + 1;
  }
  return valori;
}
