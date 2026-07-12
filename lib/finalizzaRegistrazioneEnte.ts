import type { SupabaseClient, User } from "@supabase/supabase-js";

// Stesso principio di lib/finalizzaRegistrazione.ts (studente/docente), per
// il ruolo istituzione: auto-riparazione se la conferma email non ha
// completato la creazione di istituzioni/profiles/institution_profiles.
export type EsitoFinalizzazioneEnte =
  | { ok: true }
  | { ok: false; motivo: "dati_incompleti" | "slug_non_disponibile" | "sconosciuto" };

export async function finalizzaRegistrazioneEnteSeNecessario(
  supabase: SupabaseClient,
  user: User,
): Promise<EsitoFinalizzazioneEnte> {
  const meta = user.user_metadata as Record<string, unknown>;

  if (meta?.ruolo !== "istituzione") {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const nomeEnte = typeof meta.nome_ente === "string" && meta.nome_ente ? meta.nome_ente : null;
  const slug = typeof meta.slug === "string" && meta.slug ? meta.slug : null;
  const tipo = typeof meta.tipo === "string" && meta.tipo ? meta.tipo : null;
  const referenteNome = typeof meta.referente_nome === "string" && meta.referente_nome ? meta.referente_nome : null;
  const referenteCognome =
    typeof meta.referente_cognome === "string" && meta.referente_cognome ? meta.referente_cognome : null;
  const sitoUfficiale = typeof meta.sito_ufficiale === "string" && meta.sito_ufficiale ? meta.sito_ufficiale : null;

  if (!nomeEnte || !slug || !tipo || !referenteNome || !referenteCognome) {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const { error } = await supabase.rpc("finalize_registration_istituzione", {
    p_nome_ente: nomeEnte,
    p_slug: slug,
    p_tipo: tipo,
    p_referente_nome: referenteNome,
    p_referente_cognome: referenteCognome,
    p_sito_ufficiale: sitoUfficiale,
  });

  if (!error) return { ok: true };

  // Race tra due richieste concorrenti che finalizzano entrambe: il
  // profilo esiste già, non è un fallimento (stesso trattamento del flusso
  // studente/docente).
  if (error.code === "23505") return { ok: true };

  if (error.message.includes("slug")) return { ok: false, motivo: "slug_non_disponibile" };

  return { ok: false, motivo: "sconosciuto" };
}
