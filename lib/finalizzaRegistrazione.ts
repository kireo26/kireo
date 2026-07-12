import type { SupabaseClient, User } from "@supabase/supabase-js";

// Chiamata condivisa a finalize_registration, usata sia dal link di conferma
// email (app/auth/confirm/route.ts) sia come auto-riparazione al primo
// accesso autenticato (app/app/page.tsx) per il caso in cui la conferma
// email non sia riuscita a completare la creazione del profilo (es. token
// consumato da uno scanner automatico prima del click dell'utente).
export type EsitoFinalizzazione =
  | { ok: true }
  | { ok: false; motivo: "dati_incompleti" | "scuola_non_valida" | "codice_non_valido" | "sconosciuto" };

export async function finalizzaRegistrazioneSeNecessario(
  supabase: SupabaseClient,
  user: User,
): Promise<EsitoFinalizzazione> {
  const meta = user.user_metadata as Record<string, unknown>;
  const ruolo = meta?.ruolo;

  if (ruolo !== "studente" && ruolo !== "docente") {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const nome = typeof meta.nome === "string" && meta.nome ? meta.nome : null;
  const cognome = typeof meta.cognome === "string" && meta.cognome ? meta.cognome : null;
  const dataNascita = typeof meta.data_nascita === "string" && meta.data_nascita ? meta.data_nascita : null;

  if (!nome || !cognome || !dataNascita) {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const schoolCode = typeof meta.school_code === "string" && meta.school_code ? meta.school_code : null;
  const codiceClasse = typeof meta.codice_classe === "string" && meta.codice_classe ? meta.codice_classe : null;

  if (ruolo === "studente") {
    const classe = typeof meta.classe === "string" && meta.classe ? meta.classe : null;
    const annoDiploma = typeof meta.anno_diploma === "number" ? meta.anno_diploma : null;
    const haScuolaManuale = Boolean(schoolCode && classe && annoDiploma);
    if (!codiceClasse && !haScuolaManuale) {
      return { ok: false, motivo: "dati_incompleti" };
    }
  } else if (ruolo === "docente" && !schoolCode) {
    return { ok: false, motivo: "dati_incompleti" };
  }

  const { error } = await supabase.rpc("finalize_registration", {
    p_ruolo: ruolo,
    p_nome: nome,
    p_cognome: cognome,
    p_data_nascita: dataNascita,
    p_school_code: schoolCode,
    p_classe: typeof meta.classe === "string" ? meta.classe : null,
    p_anno_diploma: typeof meta.anno_diploma === "number" ? meta.anno_diploma : null,
    p_materia: typeof meta.materia === "string" ? meta.materia : null,
    p_is_referente: typeof meta.is_referente_orientamento === "boolean" ? meta.is_referente_orientamento : false,
    p_codice_classe: codiceClasse,
  });

  if (!error) {
    return { ok: true };
  }

  // Race condition (es. doppia richiesta concorrente): il profilo esiste
  // già, non è un fallimento.
  if (error.code === "23505") {
    return { ok: true };
  }

  // Foreign key verso schools: il codice meccanografico salvato al momento
  // della registrazione non è (più) valido.
  if (error.code === "23503") {
    return { ok: false, motivo: "scuola_non_valida" };
  }

  if (["codice_non_valido", "codice_non_attivo", "codice_esaurito"].some((m) => error.message.includes(m))) {
    return { ok: false, motivo: "codice_non_valido" };
  }

  return { ok: false, motivo: "sconosciuto" };
}
