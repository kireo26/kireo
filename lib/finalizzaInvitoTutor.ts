import type { SupabaseClient, User } from "@supabase/supabase-js";

// Stesso principio di finalizzaRegistrazioneScuola, per il ruolo tutor
// invitato via codice (crea_invito_tutor/riscatta_invito_tutor). Dal 01/11 il
// riscatto conta i codici sbagliati per account e risponde un esito invece di
// sollevare: un raise annullerebbe anche la riga del tentativo (20261201100000).
export type EsitoFinalizzazioneTutor =
  | { ok: true }
  | { ok: false; motivo: "dati_incompleti" | "codice_non_valido" | "troppi_tentativi" | "sconosciuto" };

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

  const { data, error } = await supabase.rpc("riscatta_invito_tutor", {
    p_codice: codiceInvito,
    p_nome: nome,
    p_cognome: cognome,
  });

  if (!error) {
    const esito = (data as { esito?: unknown } | null)?.esito;
    if (esito === "riscattato" || esito === "gia_finalizzato") return { ok: true };
    if (esito === "codice_non_valido") return { ok: false, motivo: "codice_non_valido" };
    if (esito === "troppi_tentativi") return { ok: false, motivo: "troppi_tentativi" };
    return { ok: false, motivo: "sconosciuto" };
  }

  if (error.code === "23505") {
    const { data: profiloEsistente } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profiloEsistente) return { ok: true };
  }

  return { ok: false, motivo: "sconosciuto" };
}
