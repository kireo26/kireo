// La lettura degli eventi per le quattro schede dell'admin. Un posto solo,
// come `lib/ente/caricaEventiEnte.ts`: quattro viste della stessa lettura.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAreeDegliEventi } from "@/lib/app/eventi";
import { COLONNE_EVENTO_ADMIN, dividiEventiAdmin, type EventoAdmin } from "@/lib/admin/eventiAdmin";

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

/**
 * Il numero accanto a «Da approvare». `null` = non letto, che non è zero.
 *
 * ⚠️ NON È UN `count` SU `stato = 'in_approvazione'`, ed era così fino al 27/10:
 * contava anche le proposte con la data già passata, cioè prometteva un lavoro
 * che in parte non esisteva — sul primo numero che l'admin guarda ogni mattina.
 * Ora esce dalla stessa divisione della scheda (`dividiEventiAdmin`), così il
 * numero e l'elenco non possono dire due cose diverse.
 */
export async function contaDaApprovare(supabase: SupabaseClient): Promise<number | null> {
  const { eventi, letturaFallita } = await caricaEventiAdmin(supabase);
  if (letturaFallita) return null;
  return dividiEventiAdmin(eventi).daApprovare.length;
}
