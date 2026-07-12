import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreaBySlug } from "@/data/aree";
import type { TipoAttivita } from "./activityLog";

export type VoceStorico = {
  id: string;
  tipo: "attivita" | "evento";
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

type RigaIscrizioneEvento = {
  created_at: string;
  eventi: { id: string; titolo: string; data_inizio: string } | { id: string; titolo: string; data_inizio: string }[] | null;
};

// Storico unico per "Le mie attività": attività scolastiche certificate
// (student_activities, già in produzione) + eventi a cui ci si è iscritti
// (iscrizioni_eventi/eventi — se le tabelle non esistono ancora quella
// parte resta vuota senza far fallire il resto).
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

  let vociEventi: VoceStorico[] = [];
  try {
    const { data: iscrizioni, error } = await supabase
      .from("iscrizioni_eventi")
      .select("created_at, eventi(id, titolo, data_inizio)")
      .eq("student_id", userId);

    if (!error) {
      vociEventi = ((iscrizioni ?? []) as RigaIscrizioneEvento[]).map((riga) => {
        const rel = Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi;
        return {
          id: `evento-${rel?.id ?? riga.created_at}`,
          tipo: "evento" as const,
          titolo: rel?.titolo ?? "Evento",
          data: rel?.data_inizio ?? riga.created_at,
          oreCertificate: null,
        };
      });
    }
  } catch {
    vociEventi = [];
  }

  return [...vociAttivita, ...vociEventi].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

export type VoceEsplorazione = { id: string; testo: string; data: string };

const ETICHETTE_TIPO: Record<TipoAttivita, (areaNome: string) => string> = {
  visita_area: (a) => `Hai visitato l'area ${a}`,
  lettura_articolo: (a) => `Hai letto un articolo su ${a}`,
  chat_assistente: (a) => `Hai aperto l'assistente digitale di ${a}`,
  download_guida: (a) => `Hai scaricato la guida di ${a}`,
  iscrizione_webinar: (a) => `Ti sei iscritto a un evento di ${a}`,
  partecipazione_webinar: (a) => `Hai partecipato a un evento di ${a}`,
  workshop_pcto: (a) => `Hai completato un workshop PCTO di ${a}`,
};

// Percorso di esplorazione leggibile (non tecnico) da activity_log, più
// recenti prima.
export async function getPercorsoEsplorazione(supabase: SupabaseClient, userId: string, limite = 10): Promise<VoceEsplorazione[]> {
  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("id, area_slug, tipo_attivita, created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) return [];

    return (data ?? []).map((riga) => {
      const area = getAreaBySlug(riga.area_slug);
      const testo = ETICHETTE_TIPO[riga.tipo_attivita as TipoAttivita]?.(area?.nome ?? riga.area_slug) ?? "Attività registrata";
      return { id: riga.id, testo, data: riga.created_at };
    });
  } catch {
    return [];
  }
}

export type SuggerimentoAttivita = { areaSlug: string; areaNome: string; azione: string; href: string; fatto: boolean };

// 3 attività suggerite per ciascuna area scelta (leggi la guida, fai una
// domanda all'assistente, iscriviti a un evento), marcate come "fatto" se
// quel tipo di attività risulta già registrato per quell'area (anche una
// sola volta, non solo oggi).
export async function getSuggerimentiPerAree(
  supabase: SupabaseClient,
  userId: string,
  areeSlugs: string[],
): Promise<SuggerimentoAttivita[]> {
  if (areeSlugs.length === 0) return [];

  let fatti = new Set<string>();
  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("area_slug, tipo_attivita")
      .eq("student_id", userId)
      .in("area_slug", areeSlugs);
    if (!error) {
      fatti = new Set((data ?? []).map((r) => `${r.area_slug}:${r.tipo_attivita}`));
    }
  } catch {
    fatti = new Set();
  }

  const suggerimenti: SuggerimentoAttivita[] = [];
  for (const slug of areeSlugs) {
    const area = getAreaBySlug(slug);
    if (!area) continue;
    suggerimenti.push({
      areaSlug: slug,
      areaNome: area.nome,
      azione: "Leggi la guida",
      href: `/aree/${slug}#guida`,
      fatto: fatti.has(`${slug}:download_guida`),
    });
    suggerimenti.push({
      areaSlug: slug,
      areaNome: area.nome,
      azione: "Fai una domanda all'assistente",
      href: `/aree/${slug}#assistente-digitale`,
      fatto: fatti.has(`${slug}:chat_assistente`),
    });
    suggerimenti.push({
      areaSlug: slug,
      areaNome: area.nome,
      azione: "Iscriviti a un evento",
      href: `/aree/${slug}#eventi`,
      fatto: fatti.has(`${slug}:iscrizione_webinar`),
    });
  }
  return suggerimenti;
}
