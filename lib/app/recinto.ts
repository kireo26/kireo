import type { SupabaseClient } from "@supabase/supabase-js";
import { descriviErrore } from "@/lib/erroreSupabase";

// LA TRACCIA DI UN GESTO DELLO STUDENTE VERSO UN ENTE, in un posto solo (27/10).
//
// `recinto_enti` dice a un ente, in aggregato, quanti studenti l'hanno
// incontrato e da quale gesto. Le scritture erano tre `upsert` ricopiate nei
// bottoni, tutte con lo stesso bersaglio del conflitto: quando il bersaglio è
// cambiato (una riga per ORIGINE, non più per coppia studente-ente:
// 20261102110000), tre copie andavano cambiate insieme. Ora la si cambia qui.
//
// Una riga per studente, ente e origine: una seconda iscrizione alla stessa
// newsletter non aggiunge niente (`ignoreDuplicates`), ma scaricare la guida
// dopo essersi iscritti a un evento sì — fino al 27/10 quel download non
// lasciava traccia, e la pagina dell'ente diceva «Download guida: 0».
//
// Non blocca mai il gesto che la accompagna (il download è già partito,
// l'iscrizione è già fatta), ma un errore non si butta più: si scrive nel log.
export type OrigineRecinto = "guida" | "newsletter" | "evento";

export async function segnaNelRecinto(
  supabase: SupabaseClient,
  studentId: string,
  istituzioneId: string,
  origine: OrigineRecinto,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("recinto_enti")
      .upsert(
        { student_id: studentId, istituzione_id: istituzioneId, origine },
        { onConflict: "student_id,istituzione_id,origine", ignoreDuplicates: true },
      );
    if (error) console.error(`[recinto] ${origine}:`, descriviErrore(error));
  } catch (e) {
    console.error(`[recinto] ${origine}:`, descriviErrore(e));
  }
}
