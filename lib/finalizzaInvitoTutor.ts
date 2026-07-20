import type { SupabaseClient, User } from "@supabase/supabase-js";

// Stesso principio di finalizzaRegistrazioneScuola, per il ruolo tutor
// invitato via codice (crea_invito_tutor/redeem_invito_staff).
export type EsitoFinalizzazioneTutor =
  | { ok: true }
  | { ok: false; motivo: "dati_incompleti" | "codice_non_valido" | "sconosciuto" };

export async function finalizzaInvitoTutorSeNecessario(
  supabase: SupabaseClient,
  user: User,
): Promise<EsitoFinalizzazioneTutor> {
  const meta = user.user_metadata as Record<string, unknown>;

  if (meta?.ruolo !== "tutor_scuola") {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const codiceInvito = typeof meta.codice_invito === "string" && meta.codice_invito ? meta.codice_invito : null;
  const nome = typeof meta.nome === "string" && meta.nome ? meta.nome : null;
  const cognome = typeof meta.cognome === "string" && meta.cognome ? meta.cognome : null;

  if (!codiceInvito || !nome || !cognome) {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const { error } = await supabase.rpc("redeem_invito_staff", {
    p_codice: codiceInvito,
    p_nome: nome,
    p_cognome: cognome,
  });

  if (!error) return { ok: true };

  if (error.code === "23505") {
    const { data: profiloEsistente } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profiloEsistente) return { ok: true };
  }

  if (error.message.includes("codice_non_valido")) {
    return { ok: false, motivo: "codice_non_valido" };
  }

  return { ok: false, motivo: "sconosciuto" };
}
