import { cache } from "react";
import { getEnteContext } from "@/lib/ente/context";
import { createClient } from "@/lib/supabase/server";
import { descriviErrore } from "@/lib/erroreSupabase";
import { leggiStatistiche, type StatisticheEnte } from "@/lib/ente/statistiche";

// UNA LETTURA SOLA PER L'INDICE E LE QUATTRO SEZIONI (29/10). Tutte e cinque le
// pagine passano da qui, e qui si chiama soltanto `statistiche_ente`: la soglia
// di anonimato e le definizioni dei numeri stanno nella funzione SQL, una volta.
// Una pagina che leggesse le viste o ricalcolasse un numero per conto suo
// scriverebbe le regole in un secondo posto, e il giorno in cui l'indice e la
// sezione non coincidono l'ente lo nota prima di noi.
//
// `null` vuol dire «non letto» (errore, o una forma inattesa): mai zeri.
const leggiDalDatabase = cache(async (istituzioneId: string): Promise<StatisticheEnte | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("statistiche_ente", { p_istituzione_id: istituzioneId });
  if (error) {
    console.error("[statistiche ente] statistiche_ente:", descriviErrore(error));
    return null;
  }
  const stats = leggiStatistiche(data);
  if (!stats) console.error("[statistiche ente] statistiche_ente: forma inattesa");
  return stats;
});

export const caricaStatisticheEnte = cache(async (): Promise<StatisticheEnte | null> => {
  const contesto = await getEnteContext();
  return leggiDalDatabase(contesto.istituzioneId);
});

// LA PAGINA DI UN ENTE NELL'AREA ADMIN (01/11) legge gli stessi numeri che
// l'ente vede, dalla stessa chiamata: `statistiche_ente` risponde all'admin
// per qualunque ente. Chi la chiama controlla prima di essere l'admin
// (`requireAdmin`); la funzione SQL lo ricontrolla.
export async function caricaStatisticheDiUnEnte(istituzioneId: string): Promise<StatisticheEnte | null> {
  return leggiDalDatabase(istituzioneId);
}
