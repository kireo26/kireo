import type { SupabaseClient } from "@supabase/supabase-js";

export type EnteEsplora = {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  immagineCopertinaUrl: string | null;
  aree: string[];
  follower: number;
  prossimiEventi: number;
  inEvidenza: boolean;
};

export type FiltriEsplora = {
  query?: string;
  areaSlug?: string;
  tipo?: string;
  provincia?: string;
  soloConEventi?: boolean;
};

const MAX_IN_EVIDENZA_IN_TESTA = 3;

// Ricerca enti — riusata da /app/esplora (studente) e /scuola/esplora
// (referente/tutor). Esclude sempre le istituzioni tipo=formazione_docenti
// (offrono formazione ai docenti, non percorsi post-diploma: fuori
// contesto per entrambe le superfici che la usano) e quelle non attive
// (RLS lo garantirebbe comunque, il filtro esplicito evita solo una query
// inutile). Ranking: fino a 3 enti con un evento in evidenza attivo
// (pertinente ai filtri) in testa, sempre con badge — poi ordine organico
// per pertinenza aree, eventi in programma, follower.
export async function cercaEnti(
  supabase: SupabaseClient,
  filtri: FiltriEsplora,
  areeSuggeriteStudente: string[] = [],
): Promise<EnteEsplora[]> {
  try {
    let query = supabase
      .from("istituzioni")
      .select("id, nome, slug, tipo, immagine_copertina_url, provincia")
      .eq("stato", "attiva")
      .neq("tipo", "formazione_docenti");

    if (filtri.query?.trim()) {
      query = query.or(`nome.ilike.%${filtri.query.trim()}%,descrizione.ilike.%${filtri.query.trim()}%`);
    }
    if (filtri.tipo) query = query.eq("tipo", filtri.tipo);
    if (filtri.provincia?.trim()) query = query.ilike("provincia", `%${filtri.provincia.trim()}%`);

    const { data: istituzioni, error } = await query;
    if (error || !istituzioni || istituzioni.length === 0) return [];

    const idIstituzioni = istituzioni.map((i) => i.id);

    const { data: righeAree } = await supabase
      .from("istituzioni_aree")
      .select("istituzione_id, area_slug")
      .in("istituzione_id", idIstituzioni)
      .eq("stato", "approvata");
    const areePerIstituzione = new Map<string, string[]>();
    for (const r of righeAree ?? []) {
      areePerIstituzione.set(r.istituzione_id, [...(areePerIstituzione.get(r.istituzione_id) ?? []), r.area_slug]);
    }

    const { data: righeEventi } = await supabase
      .from("eventi")
      .select("organizzatore_id, in_evidenza")
      .in("organizzatore_id", idIstituzioni)
      .eq("stato", "approvato")
      .eq("pubblico", "studenti")
      .gte("data_inizio", new Date().toISOString());
    const eventiPerIstituzione = new Map<string, number>();
    const evidenzaPerIstituzione = new Set<string>();
    for (const r of righeEventi ?? []) {
      eventiPerIstituzione.set(r.organizzatore_id, (eventiPerIstituzione.get(r.organizzatore_id) ?? 0) + 1);
      if (r.in_evidenza) evidenzaPerIstituzione.add(r.organizzatore_id);
    }

    const follower = await Promise.all(idIstituzioni.map((id) => supabase.rpc("conteggio_follower", { p_istituzione_id: id })));
    const followerPerIstituzione = new Map<string, number>();
    idIstituzioni.forEach((id, idx) => followerPerIstituzione.set(id, typeof follower[idx].data === "number" ? follower[idx].data : 0));

    let risultati: EnteEsplora[] = istituzioni.map((i) => ({
      id: i.id,
      nome: i.nome,
      slug: i.slug,
      tipo: i.tipo,
      immagineCopertinaUrl: i.immagine_copertina_url,
      aree: areePerIstituzione.get(i.id) ?? [],
      follower: followerPerIstituzione.get(i.id) ?? 0,
      prossimiEventi: eventiPerIstituzione.get(i.id) ?? 0,
      inEvidenza: evidenzaPerIstituzione.has(i.id),
    }));

    if (filtri.areaSlug) risultati = risultati.filter((r) => r.aree.includes(filtri.areaSlug as string));
    if (filtri.soloConEventi) risultati = risultati.filter((r) => r.prossimiEventi > 0);

    const areePertinenza = filtri.areaSlug ? [filtri.areaSlug] : areeSuggeriteStudente;
    function pertinenza(r: EnteEsplora): number {
      return r.aree.filter((a) => areePertinenza.includes(a)).length;
    }

    const inEvidenza = risultati
      .filter((r) => r.inEvidenza)
      .sort((a, b) => pertinenza(b) - pertinenza(a) || b.prossimiEventi - a.prossimiEventi)
      .slice(0, MAX_IN_EVIDENZA_IN_TESTA);
    const idInEvidenza = new Set(inEvidenza.map((r) => r.id));

    const organici = risultati
      .filter((r) => !idInEvidenza.has(r.id))
      .sort((a, b) => pertinenza(b) - pertinenza(a) || b.prossimiEventi - a.prossimiEventi || b.follower - a.follower);

    return [...inEvidenza, ...organici];
  } catch {
    return [];
  }
}
