import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrePctoDaEventi } from "./eventi";

// Traguardo di default: nessuna scuola/convenzione lo personalizza ancora,
// va reso configurabile (es. su `conventions`) quando servirà davvero.
export const TRAGUARDO_ORE_PCTO = 90;

// Ore certificate da due fonti legittimamente distinte, sommate: attività
// scolastiche certificate (student_activities, pipeline lato scuola/PCTO
// tradizionale) ed eventi KIREO/istituzioni a cui lo studente ha
// partecipato (iscrizioni_eventi con stato "partecipato", vedi
// lib/app/eventi.ts). Condivisa da Home e "Le mie attività".
export async function getOreCertificate(supabase: SupabaseClient, userId: string): Promise<number> {
  const [{ data }, oreEventi] = await Promise.all([
    supabase.from("student_activities").select("ore_certificate").eq("student_id", userId),
    getOrePctoDaEventi(supabase, userId),
  ]);
  const oreAttivita = (data ?? []).reduce((totale, riga) => totale + Number(riga.ore_certificate ?? 0), 0);
  return oreAttivita + oreEventi;
}
