// La lettura degli eventi di un ente, per le due liste (in programmazione e
// passati). Un posto solo: le due pagine sono due viste della stessa lettura,
// e due `select` scritte a mano divergono.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreeDegliEventi } from "@/lib/app/eventi";
import { COLONNE_EVENTO_ENTE, type EventoEnte } from "@/lib/ente/eventiEnte";

export async function caricaEventiEnte(
  supabase: SupabaseClient,
  istituzioneId: string,
): Promise<{ eventi: EventoEnte[]; aree: Record<string, string[]>; letturaFallita: boolean }> {
  const { data, error } = await supabase.from("eventi").select(COLONNE_EVENTO_ENTE).eq("organizzatore_id", istituzioneId);
  // Una lettura fallita non è una lista vuota: «non hai ancora eventi» detto a
  // chi ne ha dieci lo manda a crearli di nuovo.
  if (error) console.error("[ente/eventi] eventi:", error);
  const eventi = (data ?? []) as EventoEnte[];
  const aree = await getAreeDegliEventi(supabase, eventi.map((e) => e.id));
  return { eventi, aree, letturaFallita: !!error };
}

/** Per i webinar ai docenti: quante presenze l'ente ha certificato nel registro. `null` = non letto, che non è zero. */
export async function caricaCertificatiDocenti(supabase: SupabaseClient, eventoIds: string[]): Promise<Map<string, number> | null> {
  const conti = new Map<string, number>();
  if (eventoIds.length === 0) return conti;
  const { data, error } = await supabase.from("iscrizioni_eventi").select("evento_id").in("evento_id", eventoIds).eq("stato", "partecipato");
  if (error) {
    console.error("[ente/eventi] presenze docenti:", error);
    return null;
  }
  for (const r of data ?? []) conti.set(r.evento_id, (conti.get(r.evento_id) ?? 0) + 1);
  return conti;
}
