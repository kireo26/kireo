import type { SupabaseClient } from "@supabase/supabase-js";
import { descriviErrore } from "@/lib/erroreSupabase";

// IL CONSENSO ALLE COMUNICAZIONI DI KIREO (profiles.comunicazioni_kireo,
// migrazione 20261107100000). Soltanto di KIREO: le newsletter degli enti hanno
// un'iscrizione loro, una per ente, e questo consenso non iscrive a niente.
//
// Tre stati: true, false, null (mai chiesto — un account di prima della
// casella). null non vale come sì.
//
// ⚠️ Non è un permesso di invio: l'informativa promette le comunicazioni
// facoltative «solo agli utenti maggiorenni», quindi il giorno in cui esisterà
// un invio guarderà anche l'età. Scritto anche nella migrazione.

export type ConsensoKireo = boolean | null;
export type OrigineConsenso = "registrazione" | "profilo" | "disiscrizione";

// Restituisce il valore RILETTO dal database, o `undefined` se la scrittura
// non è riuscita («non scritto» non si scrive come «no»).
export async function impostaComunicazioniKireo(
  supabase: SupabaseClient,
  consenso: boolean,
  origine: OrigineConsenso,
): Promise<ConsensoKireo | undefined> {
  const { data, error } = await supabase.rpc("imposta_comunicazioni_kireo", { p_consenso: consenso, p_origine: origine });
  if (error) {
    console.error(`Consenso comunicazioni KIREO (${origine}):`, descriviErrore(error));
    return undefined;
  }
  return typeof data === "boolean" ? data : null;
}

// Testi (miei e provvisori, da rileggere con Mario). Finché KIREO non manda
// nessuna comunicazione facoltativa, il testo dice a cosa serve il consenso e
// non promette niente di più.
export const TESTO_CASELLA_REGISTRAZIONE = "Voglio ricevere le comunicazioni di KIREO sulle attività di orientamento";
export const TESTO_A_COSA_SERVE =
  "Vale per le comunicazioni di KIREO, non per le newsletter degli enti: a quelle ti iscrivi una per una, dalla pagina di ogni ente.";

export function testoStatoConsenso(consenso: ConsensoKireo): string {
  if (consenso === true) return "Hai detto sì alle comunicazioni di KIREO.";
  if (consenso === false) return "Hai detto no alle comunicazioni di KIREO.";
  return "Non ci hai ancora detto se vuoi ricevere le comunicazioni di KIREO.";
}

export const TESTO_SOLO_MAGGIORENNI =
  "Le comunicazioni facoltative si mandano solo dai 18 anni: fino ad allora la tua scelta resta registrata e non ricevi niente.";
