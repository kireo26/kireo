import type { SupabaseClient } from "@supabase/supabase-js";

export type Webinar = {
  id: string;
  titolo: string;
  descrizione: string | null;
  area_slug: string | null;
  data_ora: string;
  durata_min: number;
  link_partecipazione: string | null;
};

export type AgendaData = {
  prossimi: Webinar[];
  passati: Webinar[];
  prenotati: string[];
};

const VUOTA: AgendaData = { prossimi: [], passati: [], prenotati: [] };

// La tabella `webinars` arriva con la migration della Fase 4, preparata ma
// non ancora applicata: finché non esiste tutto ritorna vuoto, mai un
// errore mostrato allo studente (stesso approccio di lib/app/webinars.ts).
export async function getAgendaData(supabase: SupabaseClient, userId: string): Promise<AgendaData> {
  try {
    const ora = new Date().toISOString();

    const [prossimiRes, passatiRes, prenotazioniRes] = await Promise.all([
      supabase.from("webinars").select("*").eq("pubblicato", true).gte("data_ora", ora).order("data_ora", { ascending: true }),
      supabase
        .from("webinars")
        .select("*")
        .eq("pubblicato", true)
        .lt("data_ora", ora)
        .order("data_ora", { ascending: false })
        .limit(20),
      supabase.from("webinar_registrations").select("webinar_id").eq("user_id", userId),
    ]);

    if (prossimiRes.error || passatiRes.error || prenotazioniRes.error) return VUOTA;

    return {
      prossimi: prossimiRes.data ?? [],
      passati: passatiRes.data ?? [],
      prenotati: (prenotazioniRes.data ?? []).map((p) => p.webinar_id),
    };
  } catch {
    return VUOTA;
  }
}
