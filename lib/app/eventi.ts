import type { SupabaseClient } from "@supabase/supabase-js";

export type Evento = {
  id: string;
  titolo: string;
  descrizione: string | null;
  tipo: "webinar" | "workshop" | "altro";
  data_inizio: string;
  data_fine: string | null;
  sede: string | null;
  link: string | null;
  posti: number | null;
  ore_pcto: number;
  organizzatore_id: string | null;
  cta_esterna_url: string | null;
  cta_esterna_approvata: boolean;
};

const COLONNE_EVENTO =
  "id, titolo, descrizione, tipo, data_inizio, data_fine, sede, link, posti, ore_pcto, organizzatore_id, cta_esterna_url, cta_esterna_approvata";

// Tutte le funzioni qui sotto non esplodono se le tabelle non esistono
// ancora (migration preparata, non applicata): qualunque errore produce un
// risultato vuoto, mai un crash o un errore mostrato allo studente — stesso
// principio già applicato a lib/app/webinars.ts nella sessione precedente.

export async function getProssimiEventi(supabase: SupabaseClient, limite?: number): Promise<Evento[]> {
  try {
    let query = supabase
      .from("eventi")
      .select(COLONNE_EVENTO)
      .gte("data_inizio", new Date().toISOString())
      .order("data_inizio", { ascending: true });
    if (limite) query = query.limit(limite);
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as Evento[];
  } catch {
    return [];
  }
}

export async function getEventiPassati(supabase: SupabaseClient, limite = 20): Promise<Evento[]> {
  try {
    const { data, error } = await supabase
      .from("eventi")
      .select(COLONNE_EVENTO)
      .lt("data_inizio", new Date().toISOString())
      .order("data_inizio", { ascending: false })
      .limit(limite);
    if (error) return [];
    return (data ?? []) as Evento[];
  } catch {
    return [];
  }
}

// Eventi approvati taggati su una specifica area (via eventi_aree),
// ordinati per data. Si affida alla RLS di `eventi` (solo approvati sono
// selezionabili): un evento non approvato risulta semplicemente assente
// dall'embed, senza bisogno di ricontrollarne lo stato qui.
export async function getEventiPerArea(supabase: SupabaseClient, areaSlug: string): Promise<Evento[]> {
  try {
    const { data, error } = await supabase
      .from("eventi_aree")
      .select(`eventi(${COLONNE_EVENTO})`)
      .eq("area_slug", areaSlug);

    if (error) return [];

    return ((data ?? []) as { eventi: Evento | Evento[] | null }[])
      .map((riga) => (Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi))
      .filter((e): e is Evento => Boolean(e))
      .sort((a, b) => new Date(a.data_inizio).getTime() - new Date(b.data_inizio).getTime());
  } catch {
    return [];
  }
}

// Eventi approvati organizzati da una specifica istituzione, per il
// profilo pubblico /istituzioni/[slug] — ordinati per data, futuri e
// passati insieme (a differenza dell'Agenda studente, qui non si separano).
export async function getEventiIstituzione(supabase: SupabaseClient, istituzioneId: string): Promise<Evento[]> {
  try {
    const { data, error } = await supabase
      .from("eventi")
      .select(COLONNE_EVENTO)
      .eq("organizzatore_id", istituzioneId)
      .order("data_inizio", { ascending: true });
    if (error) return [];
    return (data ?? []) as Evento[];
  } catch {
    return [];
  }
}

// Mappa evento_id -> slug delle aree taggate, per mostrare i tag sulle card.
export async function getAreeDegliEventi(supabase: SupabaseClient, eventoIds: string[]): Promise<Record<string, string[]>> {
  if (eventoIds.length === 0) return {};
  try {
    const { data, error } = await supabase.from("eventi_aree").select("evento_id, area_slug").in("evento_id", eventoIds);
    if (error) return {};
    const mappa: Record<string, string[]> = {};
    for (const riga of data ?? []) {
      mappa[riga.evento_id] = [...(mappa[riga.evento_id] ?? []), riga.area_slug];
    }
    return mappa;
  } catch {
    return {};
  }
}

// Id degli eventi a cui lo studente è iscritto (qualunque stato).
export async function getIscrizioniStudente(supabase: SupabaseClient, userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.from("iscrizioni_eventi").select("evento_id").eq("student_id", userId);
    if (error) return [];
    return (data ?? []).map((r) => r.evento_id);
  } catch {
    return [];
  }
}

// Come sopra, ma con l'origine (studente/scuola): per mostrare l'etichetta
// "Iscritto dalla tua scuola" quando l'iscrizione è d'ufficio (vedi
// CLAUDE.md — non è un segnale di interesse, ma lo studente deve saperlo).
export async function getIscrizioniStudenteConOrigine(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, "studente" | "scuola">> {
  try {
    const { data, error } = await supabase.from("iscrizioni_eventi").select("evento_id, origine").eq("student_id", userId);
    if (error) return {};
    const mappa: Record<string, "studente" | "scuola"> = {};
    for (const riga of data ?? []) {
      mappa[riga.evento_id] = (riga.origine as "studente" | "scuola") ?? "studente";
    }
    return mappa;
  } catch {
    return {};
  }
}

// Prossimi eventi (già iniziati esclusi) taggati su una qualunque delle
// aree passate, deduplicati (un evento può avere più aree in comune),
// ordinati per data. Usata dalla card "Prossimi eventi per te" in Home.
export async function getProssimiEventiPerAree(supabase: SupabaseClient, areeSlugs: string[], limite = 3): Promise<Evento[]> {
  if (areeSlugs.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from("eventi_aree")
      .select(`eventi(${COLONNE_EVENTO})`)
      .in("area_slug", areeSlugs);
    if (error) return [];

    const eventi = ((data ?? []) as { eventi: Evento | Evento[] | null }[])
      .map((riga) => (Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi))
      .filter((e): e is Evento => Boolean(e))
      .filter((e) => new Date(e.data_inizio) >= new Date());

    const unici = Array.from(new Map(eventi.map((e) => [e.id, e])).values());
    return unici.sort((a, b) => new Date(a.data_inizio).getTime() - new Date(b.data_inizio).getTime()).slice(0, limite);
  } catch {
    return [];
  }
}

// Ore PCTO totali da eventi con iscrizione "partecipato" (si somma alle ore
// certificate da student_activities, vedi lib/app/pcto.ts: sono due fonti
// legittimamente distinte — attività scolastiche certificate vs eventi
// KIREO/istituzioni a cui lo studente ha davvero partecipato).
export async function getOrePctoDaEventi(supabase: SupabaseClient, userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("iscrizioni_eventi")
      .select("eventi(ore_pcto)")
      .eq("student_id", userId)
      .eq("stato", "partecipato");
    if (error) return 0;
    return ((data ?? []) as { eventi: { ore_pcto: number } | { ore_pcto: number }[] | null }[]).reduce((tot, riga) => {
      const rel = Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi;
      return tot + Number(rel?.ore_pcto ?? 0);
    }, 0);
  } catch {
    return 0;
  }
}
