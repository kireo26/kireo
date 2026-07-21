import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finalizzaRegistrazioneScuolaSeNecessario } from "@/lib/finalizzaRegistrazioneScuola";
import { finalizzaInvitoTutorSeNecessario } from "@/lib/finalizzaInvitoTutor";

export type ScuolaContext = {
  userId: string;
  nome: string;
  cognome: string;
  ruoloStaff: "referente" | "tutor";
  scuolaProfiloId: string;
  scuolaId: string;
  nomeScuola: string;
  stato: string;
  // Il referente ha sempre tutti e 4 true (governato lato DB da
  // current_ha_permesso_staff); per un tutor riflettono i flag delegabili
  // di school_staff. Gestione staff e stato scuola non sono mai delegabili
  // e non hanno un flag: restano dietro richiedeReferente().
  puoVerificareStudenti: boolean;
  puoGestireClassi: boolean;
  puoCertificarePresenze: boolean;
  puoInviareComunicazioni: boolean;
};

// Stesso principio di lib/ente/context.ts (cache() di React: layout e
// pagina condividono lo stesso risultato nella stessa richiesta),
// applicato ai ruoli referente_scuola/tutor_scuola. A differenza dell'ente,
// qui due percorsi di auto-riparazione diversi sono possibili (referente
// che si registra da solo, tutor che riscatta un invito) a seconda di cosa
// dicono i metadata dell'utente.
export const getScuolaContext = cache(async (): Promise<ScuolaContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profiloEsistente } = await supabase.from("profiles").select("ruolo, nome, cognome").eq("id", user.id).maybeSingle();

  if (!profiloEsistente) {
    const meta = user.user_metadata as Record<string, unknown>;
    const esito =
      meta?.ruolo === "tutor_scuola"
        ? await finalizzaInvitoTutorSeNecessario(supabase, user)
        : await finalizzaRegistrazioneScuolaSeNecessario(supabase, user);

    if (!esito.ok) {
      redirect(`/per-le-scuole?errore=scuola_${esito.motivo}#richiedi-accesso`);
    }
  } else if (profiloEsistente.ruolo !== "referente_scuola" && profiloEsistente.ruolo !== "tutor_scuola") {
    redirect("/dopo-accesso");
  }

  const { data: staff } = await supabase
    .from("school_staff")
    .select(
      "ruolo_staff, scuola_profilo_id, puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni",
    )
    .eq("user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  if (!staff) {
    redirect("/per-le-scuole?errore=scuola_dati_incompleti#richiedi-accesso");
  }

  const ruoloStaff = staff.ruolo_staff as "referente" | "tutor";
  const eReferente = ruoloStaff === "referente";

  const { data: scuolaProfilo } = await supabase
    .from("scuole_profili")
    .select("scuola_id, stato")
    .eq("id", staff.scuola_profilo_id)
    .maybeSingle();

  const { data: scuola } = scuolaProfilo?.scuola_id
    ? await supabase.from("schools").select("denominazione").eq("codice_meccanografico", scuolaProfilo.scuola_id).maybeSingle()
    : { data: null };

  const meta = user.user_metadata as Record<string, unknown>;
  const nome = profiloEsistente?.nome ?? (typeof meta.nome === "string" ? meta.nome : "");
  const cognome = profiloEsistente?.cognome ?? (typeof meta.cognome === "string" ? meta.cognome : "");

  return {
    userId: user.id,
    nome,
    cognome,
    ruoloStaff,
    scuolaProfiloId: staff.scuola_profilo_id,
    scuolaId: scuolaProfilo?.scuola_id ?? "",
    nomeScuola: scuola?.denominazione ?? "",
    stato: scuolaProfilo?.stato ?? "richiesta",
    puoVerificareStudenti: eReferente || Boolean(staff.puo_verificare_studenti),
    puoGestireClassi: eReferente || Boolean(staff.puo_gestire_classi),
    puoCertificarePresenze: eReferente || Boolean(staff.puo_certificare_presenze),
    puoInviareComunicazioni: eReferente || Boolean(staff.puo_inviare_comunicazioni),
  };
});

// Guardia per le pagine riservate al solo referente e MAI delegabili
// (Staff, attivazione): un tutor che tentasse l'URL diretto torna alla
// home /scuola invece di vedere un errore. Le pagine il cui accesso è
// delegabile (Studenti, Classi, Eventi, Comunicazioni) NON usano questa
// guardia — restano navigabili da qualunque staff attivo, con le sole
// azioni scritte gated dai 4 flag puo_* (niente pagine che respingono in
// silenzio, vedi CLAUDE.md).
export function richiedeReferente(contesto: ScuolaContext) {
  if (contesto.ruoloStaff !== "referente") {
    redirect("/scuola");
  }
}
