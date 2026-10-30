// L'avviso all'ente sulla decisione di KIREO (30/10): un evento o una
// newsletter approvati o non approvati. Fino al 30/10 l'ente non riceveva
// NIENTE quando un suo evento veniva approvato: lo scopriva riaprendo la
// pagina. Un ente non vive dentro KIREO: guarda la posta.
//
// Due canali, due posti, una decisione: la notifica dentro KIREO la scrive un
// trigger sul cambio di stato (20261117110000, vale da qualunque strada);
// l'email la manda questo file, dopo la decisione, con un testo solo per gli
// eventi e le newsletter. Due copie dello stesso testo divergono.
//
// La decisione si RILEGGE dal database (stato e nota), non si prende da chi
// chiama: l'email dice quello che è successo, non quello che qualcuno ha detto
// che è successo.

import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { templateAvvisoDecisione } from "@/lib/email/templates";
import { inviaEmail } from "@/lib/email/brevo";
import { registraGuasto } from "@/lib/guasti/registra";
import { SITE_URL } from "@/lib/site";
import { formattaData } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

export type CosaDecisa = "evento" | "newsletter";

export type Decisione = {
  cosa: CosaDecisa;
  id: string;
  titolo: string;
  approvata: boolean;
  nota: string | null;
  /** Solo per la newsletter: il giorno in cui parte. */
  giorno?: string | null;
};

// Testi miei e provvisori (30/10), da rileggere.
export function testoAvvisoDecisione(d: Decisione): { oggetto: string; righe: string[]; link: string; bottone: string } {
  const nome = d.cosa === "evento" ? "il tuo evento" : "la tua newsletter";
  const link =
    d.cosa === "evento" ? `${SITE_URL}/diretta/${d.id}` : `${SITE_URL}/ente/comunicazioni#newsletter-${d.id}`;
  if (d.approvata) {
    const righe = [`KIREO ha approvato ${nome} «${d.titolo}».`];
    if (d.cosa === "newsletter" && d.giorno) {
      righe.push(`Non devi fare più niente: parte il ${formattaData(d.giorno, "long")} alle 7:30.`);
    } else if (d.cosa === "evento") {
      righe.push("Da adesso gli studenti lo vedono.");
    }
    if (d.nota) righe.push(`Nota di revisione: ${d.nota}`);
    return { oggetto: `Approvato: ${d.titolo}`, righe, link, bottone: d.cosa === "evento" ? "Apri l'evento" : "Apri la newsletter" };
  }
  return {
    oggetto: `Da correggere: ${d.titolo}`,
    righe: [
      `KIREO non ha approvato ${nome} «${d.titolo}».`,
      `Il motivo: ${d.nota ?? "—"}`,
      d.cosa === "newsletter"
        ? "Puoi correggere il testo e rimandarla in approvazione; il giorno che avevi scelto intanto si è liberato."
        : "Puoi correggerlo e proporlo di nuovo.",
    ],
    link,
    bottone: "Apri e correggi",
  };
}

export function htmlAvvisoDecisione(d: Decisione): string {
  const t = testoAvvisoDecisione(d);
  return templateAvvisoDecisione({ righe: t.righe, bottone: t.bottone, link: t.link });
}

/** Rilegge la decisione e manda l'email agli account dell'ente. Non lancia mai. */
export async function avvisaEnteDellaDecisione(cosa: CosaDecisa, id: string): Promise<{ ok: boolean; inviate: number }> {
  try {
    const supabase = createServiceRoleClient();
    const riga =
      cosa === "evento"
        ? await supabase.from("eventi").select("titolo, stato, note_revisione, organizzatore_id").eq("id", id).maybeSingle()
        : await supabase.from("newsletter_enti").select("oggetto, stato, nota_revisione, istituzione_id, giorno").eq("id", id).maybeSingle();
    if (riga.error || !riga.data) throw riga.error ?? new Error("riga non trovata");
    const r = riga.data as Record<string, unknown>;
    const stato = String(r.stato);
    const approvata = stato === "approvato" || stato === "approvata";
    if (!approvata && stato !== "rifiutato" && stato !== "rifiutata") return { ok: true, inviate: 0 };
    const istituzioneId = String(cosa === "evento" ? r.organizzatore_id : r.istituzione_id);
    const d: Decisione = {
      cosa,
      id,
      titolo: String(cosa === "evento" ? r.titolo : r.oggetto),
      approvata,
      nota: (cosa === "evento" ? r.note_revisione : r.nota_revisione) as string | null,
      giorno: cosa === "newsletter" ? (r.giorno as string) : null,
    };

    const utenti = await supabase.from("institution_profiles").select("user_id").eq("istituzione_id", istituzioneId);
    if (utenti.error) throw utenti.error;
    const t = testoAvvisoDecisione(d);
    const html = htmlAvvisoDecisione(d);
    let inviate = 0;
    let fallite = 0;
    for (const u of utenti.data ?? []) {
      const { data: utente, error } = await supabase.auth.admin.getUserById(u.user_id as string);
      if (error || !utente?.user?.email) {
        fallite++;
        continue;
      }
      const esito = await inviaEmail(utente.user.email, t.oggetto, html);
      if (esito.ok) inviate++;
      else fallite++;
    }
    if (fallite > 0) {
      console.error(`[avviso ente] ${cosa} ${id}: ${fallite} email non partite`);
      await registraGuasto({ processo: "admin/decisione", specie: "avviso_ente", motivo: `${cosa}: ${fallite} non partite` });
    }
    return { ok: fallite === 0, inviate };
  } catch (e) {
    console.error(`[avviso ente] ${cosa} ${id}:`, descriviErrore(e));
    await registraGuasto({ processo: "admin/decisione", specie: "avviso_ente", motivo: cosa, dettaglio: e });
    return { ok: false, inviate: 0 };
  }
}
