import type { SupabaseClient } from "@supabase/supabase-js";
import { eventoNonFinito } from "@/lib/app/eventi";

export type WebinarDocente = {
  id: string;
  titolo: string;
  descrizione: string | null;
  data_inizio: string;
  data_fine: string | null;
  diretta_chiusa_il: string | null;
  link: string | null;
  filone: string;
  organizzatore_id: string | null;
  organizzatore_nome: string | null;
  youtube_video_id: string | null;
};

const COLONNE_WEBINAR =
  "id, titolo, descrizione, data_inizio, data_fine, diretta_chiusa_il, link, filone, organizzatore_id, youtube_video_id, istituzioni(nome)";

function mappaRiga(riga: Record<string, unknown>): WebinarDocente {
  const org = riga.istituzioni as { nome: string } | { nome: string }[] | null;
  const organizzatore = Array.isArray(org) ? org[0] : org;
  return {
    id: riga.id as string,
    titolo: riga.titolo as string,
    descrizione: (riga.descrizione as string | null) ?? null,
    data_inizio: riga.data_inizio as string,
    data_fine: (riga.data_fine as string | null) ?? null,
    diretta_chiusa_il: (riga.diretta_chiusa_il as string | null) ?? null,
    link: (riga.link as string | null) ?? null,
    filone: riga.filone as string,
    organizzatore_id: (riga.organizzatore_id as string | null) ?? null,
    organizzatore_nome: organizzatore?.nome ?? null,
    youtube_video_id: (riga.youtube_video_id as string | null) ?? null,
  };
}

// Solo eventi pubblico=docenti: mai mescolati con gli eventi studenti (né
// nelle liste docente, né — simmetricamente — un webinar docenti compare
// nelle liste studente, vedi lib/app/eventi.ts).
export async function getProssimiWebinar(supabase: SupabaseClient, limite?: number): Promise<WebinarDocente[]> {
  try {
    const query = supabase
      .from("eventi")
      .select(COLONNE_WEBINAR)
      .eq("pubblico", "docenti")
      .eq("stato", "approvato")
      // Stesso confine dell'Agenda studenti (18/10): un webinar IN CORSO è un
      // webinar prossimo — ci si entra ancora. Vedi `eventoNonFinito`.
      .gte("data_inizio", new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString())
      .order("data_inizio", { ascending: true });
    const { data, error } = await query;
    if (error) return [];
    const prossimi = (data ?? []).map(mappaRiga).filter((w) => eventoNonFinito(w));
    return limite ? prossimi.slice(0, limite) : prossimi;
  } catch {
    return [];
  }
}

export async function getWebinarPassati(supabase: SupabaseClient, limite = 20): Promise<WebinarDocente[]> {
  try {
    const { data, error } = await supabase
      .from("eventi")
      .select(COLONNE_WEBINAR)
      .eq("pubblico", "docenti")
      .eq("stato", "approvato")
      .lt("data_inizio", new Date().toISOString())
      .order("data_inizio", { ascending: false })
      .limit(limite + 5);
    if (error) return [];
    return (data ?? []).map(mappaRiga).filter((w) => !eventoNonFinito(w)).slice(0, limite);
  } catch {
    return [];
  }
}

// Mappa evento_id -> stato ("iscritto" | "partecipato") per il docente
// corrente: iscrizioni_eventi è la stessa tabella degli studenti (student_id
// è una FK verso profiles, non student_profiles — qualunque ruolo può
// averci una riga, vedi la migration attestati per i dettagli).
export async function getIscrizioniDocente(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase.from("iscrizioni_eventi").select("evento_id, stato").eq("student_id", userId);
    if (error) return {};
    const mappa: Record<string, string> = {};
    for (const riga of data ?? []) mappa[riga.evento_id] = riga.stato;
    return mappa;
  } catch {
    return {};
  }
}
