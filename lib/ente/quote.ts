import type { SupabaseClient } from "@supabase/supabase-js";
import { descriviErrore } from "@/lib/erroreSupabase";

// Gli stati di una comunicazione che hanno usato la quota: approvata (o già
// inviata). Bozza, in approvazione e rifiutata no.
const STATI_CHE_CONTANO = ["approvata", "inviata"];

// Anno accademico settembre-agosto: se oggi è tra settembre e dicembre
// l'anno è iniziato quest'anno solare, altrimenti (gennaio-agosto) è
// iniziato l'anno solare precedente.
export function annoAccademicoCorrente(oggi: Date = new Date()): { inizio: string; fine: string } {
  const anno = oggi.getUTCMonth() >= 8 ? oggi.getUTCFullYear() : oggi.getUTCFullYear() - 1;
  return {
    inizio: new Date(Date.UTC(anno, 8, 1)).toISOString(),
    fine: new Date(Date.UTC(anno + 1, 7, 31, 23, 59, 59)).toISOString(),
  };
}

export type Quote = {
  evidenzaUsate: number;
  evidenzaTotali: number;
  newsletterUsate: number;
  newsletterTotali: number;
  ctaUsate: number;
  ctaTotali: number;
};

// COSA CONTA OGNI RIQUADRO DEL PROFILO (27/10), sull'anno accademico corrente.
// Conta SOLO QUELLO CHE È STATO APPROVATO (Mario, 27/10): una bozza o una
// proposta rifiutata non ha usato niente del piano, e contarla diceva a un ente
// che aveva consumato una cosa che non ha mai avuto.
// - Eventi in evidenza: eventi messi in evidenza (`in_evidenza_dal`)
//   quest'anno. Si mette in evidenza solo un evento approvato, e il limite lo
//   difende anche il database (`metti_in_evidenza_evento`).
// - Newsletter: newsletter approvate (o inviate) create quest'anno.
// - CTA esterne: eventi APPROVATI creati quest'anno con un link esterno. NON
//   conta i clic su quei link.
// - Le «comunicazioni mirate» (piano premium) NON hanno più un riquadro (28/10):
//   erano una funzione del piano che non esisteva — nessun invio, nessun
//   destinatario scritto da nessuna parte — e in produzione non ne era mai
//   stata proposta una (misurato da Mario: 0). Tolte dal form, dal piano e dal
//   listino. La colonna `piani.quota_comunicazioni_kireo` resta, commentata
//   come inutilizzata (20261108100000). Non rimetterle qui finché non esiste
//   l'invio: un contatore di una cosa che non c'è è una promessa.
// ⚠️ La conseguenza di contare solo l'approvato: il form non ferma più un ente
// che ha già proposto più di quanto il piano conceda, finché nessuna proposta è
// approvata. A fermarlo è la revisione dell'admin, che vede il conto.
//
// NON LETTO NON È ZERO: se una delle letture fallisce, `getQuoteEnte` dà
// `null`, e chi mostra le quote lo dice invece di stampare 0/0 (che a un ente
// premium diceva «il tuo piano non comprende niente»).
export async function getQuoteEnte(supabase: SupabaseClient, istituzioneId: string, pianoNome: string): Promise<Quote | null> {
  try {
    const { inizio, fine } = annoAccademicoCorrente();

    const { data: piano, error: errorePiano } = await supabase
      .from("piani")
      .select("quota_eventi_promossi, quota_newsletter, quota_cta_esterne")
      .eq("nome", pianoNome)
      .maybeSingle();

    const [evidenzaRes, ctaRes, newsletterRes] = await Promise.all([
      supabase
        .from("eventi")
        .select("id", { count: "exact", head: true })
        .eq("organizzatore_id", istituzioneId)
        .eq("in_evidenza", true)
        .gte("in_evidenza_dal", inizio)
        .lte("in_evidenza_dal", fine),
      supabase
        .from("eventi")
        .select("id", { count: "exact", head: true })
        .eq("organizzatore_id", istituzioneId)
        .eq("stato", "approvato")
        .not("cta_esterna_url", "is", null)
        .gte("created_at", inizio)
        .lte("created_at", fine),
      supabase
        .from("comunicazioni")
        .select("id", { count: "exact", head: true })
        .eq("istituzione_id", istituzioneId)
        .eq("tipo", "newsletter")
        .in("stato", STATI_CHE_CONTANO)
        .gte("created_at", inizio)
        .lte("created_at", fine),
    ]);

    const errore = errorePiano ?? [evidenzaRes, ctaRes, newsletterRes].find((r) => r.error)?.error;
    if (errore || !piano) {
      console.error("[quote ente]:", descriviErrore(errore ?? "piano non trovato"));
      return null;
    }

    return {
      evidenzaUsate: evidenzaRes.count ?? 0,
      evidenzaTotali: piano.quota_eventi_promossi ?? 0,
      newsletterUsate: newsletterRes.count ?? 0,
      newsletterTotali: piano.quota_newsletter ?? 0,
      ctaUsate: ctaRes.count ?? 0,
      ctaTotali: piano.quota_cta_esterne ?? 0,
    };
  } catch (e) {
    console.error("[quote ente]:", descriviErrore(e));
    return null;
  }
}

// LE QUOTE VISTE DA CHI REVISIONA (Mario, 27/10). Da quando le quote contano
// solo l'approvato, il form non ferma più un ente che ha proposto più di quanto
// il piano conceda: lo ferma la revisione. Allora chi revisiona deve vedere il
// numero — senza, il controllo spostato su di lui gli arriva senza
// l'informazione per esercitarlo. Legge il piano dell'ente e poi le stesse
// quote che vede l'ente (`getQuoteEnte`): un conto solo, non un secondo.
export async function getQuotePerRevisione(supabase: SupabaseClient, istituzioneId: string): Promise<Quote | null> {
  const { data, error } = await supabase.from("istituzioni").select("piani(nome)").eq("id", istituzioneId).maybeSingle();
  const piano = Array.isArray(data?.piani) ? data?.piani[0] : (data?.piani as { nome?: string } | null | undefined);
  if (error || !piano?.nome) {
    console.error("[quote revisione] piano:", descriviErrore(error ?? "piano non trovato"));
    return null;
  }
  return getQuoteEnte(supabase, istituzioneId, piano.nome);
}

export type VoceQuota = "newsletter" | "cta";

// Una riga per la coda: «Già approvate quest'anno: 5 di 5». Testo mio,
// provvisorio. A quota piena lo dice, perché approvare vuol dire superarla.
export function testoQuotaRevisione(quote: Quote | null, voce: VoceQuota): { testo: string; piena: boolean } {
  if (!quote) return { testo: "Non siamo riusciti a leggere quante ne ha già approvate questo ente.", piena: false };
  const [usate, totali] =
    voce === "newsletter" ? [quote.newsletterUsate, quote.newsletterTotali] : [quote.ctaUsate, quote.ctaTotali];
  const piena = usate >= totali;
  return {
    testo: `Già approvate quest'anno accademico: ${usate} di ${totali} previste dal piano.${piena ? " Approvando, la quota si supera." : ""}`,
    piena,
  };
}
