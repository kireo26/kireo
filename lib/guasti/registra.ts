// I guasti che il codice conosce già, scritti in una tabella nostra.
//
// SEMPRE BEST-EFFORT: qualunque cosa vada storta qui — migrazione non ancora
// applicata, service-role non configurata, rete — viene solo loggata. Un
// guasto che non si riesce a registrare non deve mai far fallire (né
// rallentare in modo visibile) il flusso in cui è successo: sta già andando
// male per conto suo.
//
// Perché la service-role e non il client della richiesta: stesso motivo del
// contatore della guardia sulla lingua (lib/lingua/contatoreGuardia.ts). Le
// chiamate arrivano dal cron, che una sessione non ce l'ha, e da route che
// girano nella sessione dello studente. Far passare un client attraverso la
// firma costringerebbe ogni punto di chiamata a occuparsi di una tabella che
// non lo riguarda.
//
// CONSEGUENZA SUL DATABASE, e va tenuta insieme a questa riga: siccome QUI il
// client è sempre la service-role, `registra_guasto` è concessa a
// `service_role` e a nessun altro. La sessione dello studente esiste nella
// route, non in questa chiamata — sono due cose diverse, e confonderle
// lascerebbe a chiunque sia collegato la possibilità di scrivere righe finte
// nella tabella che serve a sapere cosa si è rotto. Se un giorno servisse un
// chiamante con il client della richiesta, il grant va cambiato di
// conseguenza: `npm run test:grant` diventa rosso finché le due cose non
// tornano a dire la stessa cosa.

import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

// L'ARTEFATTO CHE NON È ARRIVATO, non «è fallita una chiamata».
//
// `revisione_esito` sapeva dire «non riuscita» e non «non riuscita COSA»: per
// quello il guasto del feedback finale è vissuto settimane senza che nessuna
// query potesse vederlo. Una revisione mancante è una tappa da rigiocare, un
// finale mancante è la pagina di chiusura di un intero progetto — si riparano
// in modi diversi, quindi vanno nominati in modi diversi.
//
// L'insieme chiuso sta QUI e non in un CHECK a database, di proposito: ogni
// scrittura è best-effort, quindi un vincolo troppo stretto non produrrebbe un
// errore da leggere ma un guasto che sparisce in silenzio — il difetto che
// questa tabella esiste per chiudere. Qui un nome inventato lo ferma il
// compilatore, e aggiungerne uno non richiede una migrazione.
export type SpecieGuasto =
  // — artefatti del motore workshop
  | "revisione" // la revisione della tappa
  | "feedback_finale" // il feedback complessivo sul progetto
  | "modo_di_lavorare" // il blocco «come hai lavorato» (e i suoi materiali)
  | "reazione_cliente" // la battuta in carattere del cliente
  // — artefatti di Escape
  | "prove_missione" // le prove aperte del revisore della proposta
  | "esito_missione" // la persistenza di prove/esito del tentativo
  // — artefatti del workshop fuori dal cron
  | "feedback_elaborato" // il feedback finale della route consegna (v1)
  | "consegna_progetto" // la scrittura della consegna stessa
  // — scritture del motore: non un testo mancante, una transizione mancata
  | "scrittura_marcatura" // `revisione_esito`/`finale_esito` sulla riga
  | "scrittura_avanzamento" // `avanza_fase_workshop`
  | "scrittura_tentativi" // il contatore che evita il ritentativo infinito
  | "scrittura_notifiche" // le notifiche allo studente
  // — il motore che non parte, o che si rompe fuori dai casi previsti
  | "configurazione" // una chiave o una variabile che manca
  | "lettura_coda" // la lettura che dà da lavorare al cron
  | "eccezione_riga" // il catch attorno a una singola riga
  // — la notifica dei guasti stessi
  | "alert_email"; // l'email di osservabilità non è partita

export type Guasto = {
  /** Quale processo: 'cron/workshop-motore', 'escape/finalizza', … */
  processo: string;
  specie: SpecieGuasto;
  /** Il `motivo` di chiamaJson, o una parola che dice quale passo è caduto. */
  motivo?: string | null;
  /** Il testo dell'errore, quando ce n'è uno da leggere. */
  dettaglio?: unknown;
  iscrizioneId?: string | null;
  faseId?: string | null;
  /** Lo passa il chiamante: mai dedotto qui, che non sa di chi si parla. */
  diProva?: boolean;
};

// Un errore può arrivare come `Error`, come oggetto PostgrestError, o come
// qualunque cosa sia stata lanciata: qui interessa solo che resti leggibile.
function leggibile(dettaglio: unknown): string | null {
  if (dettaglio === undefined || dettaglio === null) return null;
  if (typeof dettaglio === "string") return dettaglio;
  if (dettaglio instanceof Error) return dettaglio.message;
  const m = (dettaglio as { message?: unknown }).message;
  if (typeof m === "string") return m;
  try {
    return JSON.stringify(dettaglio);
  } catch {
    return String(dettaglio);
  }
}

/** Scrive la riga. Non lancia mai. */
export async function registraGuasto(g: Guasto): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("registra_guasto", {
      p_processo: g.processo,
      p_specie: g.specie,
      p_motivo: g.motivo ?? null,
      p_dettaglio: leggibile(g.dettaglio),
      p_iscrizione_id: g.iscrizioneId ?? null,
      p_fase_id: g.faseId ?? null,
      p_di_prova: g.diProva ?? false,
    });
    if (error) console.error("Guasto non registrato:", error.message);
  } catch (errore) {
    console.error("Guasto non registrato (eccezione):", errore);
  }
}

/**
 * Stampa il guasto E lo registra, in un gesto solo.
 *
 * Esiste perché la proprietà che vogliamo tenere è: **nessun guasto che il
 * codice già conosce resta solo in un `console.error`**. Due chiamate separate
 * si dimenticano una alla volta — e si dimenticano proprio nel ramo d'errore,
 * che è quello che nessuno rilegge. `npm run test:motore` pretende che nel
 * motore ogni `console.error` passi da qui, o sia dichiarato diagnostico.
 *
 * La riga stampata comincia comunque per «Errore»/«Alert», che è la
 * convenzione su cui è tarato il filtro di `npm run banco log`: finché quei
 * log si possono leggere, restano leggibili.
 */
export async function segnalaGuasto(g: Guasto, messaggio: string): Promise<void> {
  console.error(messaggio, g.dettaglio === undefined ? "" : g.dettaglio);
  await registraGuasto(g);
}
