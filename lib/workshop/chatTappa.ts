import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKSHOP_ELABORATO } from "./elaborato-config";
import { TETTO_MESSAGGI_CHAT_TAPPA } from "./config";

// Stato della chat col cliente PER LA TAPPA APERTA: quanti messaggi lo studente
// ha già mandato da quando la tappa si è aperta, quanti ne servono al minimo e
// quanti ne restano prima del tetto. Fonte di verità unica, letta sia dalla
// pagina (per il contatore e per disabilitare il campo) sia dalla route (per
// applicare il tetto davvero): due conteggi scritti a mano divergerebbero.
//
// UN TETTO PER TAPPA NON SI APPLICA MAI A UN CONTEGGIO PER ISCRIZIONE.
// Qui c'erano due guardie diverse sullo stesso oggetto: il minimo bastava la
// RIGA della tappa aperta, il filtro del conteggio voleva anche la sua DATA.
// Quando la riga non c'era, il filtro saltava e il tetto per tappa finiva
// applicato al totale dell'iscrizione — e il commento che stava qui lo
// dichiarava pure, con la faccia di una rassicurazione: «il tetto resta
// applicato».
//
// Era vero all'inizio di un workshop e diventava una bomba alla fine: alla
// quarta tappa il cumulativo ha già raggiunto il tetto per costruzione (3+3+3
// = 9, tetto 10). Il 13/09 `enoteca > giurisprudenza` si è fermato al pitch
// con UN messaggio in quella tappa e un minimo di quattro: la porta si è
// chiusa perché aveva contato tutta l'iscrizione.
//
// Se non si sa quale tappa è aperta non si sa nemmeno quale tetto applicare, e
// applicare quello sbagliato è peggio che non applicarne nessuno: chiude una
// porta che nessuno voleva chiudere. La rete vera esiste altrove ed è di un
// altro ordine di grandezza — `MAX_MESSAGGI_CHAT_CLIENTE` (30), applicata dal
// database dentro `invia_messaggio_chat_cliente`: quella non ha bisogno di
// essere imitata qui.

export type StatoChatTappa = {
  // La tappa a cui si riferisce il conteggio. `null` = non si sa quale sia
  // (progetto già consegnato, o righe non ancora inizializzate): in quel caso
  // `inviati` è il totale dell'iscrizione e NESSUNA regola per tappa si
  // applica. È il campo che impedisce di confondere di nuovo le due unità.
  faseId: string | null;
  inviati: number;
  minimo: number;
  tetto: number;
  raggiuntoMinimo: boolean;
  raggiuntoTetto: boolean;
  // La conversazione della tappa è CHIUSA: nessun altro messaggio è possibile.
  // Chiude il codice, non il modello — raggiunto il minimo il cliente ha
  // abbastanza, e glielo si fa dire con una battuta scritta (vedi la route).
  chiusa: boolean;
};

// Cosa succede SE lo studente manda un altro messaggio. Sta qui e non nella
// route perché è la stessa regola per tappa del resto del file: scritta due
// volte, la seconda dimentica il `faseId` — che è esattamente il modo in cui
// il difetto era nato.
export function esitoDelProssimoMessaggio(stato: StatoChatTappa): {
  raggiungeMinimo: boolean;
  raggiungeTetto: boolean;
} {
  const dopo = stato.inviati + 1;
  return {
    raggiungeMinimo: stato.minimo > 0 && dopo >= stato.minimo,
    raggiungeTetto: stato.faseId !== null && dopo >= stato.tetto,
  };
}

export async function getStatoChatTappa(
  supabase: SupabaseClient,
  iscrizioneId: string,
  workshopSlug: string,
  ruoloSlug: string,
): Promise<StatoChatTappa> {
  const tetto = TETTO_MESSAGGI_CHAT_TAPPA;

  const { data: apertaRiga } = await supabase
    .from("workshop_fasi_stato")
    .select("fase_id, aperta_at")
    .eq("iscrizione_id", iscrizioneId)
    .eq("stato", "aperta")
    .maybeSingle();

  // UNA SOLA CONDIZIONE per tutte e tre le cose che dipendono dalla tappa (il
  // suo id, il suo minimo, il filtro del conteggio). Prima erano due — la riga
  // per il minimo, la data per il filtro — e bastava che divergessero perché
  // il conteggio cambiasse unità senza che niente lo dicesse.
  const apertaAt = apertaRiga?.aperta_at ?? null;
  const fasi = WORKSHOP_ELABORATO[workshopSlug]?.[ruoloSlug]?.fasi;
  const fase = apertaAt ? fasi?.find((f) => f.id === apertaRiga?.fase_id) : undefined;
  const faseId = fase?.id ?? null;
  const minimo = fase?.chatMinima ?? 0;

  let query = supabase
    .from("workshop_chat_cliente")
    .select("id", { count: "exact", head: true })
    .eq("iscrizione_id", iscrizioneId)
    .eq("mittente", "studente");
  // Il conteggio resta vero anche quando la tappa non si sa: dice quanti
  // messaggi ha mandato in tutto, e il contatore a schermo non mente. Quello
  // che non si fa è confrontarlo con un tetto per tappa.
  if (apertaAt) query = query.gte("created_at", apertaAt);

  const { count } = await query;
  const inviati = count ?? 0;

  const raggiuntoMinimo = minimo > 0 && inviati >= minimo;
  const raggiuntoTetto = faseId !== null && inviati >= tetto;
  return { faseId, inviati, minimo, tetto, raggiuntoMinimo, raggiuntoTetto, chiusa: raggiuntoMinimo || raggiuntoTetto };
}
