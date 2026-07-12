import type { SupabaseClient } from "@supabase/supabase-js";

// Traguardo di default: nessuna scuola/convenzione lo personalizza ancora,
// va reso configurabile (es. su `conventions`) quando servirà davvero.
export const TRAGUARDO_ORE_PCTO = 90;

// Somma delle ore certificate dello studente, condivisa da Home e "Le mie
// attività" (una sola query, non duplicata tra le due pagine).
export async function getOreCertificate(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase.from("student_activities").select("ore_certificate").eq("student_id", userId);
  return (data ?? []).reduce((totale, riga) => totale + Number(riga.ore_certificate ?? 0), 0);
}
