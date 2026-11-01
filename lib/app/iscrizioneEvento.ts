// Iscriversi e annullare l'iscrizione a un evento, dal client. Una copia sola
// per i due bottoni (studente `IscrivitiEventoButton`, docente
// `IscrivitiWebinarButton`), che prima avevano la stessa scrittura ricopiata e
// lo stesso «Riprova fra un momento» su ogni rifiuto.

import { descriviErrore } from "@/lib/erroreSupabase";
import { sessioneAncoraViva } from "@/lib/rifiutiScrittura";
import {
  iscrizioneGiaPresente,
  testoErroreAnnullaIscrizione,
  testoErroreIscrizione,
  TESTO_ISCRIZIONE_CERTIFICATA,
} from "@/lib/app/rifiutiStudente";

// Il minimo del client Supabase che serve qui: una forma larga, perché la
// costruzione della query la fa la libreria.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

export type EsitoIscrizione = { ok: true } | { ok: false; testo: string };

export async function iscriviAEvento(supabase: Cliente, userId: string, eventoId: string): Promise<EsitoIscrizione> {
  try {
    const { error } = await supabase.from("iscrizioni_eventi").insert({ student_id: userId, evento_id: eventoId });
    if (!error) return { ok: true };
    // Un'iscrizione che c'è già (un'altra finestra) è lo stato voluto.
    if (iscrizioneGiaPresente(error)) return { ok: true };
    console.error("iscriviAEvento: iscrizione non riuscita", descriviErrore(error));
    return { ok: false, testo: testoErroreIscrizione(error, await sessioneAncoraViva(supabase)) };
  } catch (e) {
    console.error("iscriviAEvento: iscrizione non arrivata", descriviErrore(e));
    return { ok: false, testo: testoErroreIscrizione(null, true) };
  }
}

export type EsitoAnnullamento = { annullata: true } | { annullata: false; testo: string };

/**
 * ⚠️ La policy di delete non tocca un'iscrizione già certificata e risponde
 * ZERO righe senza errore (il modo 11): prima il bottone diceva «Iscriviti»
 * a chi era ancora iscritto e certificato. Quindi si contano le righe, e a
 * zero si rilegge la riga per dire il perché.
 */
export async function annullaIscrizione(supabase: Cliente, userId: string, eventoId: string): Promise<EsitoAnnullamento> {
  try {
    const { data, error } = await supabase
      .from("iscrizioni_eventi")
      .delete()
      .eq("student_id", userId)
      .eq("evento_id", eventoId)
      .select("evento_id");
    if (error) {
      console.error("annullaIscrizione: non riuscita", descriviErrore(error));
      return { annullata: false, testo: testoErroreAnnullaIscrizione(error, await sessioneAncoraViva(supabase)) };
    }
    if ((data ?? []).length > 0) return { annullata: true };

    const { data: riga, error: erroreRiga } = await supabase
      .from("iscrizioni_eventi")
      .select("certificata_da_tipo")
      .eq("student_id", userId)
      .eq("evento_id", eventoId)
      .maybeSingle();
    if (erroreRiga) {
      console.error("annullaIscrizione: rilettura non riuscita", descriviErrore(erroreRiga));
      return { annullata: false, testo: testoErroreAnnullaIscrizione(erroreRiga, await sessioneAncoraViva(supabase)) };
    }
    // Nessuna riga: era già annullata (un'altra finestra). Lo stato voluto.
    if (!riga) return { annullata: true };
    if (riga.certificata_da_tipo) return { annullata: false, testo: TESTO_ISCRIZIONE_CERTIFICATA };
    return { annullata: false, testo: testoErroreAnnullaIscrizione({ code: "zero_righe" }, await sessioneAncoraViva(supabase)) };
  } catch (e) {
    console.error("annullaIscrizione: non arrivata", descriviErrore(e));
    return { annullata: false, testo: testoErroreAnnullaIscrizione(null, true) };
  }
}
