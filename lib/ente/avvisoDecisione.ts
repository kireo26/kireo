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
import { getAreaBySlug } from "@/data/aree";

// "area" (31/10): la revoca di un'area di competenza, l'unica decisione di KIREO
// sulle aree da quando l'ente le sceglie da sé (20261123110000).
export type CosaDecisa = "evento" | "newsletter" | "area";

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
  // La revoca di un'area (31/10, testi miei e provvisori): non c'è un «approvato»,
  // c'è solo il tolto, con il suo motivo e cosa succede ai post.
  if (d.cosa === "area") {
    return {
      oggetto: `Area tolta: ${d.titolo}`,
      righe: [
        `KIREO ha tolto l'area «${d.titolo}» dal tuo profilo.`,
        `Il motivo: ${d.nota ?? "—"}`,
        "I tuoi post non compaiono più nella pagina di quell'area; nella tua bacheca restano. Se pensi che sia un errore, scrivici.",
      ],
      link: `${SITE_URL}/ente#aree`,
      bottone: "Apri il profilo",
    };
  }
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

export type EsitoAvviso = "inviata" | "non_partita" | "nessun_destinatario" | "non_dovuta";

/**
 * Rilegge la decisione, manda l'email agli account dell'ente e SCRIVE com'è
 * andata in `avvisi_email_enti` (20261118100000): una riga per ogni decisione,
 * riuscita o no. Il 30/10 un'email non arrivata non si poteva spiegare, perché
 * un invio riuscito non lasciava niente e l'avviso di un invio fallito spariva
 * con la riga della coda. Non lancia mai.
 */
export async function avvisaEnteDellaDecisione(
  cosa: CosaDecisa,
  id: string,
): Promise<{ ok: boolean; inviate: number; esito: EsitoAvviso }> {
  let istituzioneId: string | null = null;
  let statoDecisione: string | null = null;
  let account = 0;
  let inviate = 0;
  let fallite = 0;
  const motivi: string[] = [];
  const messageId: string[] = [];
  let esito: EsitoAvviso = "non_partita";
  try {
    const supabase = createServiceRoleClient();
    const riga =
      cosa === "evento"
        ? await supabase.from("eventi").select("titolo, stato, note_revisione, organizzatore_id").eq("id", id).maybeSingle()
        : cosa === "newsletter"
          ? await supabase.from("newsletter_enti").select("oggetto, stato, nota_revisione, istituzione_id, giorno").eq("id", id).maybeSingle()
          : await supabase.from("istituzioni_aree").select("area_slug, stato, motivo_revoca, revocata_il, istituzione_id").eq("id", id).maybeSingle();
    if (riga.error || !riga.data) throw riga.error ?? new Error("riga non trovata");
    const r = riga.data as Record<string, unknown>;
    statoDecisione = String(r.stato);
    istituzioneId = String(cosa === "evento" ? r.organizzatore_id : r.istituzione_id);
    // Un'area si avvisa solo se è stata REVOCATA: approvarla non è più una decisione.
    const approvata = cosa !== "area" && (statoDecisione === "approvato" || statoDecisione === "approvata");
    const revocata = cosa === "area" && statoDecisione === "rifiutata" && r.revocata_il != null;
    if (cosa === "area" ? !revocata : !approvata && statoDecisione !== "rifiutato" && statoDecisione !== "rifiutata") {
      esito = "non_dovuta";
    } else {
      const d: Decisione = {
        cosa,
        id,
        titolo: cosa === "area" ? (getAreaBySlug(String(r.area_slug))?.nome ?? String(r.area_slug)) : String(cosa === "evento" ? r.titolo : r.oggetto),
        approvata,
        nota: (cosa === "evento" ? r.note_revisione : cosa === "newsletter" ? r.nota_revisione : r.motivo_revoca) as string | null,
        giorno: cosa === "newsletter" ? (r.giorno as string) : null,
      };
      const utenti = await supabase.from("institution_profiles").select("user_id").eq("istituzione_id", istituzioneId);
      if (utenti.error) throw utenti.error;
      account = (utenti.data ?? []).length;
      const t = testoAvvisoDecisione(d);
      const html = htmlAvvisoDecisione(d);
      for (const u of utenti.data ?? []) {
        const { data: utente, error } = await supabase.auth.admin.getUserById(u.user_id as string);
        if (error || !utente?.user?.email) {
          fallite++;
          motivi.push(error ? `account non letto: ${descriviErrore(error)}` : "account senza email");
          continue;
        }
        const invio = await inviaEmail(utente.user.email, t.oggetto, html);
        if (invio.ok) {
          inviate++;
          if (invio.messageId) messageId.push(invio.messageId);
        } else {
          fallite++;
          motivi.push(`Brevo: ${invio.motivo}`);
        }
      }
      esito = account === 0 ? "nessun_destinatario" : fallite > 0 ? "non_partita" : "inviata";
      if (account === 0) motivi.push("l'ente non ha nessun account collegato");
    }
  } catch (e) {
    fallite = Math.max(fallite, 1);
    motivi.push(descriviErrore(e));
    esito = "non_partita";
  }

  if (esito === "non_partita" || esito === "nessun_destinatario") {
    console.error(`[avviso ente] ${cosa} ${id}: ${esito} — ${motivi.join("; ")}`);
    await registraGuasto({ processo: "admin/decisione", specie: "avviso_ente", motivo: `${cosa}: ${esito}`, dettaglio: motivi.join("; ") });
  }
  await scriviEsitoAvviso({ cosa, id, istituzioneId, statoDecisione, esito, account, inviate, fallite, motivi, messageId });
  return { ok: esito === "inviata" || esito === "non_dovuta", inviate, esito };
}

async function scriviEsitoAvviso(a: {
  cosa: CosaDecisa;
  id: string;
  istituzioneId: string | null;
  statoDecisione: string | null;
  esito: EsitoAvviso;
  account: number;
  inviate: number;
  fallite: number;
  motivi: string[];
  messageId: string[];
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("avvisi_email_enti").insert({
      cosa: a.cosa,
      riferimento_id: a.id,
      istituzione_id: a.istituzioneId,
      stato_decisione: a.statoDecisione,
      esito: a.esito,
      account_ente: a.account,
      inviate: a.inviate,
      fallite: a.fallite,
      motivo: a.motivi.length > 0 ? a.motivi.join("; ").slice(0, 1000) : null,
      message_id: a.messageId,
    });
    // Un registro che non si scrive lo dice nel log: l'email intanto è partita (o no) lo stesso.
    if (error) console.error(`[avviso ente] esito non scritto ${a.cosa} ${a.id}:`, descriviErrore(error));
  } catch (e) {
    console.error(`[avviso ente] esito non scritto ${a.cosa} ${a.id}:`, descriviErrore(e));
  }
}
