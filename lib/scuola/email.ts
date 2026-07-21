import type { SupabaseClient } from "@supabase/supabase-js";

// Mappa user_id -> email per studenti della scuola del chiamante, tramite
// la funzione SECURITY DEFINER email_studenti_scuola: auth.users non è mai
// leggibile direttamente da un client. Il nome di uno studente è
// autodichiarato e può risultare vuoto (caso reale in produzione),
// l'email è il secondo identificatore che permette al referente/tutor di
// distinguere le righe.
export async function getEmailStudenti(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("email_studenti_scuola", { p_user_ids: userIds });
  if (error) {
    console.error("[lib/scuola/email.ts:getEmailStudenti] errore RPC email_studenti_scuola:", error);
    return new Map();
  }

  return new Map((data ?? []).map((riga: { user_id: string; email: string }) => [riga.user_id, riga.email]));
}
