import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKSHOP_ELABORATO } from "./elaborato-config";
import { TETTO_MESSAGGI_CHAT_TAPPA } from "./config";

// Stato della chat col cliente PER LA TAPPA APERTA: quanti messaggi lo studente
// ha già mandato da quando la tappa si è aperta, quanti ne servono al minimo e
// quanti ne restano prima del tetto. Fonte di verità unica, letta sia dalla
// pagina (per il contatore e per disabilitare il campo) sia dalla route (per
// applicare il tetto davvero): due conteggi scritti a mano divergerebbero.
//
// Se non c'è nessuna tappa aperta (progetto già consegnato, o righe non ancora
// inizializzate) restituisce `minimo: 0` e conta comunque i messaggi totali —
// il tetto resta applicato, il contatore non promette nulla.

export type StatoChatTappa = {
  inviati: number;
  minimo: number;
  tetto: number;
  raggiuntoMinimo: boolean;
  raggiuntoTetto: boolean;
  // La conversazione della tappa è CHIUSA: nessun altro messaggio è possibile.
  // Chiude il codice, non il modello — raggiunto il minimo il cliente ha
  // abbastanza, e glielo si fa dire con una battuta scritta (vedi la route).
  // Il tetto resta come rete per i casi senza minimo (nessuna tappa aperta).
  chiusa: boolean;
};

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

  const fasi = WORKSHOP_ELABORATO[workshopSlug]?.[ruoloSlug]?.fasi;
  const fase = apertaRiga ? fasi?.find((f) => f.id === apertaRiga.fase_id) : undefined;
  const minimo = fase?.chatMinima ?? 0;

  let query = supabase
    .from("workshop_chat_cliente")
    .select("id", { count: "exact", head: true })
    .eq("iscrizione_id", iscrizioneId)
    .eq("mittente", "studente");
  if (apertaRiga?.aperta_at) query = query.gte("created_at", apertaRiga.aperta_at);

  const { count } = await query;
  const inviati = count ?? 0;

  const raggiuntoMinimo = minimo > 0 && inviati >= minimo;
  const raggiuntoTetto = inviati >= tetto;
  return { inviati, minimo, tetto, raggiuntoMinimo, raggiuntoTetto, chiusa: raggiuntoMinimo || raggiuntoTetto };
}
