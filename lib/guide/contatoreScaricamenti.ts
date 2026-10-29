import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { segnalaGuasto } from "@/lib/guasti/registra";
import { descriviErrore } from "@/lib/erroreSupabase";

// Lo scaricamento di chi non ha fatto l'accesso, contato senza sapere chi è
// (20261115100000). Chi ha fatto l'accesso lo conta `registra_download_guida`;
// per chi no non c'è una sessione con cui chiamarla, e la funzione che
// incrementa non si apre ad `anon` (una definer che scrive non si apre a chi
// non è nessuno: `test:guardie`). Quindi la chiama il server con la
// service-role, e con UN SOLO argomento, l'id della guida, che la funzione
// ricontrolla (guida pubblica, ente attivo): da qui non passa niente scritto
// da chi chiama.
//
// ⚠️ Chi non ha fatto l'accesso può gonfiare il numero ripetendo la POST: è un
// numero di scaricamenti, non di persone, e la pagina dell'ente lo dice.
// Un conteggio che fallisce non ferma il file: si registra il guasto.
export async function contaScaricamentoSenzaAccesso(processo: string, guidaId: string): Promise<void> {
  try {
    const { error } = await createServiceRoleClient().rpc("incrementa_scaricamenti_guida", { p_guida_id: guidaId });
    if (error) throw new Error(descriviErrore(error));
  } catch (errore) {
    await segnalaGuasto(
      { processo, specie: "traccia_guida", motivo: "contatore_non_scritto", dettaglio: errore },
      "Errore [scarica-guida]: lo scaricamento senza accesso non è stato contato —",
    );
  }
}
