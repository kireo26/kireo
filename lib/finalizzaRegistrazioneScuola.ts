import type { SupabaseClient, User } from "@supabase/supabase-js";

// Stesso principio di lib/finalizzaRegistrazioneEnte.ts: auto-riparazione
// se la conferma email non ha completato la creazione di scuole_profili/
// profiles/school_staff.
export type EsitoFinalizzazioneScuola =
  | { ok: true }
  | { ok: false; motivo: "dati_incompleti" | "sconosciuto" };

export async function finalizzaRegistrazioneScuolaSeNecessario(
  supabase: SupabaseClient,
  user: User,
): Promise<EsitoFinalizzazioneScuola> {
  const meta = user.user_metadata as Record<string, unknown>;

  if (meta?.ruolo !== "referente_scuola") {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const scuolaId = typeof meta.scuola_id === "string" && meta.scuola_id ? meta.scuola_id : null;
  const nome = typeof meta.nome === "string" && meta.nome ? meta.nome : null;
  const cognome = typeof meta.cognome === "string" && meta.cognome ? meta.cognome : null;

  if (!scuolaId || !nome || !cognome) {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const { error } = await supabase.rpc("finalize_registration_scuola", {
    p_scuola_id: scuolaId,
    p_nome: nome,
    p_cognome: cognome,
  });

  if (!error) return { ok: true };

  // Race tra due richieste concorrenti dello stesso utente (link email
  // aperto due volte): se il profilo esiste comunque, non è un fallimento.
  // Se invece la scuola ha già un referente attivo (un'altra persona), il
  // profilo NON esiste e questo è un fallimento reale — verifichiamo prima
  // di dichiarare successo, non ci fidiamo ciecamente del solo codice.
  if (error.code === "23505") {
    const { data: profiloEsistente } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profiloEsistente) return { ok: true };
  }

  return { ok: false, motivo: "sconosciuto" };
}
