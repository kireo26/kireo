// Il giro dell'invio della newsletter (30/10), separato dalla route perché si
// possa provare con un database e un Brevo finti (`npm run test:newsletter`).
//
// UNA RIGA PER DESTINATARIO, e la ragione: il nostro codice manda una chiamata
// a Brevo per destinatario, quindi un invio è centinaia di cose che possono
// fallire una per una. L'unica forma che regge è che ognuna sappia da sola a
// che punto è: `newsletter_da_inviare` prende al più una consegna per studente
// e la segna «tentata» nella stessa istruzione; qui si manda e si scrive
// l'esito di quella riga. Un giro che si ferma a metà (il tetto di Brevo
// finito, la funzione che scade) lascia le altre «da inviare», e il giro dopo
// riprende da lì: niente parte due volte, e niente si dice inviato se non lo è.
//
// ⚠️ I destinatari li dà SOLO il database, da `newsletter_iscrizioni`. Questo
// file non nomina `comunicazioni`, né niente delle guide: `npm run
// test:newsletter` lo pretende.

import { templateNewsletter } from "@/lib/email/templates";
import type { EsitoInvioEmail, OpzioniInvioEmail } from "@/lib/email/brevo";
import { SITE_URL } from "@/lib/site";

export type Rpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export type InviaEmail = (
  destinatario: string,
  oggetto: string,
  html: string,
  opzioni?: OpzioniInvioEmail,
) => Promise<EsitoInvioEmail>;

type Consegna = {
  consegna_id: string;
  email: string;
  nome: string | null;
  oggetto: string;
  corpo: string;
  ente_nome: string;
  codice_uscita: string;
  newsletter_id: string;
};

export type EsitoGiro = {
  preparate: number | null;
  inviate: number;
  fallite: number;
  /** I passi del database non riusciti: ogni voce è un guasto da registrare. */
  guasti: { passo: string; dettaglio: string }[];
};

export const LOTTO = 100;

export function linkUscita(codice: string): string {
  return `${SITE_URL}/disiscrizione/newsletter/${codice}`;
}

/**
 * Le intestazioni di uscita (RFC 8058). La POST di `List-Unsubscribe-Post` va a
 * una route che toglie l'iscrizione: un filtro antispam che apre i link fa una
 * GET, non una POST, quindi non disiscrive nessuno. ⚠️ Che Brevo le passi non è
 * verificato (vedi `OpzioniInvioEmail.intestazioni`).
 */
export function intestazioniUscita(codice: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${SITE_URL}/api/newsletter/uscita/${codice}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function giroInvio(
  supabase: Rpc,
  invia: InviaEmail,
  oggi: string,
  opzioni: { maxLotti?: number; concorrenza?: number } = {},
): Promise<EsitoGiro> {
  const esito: EsitoGiro = { preparate: null, inviate: 0, fallite: 0, guasti: [] };

  const prep = await supabase.rpc("prepara_newsletter_del_giorno", { p_oggi: oggi });
  if (prep.error) esito.guasti.push({ passo: "prepara", dettaglio: prep.error.message ?? "errore" });
  else esito.preparate = typeof prep.data === "number" ? prep.data : null;

  const concorrenza = opzioni.concorrenza ?? 5;
  for (let lotto = 0; lotto < (opzioni.maxLotti ?? 20); lotto++) {
    const coda = await supabase.rpc("newsletter_da_inviare", { p_oggi: oggi, p_limite: LOTTO });
    if (coda.error) {
      esito.guasti.push({ passo: "coda", dettaglio: coda.error.message ?? "errore" });
      break;
    }
    const righe = (Array.isArray(coda.data) ? coda.data : []) as Consegna[];
    if (righe.length === 0) break;

    for (let i = 0; i < righe.length; i += concorrenza) {
      await Promise.all(
        righe.slice(i, i + concorrenza).map(async (c) => {
          const html = templateNewsletter({
            enteNome: c.ente_nome,
            oggetto: c.oggetto,
            corpo: c.corpo,
            linkLeggi: `${SITE_URL}/app/newsletter/${c.newsletter_id}`,
            linkUscita: linkUscita(c.codice_uscita),
          });
          let r: EsitoInvioEmail;
          try {
            r = await invia(c.email, c.oggetto, html, { nome: c.nome ?? undefined, intestazioni: intestazioniUscita(c.codice_uscita) });
          } catch (e) {
            r = { ok: false, motivo: e instanceof Error ? e.message : "eccezione" };
          }
          if (r.ok) esito.inviate++;
          else esito.fallite++;
          const segno = await supabase.rpc("segna_consegna_newsletter", {
            p_id: c.consegna_id,
            p_ok: r.ok,
            p_motivo: r.ok ? null : r.motivo,
          });
          if (segno.error) esito.guasti.push({ passo: "segna", dettaglio: segno.error.message ?? "errore" });
          if (!r.ok) esito.guasti.push({ passo: "email", dettaglio: r.motivo });
        }),
      );
    }
    if (righe.length < LOTTO) break;
  }
  return esito;
}
