import type { createClient } from "@/lib/supabase/server";
import { SLUG_T3 } from "@/lib/test/config";
import { missioniDelBlocco } from "@/lib/test/missioni";
import type { SegnaleGuida, StatoArea } from "./config";

type SB = Awaited<ReturnType<typeof createClient>>;

// Raccoglie in una volta sola i segnali che decidono lo sblocco delle guide per
// TUTTE le aree: area_signal (status/interesse/confidenza), le missioni
// completate (per «≥1 missione del blocco»), e se T3 è stato completato. Poi
// espone `segnale(areaSlug)` → SegnaleGuida, riusato da indice e dettaglio.
export type ContestoGuide = { segnale: (areaSlug: string) => SegnaleGuida };

export async function caricaContestoGuide(supabase: SB, userId: string): Promise<ContestoGuide> {
  const [{ data: segnali }, { data: missioni }, { data: t3 }] = await Promise.all([
    supabase.from("area_signal").select("area_slug, interest_score, confidence, status").eq("student_id", userId),
    supabase.from("mission_attempt").select("mission_slug, stato").eq("student_id", userId).eq("stato", "completata"),
    supabase.from("test_attempt").select("id").eq("student_id", userId).eq("test_slug", SLUG_T3).eq("stato", "completata").limit(1),
  ]);

  const perArea = new Map((segnali ?? []).map((s) => [s.area_slug, s]));
  const missioniCompletate = new Set((missioni ?? []).map((m) => m.mission_slug));
  const t3Completato = (t3 ?? []).length > 0;

  return {
    segnale(areaSlug: string): SegnaleGuida {
      const s = perArea.get(areaSlug);
      const delBlocco = missioniDelBlocco(areaSlug);
      const missioniBloccoCompletate = delBlocco.filter((slug) => missioniCompletate.has(slug)).length;
      return {
        status: (s?.status as StatoArea | undefined) ?? null,
        interestScore: Number(s?.interest_score) || 0,
        confidence: Number(s?.confidence) || 0,
        t3Completato,
        missioniBloccoCompletate,
      };
    },
  };
}
