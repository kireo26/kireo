// La lettura degli eventi per le quattro schede dell'admin. Un posto solo,
// come `lib/ente/caricaEventiEnte.ts`: quattro viste della stessa lettura.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreeDegliEventi } from "@/lib/app/eventi";
import { COLONNE_EVENTO_ADMIN, type EventoAdmin } from "@/lib/admin/eventiAdmin";

export async function caricaEventiAdmin(
  supabase: SupabaseClient,
): Promise<{ eventi: EventoAdmin[]; aree: Record<string, string[]>; letturaFallita: boolean }> {
  // Le bozze si tolgono qui (sono di chi le sta scrivendo, non una proposta) e
  // di nuovo in `dividiEventiAdmin`, che è il posto provato.
  const { data, error } = await supabase.from("eventi").select(COLONNE_EVENTO_ADMIN).neq("stato", "bozza");
  // Una lettura fallita non è una coda vuota: «niente da approvare» detto con
  // tre eventi in attesa è la frase che li lascia lì.
  if (error) console.error("[admin/eventi] eventi:", error);
  const eventi = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const ist = Array.isArray(r.istituzioni) ? r.istituzioni[0] : r.istituzioni;
    return { ...r, ente: (ist as { nome?: string } | null)?.nome ?? null } as unknown as EventoAdmin;
  });
  const aree = await getAreeDegliEventi(supabase, eventi.map((e) => e.id));
  return { eventi, aree, letturaFallita: !!error };
}

/** Quanti eventi aspettano una decisione: per il numero accanto a «Da approvare». `null` = non letto. */
export async function contaDaApprovare(supabase: SupabaseClient): Promise<number | null> {
  const { count, error } = await supabase.from("eventi").select("id", { count: "exact", head: true }).eq("stato", "in_approvazione");
  if (error) {
    console.error("[admin/eventi] conteggio da approvare:", error);
    return null;
  }
  return count ?? 0;
}
