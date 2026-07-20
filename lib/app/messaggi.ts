import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessaggioRicevuto } from "@/components/app/MessaggiScuola";

// Non esplode se la migration dell'area scuola non è ancora applicata
// (stesso principio già usato in lib/app/eventi.ts per le tabelle
// preparate ma non ancora attive): un risultato vuoto invece di un errore.
export async function getMessaggiScuolaStudente(supabase: SupabaseClient, userId: string, limite = 10): Promise<MessaggioRicevuto[]> {
  try {
    const { data, error } = await supabase
      .from("messaggi_scuola_destinatari")
      .select("letto_il, messaggi_scuola(id, oggetto, corpo, created_at)")
      .eq("student_id", userId)
      .order("created_at", { ascending: false, referencedTable: "messaggi_scuola" })
      .limit(limite);

    if (error) return [];

    return (data ?? [])
      .map((riga) => {
        const messaggio = Array.isArray(riga.messaggi_scuola) ? riga.messaggi_scuola[0] : riga.messaggi_scuola;
        if (!messaggio) return null;
        return {
          id: messaggio.id,
          oggetto: messaggio.oggetto,
          corpo: messaggio.corpo,
          createdAt: messaggio.created_at,
          lettoIl: riga.letto_il,
        };
      })
      .filter((m): m is MessaggioRicevuto => Boolean(m));
  } catch {
    return [];
  }
}
