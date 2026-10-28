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
// facoltative «solo agli utenti maggiorenni». Dal 20261107110000 un sì vale
// solo se dato da maggiorenni (consenso_dato_da_maggiorenne): al compimento dei
// 18 anni si chiede, non si eredita. Il database rifiuta un sì da chi non lo è
// (`consenso_solo_maggiorenni`); qui la regola serve solo a non mostrare una
// domanda a cui non si può rispondere sì.

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

// Lo specchio di consenso_dato_da_maggiorenne (20261107110000): un sì vale
// solo se, nel momento in cui è stato dato, chi l'ha dato aveva 18 anni. Il
// database ha la sua copia e decide; questa serve dove il database guarderebbe
// l'istante sbagliato — la registrazione finalizzata giorni dopo la risposta,
// quando `now()` direbbe «maggiorenne» di una risposta data a diciassette anni.
export function consensoDatoDaMaggiorenne(quando: string | Date, dataNascita: string | null | undefined): boolean {
  if (!dataNascita) return false;
  const nascita = new Date(`${dataNascita.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(nascita.getTime())) return false;
  const diciotto = new Date(nascita);
  diciotto.setUTCFullYear(diciotto.getUTCFullYear() + 18);
  return new Date(quando).getTime() >= diciotto.getTime();
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

// Una regola nostra, non un limite della persona (Mario, 28/10): «non puoi
// ricevere» descriverebbe chi legge, che non ha fatto niente di sbagliato.
export const TESTO_SOLO_MAGGIORENNI = "KIREO non invia comunicazioni facoltative a chi ha meno di 18 anni.";

// La pagina di un ente, al posto del bottone, quando l'età la sappiamo e non
// basta: uno non si iscrive a una cosa che non riceverà (Mario, 28/10). Detto
// PRIMA del clic, non in una conferma. Testo mio, provvisorio.
export const TESTO_NEWSLETTER_SOLO_MAGGIORENNI =
  "KIREO non invia le newsletter degli enti a chi ha meno di 18 anni: da quel giorno potrai iscriverti da qui.";
