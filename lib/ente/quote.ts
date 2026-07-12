import type { SupabaseClient } from "@supabase/supabase-js";

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
  webinarUsati: number;
  webinarTotali: number;
  newsletterUsate: number;
  newsletterTotali: number;
  ctaUsate: number;
  ctaTotali: number;
  comunicazioniKireoUsate: number;
  comunicazioniKireoTotali: number;
};

const QUOTE_VUOTE: Quote = {
  webinarUsati: 0,
  webinarTotali: 0,
  newsletterUsate: 0,
  newsletterTotali: 0,
  ctaUsate: 0,
  ctaTotali: 0,
  comunicazioniKireoUsate: 0,
  comunicazioniKireoTotali: 0,
};

// Conta l'utilizzo nell'anno accademico corrente contro i limiti del piano
// attivo. "Webinar" conta tutti gli eventi creati (non solo tipo=webinar):
// il piano non distingue per tipo di evento.
export async function getQuoteEnte(supabase: SupabaseClient, istituzioneId: string, pianoNome: string): Promise<Quote> {
  try {
    const { inizio, fine } = annoAccademicoCorrente();

    const { data: piano } = await supabase
      .from("piani")
      .select("quota_webinar_anno, quota_newsletter, quota_cta_esterne, quota_comunicazioni_kireo")
      .eq("nome", pianoNome)
      .maybeSingle();

    const [eventiRes, ctaRes, newsletterRes, comunicazioniKireoRes] = await Promise.all([
      supabase
        .from("eventi")
        .select("id", { count: "exact", head: true })
        .eq("organizzatore_id", istituzioneId)
        .gte("created_at", inizio)
        .lte("created_at", fine),
      supabase
        .from("eventi")
        .select("id", { count: "exact", head: true })
        .eq("organizzatore_id", istituzioneId)
        .not("cta_esterna_url", "is", null)
        .gte("created_at", inizio)
        .lte("created_at", fine),
      supabase
        .from("comunicazioni")
        .select("id", { count: "exact", head: true })
        .eq("istituzione_id", istituzioneId)
        .eq("tipo", "newsletter")
        .gte("created_at", inizio)
        .lte("created_at", fine),
      supabase
        .from("comunicazioni")
        .select("id", { count: "exact", head: true })
        .eq("istituzione_id", istituzioneId)
        .eq("tipo", "comunicazione_kireo")
        .gte("created_at", inizio)
        .lte("created_at", fine),
    ]);

    return {
      webinarUsati: eventiRes.count ?? 0,
      webinarTotali: piano?.quota_webinar_anno ?? 0,
      newsletterUsate: newsletterRes.count ?? 0,
      newsletterTotali: piano?.quota_newsletter ?? 0,
      ctaUsate: ctaRes.count ?? 0,
      ctaTotali: piano?.quota_cta_esterne ?? 0,
      comunicazioniKireoUsate: comunicazioniKireoRes.count ?? 0,
      comunicazioniKireoTotali: piano?.quota_comunicazioni_kireo ?? 0,
    };
  } catch {
    return QUOTE_VUOTE;
  }
}
