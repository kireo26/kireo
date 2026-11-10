import type { createClient } from "@/lib/supabase/server";
import { SLUG_T3 } from "@/lib/test/config";
import { missioniDelBlocco } from "@/lib/test/missioni";
import type { LivelloGuida, SegnaleGuida, StatoArea } from "./config";

type SB = Awaited<ReturnType<typeof createClient>>;

// Raccoglie in una volta sola i segnali che decidono lo sblocco delle guide per
// TUTTE le aree: area_signal (status/interesse/confidenza), le missioni
// completate (per «≥1 missione del blocco»), e se T3 è stato completato. Poi
// espone `segnale(areaSlug)` → SegnaleGuida, riusato da indice e dettaglio.
export type ContestoGuide = { segnale: (areaSlug: string) => SegnaleGuida };

export async function caricaContestoGuide(supabase: SB, userId: string): Promise<ContestoGuide> {
  const [{ data: segnali }, { data: missioni }, { data: t3 }, { data: aperture }] = await Promise.all([
    supabase.from("area_signal").select("area_slug, interest_score, confidence, status").eq("student_id", userId),
    supabase.from("mission_attempt").select("mission_slug, stato").eq("student_id", userId).eq("stato", "completata"),
    supabase.from("test_attempt").select("id").eq("student_id", userId).eq("test_slug", SLUG_T3).eq("stato", "completata").limit(1),
    // Le guide già aperte si leggono da `guide_kireo_aperte`, che scrive solo il
    // server (20261211100000), MAI da activity_log: *un registro di attività non
    // è un titolo di accesso* (Mario, 10/11). Fino al 10/11 qui c'era
    // activity_log, che il client poteva scriversi da sé con il livello che
    // voleva, e una riga bastava ad aprire la guida 3.
    supabase.from("guide_kireo_aperte").select("area_slug, livello").eq("student_id", userId),
  ]);

  const perArea = new Map((segnali ?? []).map((s) => [s.area_slug, s]));
  const missioniCompletate = new Set((missioni ?? []).map((m) => m.mission_slug));
  const t3Completato = (t3 ?? []).length > 0;

  // Quali livelli sono già stati aperti, per area. Il livello non è mai vuoto
  // (la colonna è not null): le righe di prima che il livello esistesse sono
  // diventate Panoramiche nel riempimento di 20261211100000. Il ripiego a 1
  // resta per una risposta che arrivasse senza.
  const apertePerArea = new Map<string, Set<LivelloGuida>>();
  for (const r of aperture ?? []) {
    if (!r.area_slug) continue;
    const liv = (Number(r.livello) || 1) as LivelloGuida;
    if (liv !== 1 && liv !== 2 && liv !== 3) continue;
    const set = apertePerArea.get(r.area_slug) ?? new Set<LivelloGuida>();
    set.add(liv);
    apertePerArea.set(r.area_slug, set);
  }

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
        giaAperte: [...(apertePerArea.get(areaSlug) ?? [])],
      };
    },
  };
}
