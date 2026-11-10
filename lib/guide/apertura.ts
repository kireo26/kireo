import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { segnalaGuasto } from "@/lib/guasti/registra";
import type { LivelloGuida } from "./config";

// L'APERTURA DI UNA GUIDA DI KIREO LA SCRIVE IL SERVER, E SOLO LUI (10/11).
//
// Il cancello delle guide 2 e 3 apre una guida «già scaricata» senza guardare il
// merito. Fino al 10/11 «già scaricata» era una riga di activity_log scritta dal
// browser, che il client poteva scriversi da sé con il livello che voleva. La
// regola, di Mario: *un registro di attività non è un titolo di accesso.* Il
// fatto sta in `guide_kireo_aperte` (20261211100000), e qui c'è l'unica strada
// che lo scrive: la service role, chiamata dalle due route che servono una guida
// (`/api/guide/<area>/<livello>` dopo il cancello, `/api/scarica-guida/area`).
//
// La funzione scrive anche la riga del conteggio in activity_log (il radar), con
// il peso del livello: activity_log resta un conteggio, e non lo legge più
// nessuno per decidere.
//
// Restituisce se la scrittura è riuscita. Un fallimento non ferma il file (la
// guida l'ha già guadagnata: il cancello è passato prima), ma lascia un guasto:
// senza la riga la guida dopo resterebbe chiusa, ed è una cosa che vogliamo
// sapere.
export async function registraAperturaGuida(
  processo: string,
  studentId: string,
  areaSlug: string,
  livello: LivelloGuida,
): Promise<boolean> {
  try {
    const { error } = await createServiceRoleClient().rpc("registra_apertura_guida_kireo", {
      p_student: studentId,
      p_area: areaSlug,
      p_livello: livello,
    });
    if (!error) return true;
    await segnalaGuasto(
      { processo, specie: "traccia_guida", motivo: "apertura_guida", dettaglio: error },
      `Errore [${processo}]: l'apertura della guida ${areaSlug}/${livello} non è stata scritta —`,
    );
    return false;
  } catch (errore) {
    await segnalaGuasto(
      { processo, specie: "traccia_guida", motivo: "apertura_guida", dettaglio: errore },
      `Errore [${processo}]: l'apertura della guida ${areaSlug}/${livello} non è stata scritta —`,
    );
    return false;
  }
}
