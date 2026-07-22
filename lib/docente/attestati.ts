import type { SupabaseClient } from "@supabase/supabase-js";

export type AttestatoDocente = {
  id: string;
  rilasciatoIl: string;
  titoloWebinar: string;
  filone: string;
  dataEvento: string;
  organizzatoreNome: string | null;
};

// Solo i propri attestati (RLS attestati_select_own): nessun embed
// ambiguo, attestati ha una sola FK verso profiles (user_id) e una sola
// verso eventi (evento_id), ma l'hint resta comunque esplicito per
// coerenza con la lezione sugli embed PostgREST già imparata altrove.
export async function getAttestatiDocente(supabase: SupabaseClient, userId: string): Promise<AttestatoDocente[]> {
  try {
    const { data, error } = await supabase
      .from("attestati")
      .select("id, rilasciato_il, eventi!evento_id(titolo, filone, data_inizio, istituzioni(nome))")
      .eq("user_id", userId)
      .order("rilasciato_il", { ascending: false });
    if (error) return [];

    return (data ?? []).map((riga) => {
      const evento = Array.isArray(riga.eventi) ? riga.eventi[0] : riga.eventi;
      const org = evento?.istituzioni as { nome: string } | { nome: string }[] | null | undefined;
      const organizzatore = Array.isArray(org) ? org[0] : org;
      return {
        id: riga.id,
        rilasciatoIl: riga.rilasciato_il,
        titoloWebinar: evento?.titolo ?? "Webinar",
        filone: evento?.filone ?? "",
        dataEvento: evento?.data_inizio ?? "",
        organizzatoreNome: organizzatore?.nome ?? null,
      };
    });
  } catch {
    return [];
  }
}
