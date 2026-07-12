import type { SupabaseClient } from "@supabase/supabase-js";

export type VoceStorico = {
  id: string;
  tipo: "attivita" | "webinar";
  titolo: string;
  data: string;
  oreCertificate: number | null;
};

type RigaStudentActivity = {
  id: string;
  ore_certificate: number | null;
  completed_at: string | null;
  created_at: string;
  activities: { titolo: string } | { titolo: string }[] | null;
};

type RigaWebinarRegistration = {
  created_at: string;
  webinars: { id: string; titolo: string; data_ora: string } | { id: string; titolo: string; data_ora: string }[] | null;
};

// Storico unico per "Le mie attività": attività (student_activities, già in
// produzione) + webinar prenotati (webinar_registrations, arriva con la
// Fase 4 — se la tabella non esiste ancora, quella parte resta vuota senza
// far fallire il resto).
export async function getStoricoAttivita(supabase: SupabaseClient, userId: string): Promise<VoceStorico[]> {
  const { data: attivita } = await supabase
    .from("student_activities")
    .select("id, ore_certificate, completed_at, created_at, activities(titolo)")
    .eq("student_id", userId);

  const vociAttivita: VoceStorico[] = ((attivita ?? []) as RigaStudentActivity[]).map((riga) => {
    const rel = Array.isArray(riga.activities) ? riga.activities[0] : riga.activities;
    return {
      id: `attivita-${riga.id}`,
      tipo: "attivita",
      titolo: rel?.titolo ?? "Attività",
      data: riga.completed_at ?? riga.created_at,
      oreCertificate: riga.ore_certificate ?? null,
    };
  });

  let vociWebinar: VoceStorico[] = [];
  try {
    const { data: webinar, error } = await supabase
      .from("webinar_registrations")
      .select("created_at, webinars(id, titolo, data_ora)")
      .eq("user_id", userId);

    if (!error) {
      vociWebinar = ((webinar ?? []) as RigaWebinarRegistration[]).map((riga) => {
        const rel = Array.isArray(riga.webinars) ? riga.webinars[0] : riga.webinars;
        return {
          id: `webinar-${rel?.id ?? riga.created_at}`,
          tipo: "webinar" as const,
          titolo: rel?.titolo ?? "Webinar",
          data: rel?.data_ora ?? riga.created_at,
          oreCertificate: null,
        };
      });
    }
  } catch {
    vociWebinar = [];
  }

  return [...vociAttivita, ...vociWebinar].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}
