// Persistenza dei due contatori della guardia sulla lingua invariante.
//
// SEMPRE BEST-EFFORT: qualunque cosa vada storta qui — migrazione non ancora
// applicata, service-role non configurata, rete — viene solo loggata. Un
// contatore che non si scrive non deve mai far fallire (né rallentare in modo
// visibile) il feedback che uno studente sta aspettando.
//
// Perché la service-role e non il client della richiesta: la guardia vive
// dentro `chiamaJson`, che è trasporto e non conosce il contesto di chi la
// chiama — le stesse chiamate arrivano da route con la sessione dello studente
// (finale Escape, consegne workshop) e dal cron, che una sessione non ce l'ha.
// Passare un client attraverso la firma avrebbe costretto tutti e quattro i
// punti di chiamata a occuparsi di un contatore che non li riguarda. Qui si
// scrive solo un aggregato giornaliero: nessun dato di nessuno studente.

import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

// `diProva` è l'unica dimensione che questa riga porta: la tabella non ha (e
// non deve avere) un riferimento allo studente, quindi il flag non può
// arrivare per via transitiva — lo passa il chiamante. Senza, ogni riga
// finisce nel secchio «produzione», che è esattamente com'è andata fino al
// 2026-08-31: la colonna c'era, la chiave primaria pure, e nessuno la
// scriveva. Una separazione non scritta è peggio di una non costruita, perché
// sembra fatta.
export async function registraGuardiaLingua(ancoraAccordato: boolean, diProva = false): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("registra_guardia_lingua", { p_ancora_accordato: ancoraAccordato, p_di_prova: diProva });
    if (error) console.error("Guardia lingua — contatore non scritto:", error.message);
  } catch (errore) {
    console.error("Guardia lingua — contatore non scritto (eccezione):", errore);
  }
}
