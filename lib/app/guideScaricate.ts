// L'archivio delle guide degli enti che uno studente ha scaricato (29/10,
// 20261116100000). «L'ente fa quello che vuole con i suoi file. Il gesto dello
// studente resta» (Mario): la riga dice il titolo e l'ente di quel momento,
// anche se la guida è stata sostituita o cancellata, e il file si offre solo
// se c'è ancora — mai un link rotto.
//
// ⚠️ «Apri» porta al file e basta: riaprire una guida dall'archivio non è un
// secondo scaricamento, e non lo conta nessuno.

import { formattaData } from "@/lib/formato";

export type StatoGuidaScaricata = "pubblica" | "archiviata" | "cancellata";

export type GuidaScaricata = {
  guidaId: string;
  titolo: string;
  enteNome: string;
  scaricataIl: string;
  stato: StatoGuidaScaricata;
  /** null quando la guida non c'è più: allora il file non si offre. */
  pdfUrl: string | null;
};

type Rpc = {
  rpc: (fn: "guide_enti_scaricate") => PromiseLike<{ data: unknown; error: unknown }>;
};

const STATI: readonly string[] = ["pubblica", "archiviata", "cancellata"];

/**
 * Le righe di chi chiede. `null` vuol dire NON LETTO (errore, o una riga che
 * non ha la forma attesa): non è «non hai scaricato niente», e la pagina lo
 * dice in un altro modo.
 */
export async function leggiGuideScaricate(supabase: Rpc): Promise<GuidaScaricata[] | null> {
  try {
    const { data, error } = await supabase.rpc("guide_enti_scaricate");
    if (error || !Array.isArray(data)) return null;
    const righe: GuidaScaricata[] = [];
    for (const r of data as Record<string, unknown>[]) {
      if (
        typeof r?.guida_id !== "string" || typeof r.titolo !== "string" || typeof r.ente_nome !== "string" ||
        typeof r.scaricata_il !== "string" || typeof r.stato !== "string" || !STATI.includes(r.stato)
      ) {
        return null;
      }
      const stato = r.stato as StatoGuidaScaricata;
      righe.push({
        guidaId: r.guida_id,
        titolo: r.titolo,
        enteNome: r.ente_nome,
        scaricataIl: r.scaricata_il,
        stato,
        // Una guida cancellata non ha un file da offrire, qualunque cosa arrivi.
        pdfUrl: stato !== "cancellata" && typeof r.pdf_url === "string" && r.pdf_url ? r.pdf_url : null,
      });
    }
    return righe;
  } catch {
    return null;
  }
}

// Testi miei e provvisori (29/10), da rileggere.
export const TESTI_GUIDE_SCARICATE = {
  titoloKireo: "Le guide di KIREO",
  titoloEnti: "Le guide degli enti che hai scaricato",
  nonLetto: "Non siamo riusciti a leggere le guide che hai scaricato: ricarica la pagina.",
  nessuna: "Non hai ancora scaricato nessuna guida di un ente. Le trovi sulle pagine degli enti.",
  apri: "Apri",
  riga: (g: GuidaScaricata) => `${g.enteNome} · scaricata il ${formattaData(g.scaricataIl, "long")}`,
  /** Cosa è successo alla guida dopo, o null se è ancora quella pubblica. */
  stato: (g: GuidaScaricata): string | null =>
    g.stato === "cancellata"
      ? "Il file non è più disponibile: l'ente ha tolto questa guida."
      : g.stato === "archiviata"
        ? "Non è più la guida pubblica dell'ente: questa è quella che hai scaricato tu."
        : null,
};
