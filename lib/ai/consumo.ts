// IL CONTO DI QUELLO CHE PAGHIAMO AL MODELLO (Mario, 27/10; tabella in
// 20261104150000_consumo_ai.sql). Una riga per giorno, processo, modello e
// profili di prova, sommata dopo ogni risposta.
//
// SEMPRE BEST-EFFORT, come il contatore della guardia sulla lingua
// (lib/lingua/contatoreGuardia.ts): un conto che non si scrive viene loggato e
// basta — la prima volta il contatore non blocca niente, rende visibile la
// spesa. La service-role e non il client della richiesta, per la stessa
// ragione: le chiamate arrivano da route con la sessione dello studente e dal
// cron, e un contatore che lo studente può scrivere non misura niente.
//
// `processo` è OBBLIGATORIO in tutta la catena (qui, in `chiamaJson`, in
// `chiamaEscape`), e non ha un valore predefinito: un default è il posto in cui
// un chiamante che si è dimenticato di dirlo finisce nel secchio sbagliato senza
// che niente lo dica (vedi «Un default retrocompatibile nasconde un
// collegamento mancante»). `npm run test:consumo` pretende che ogni chiamata al
// modello passi da qui.

import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { descriviErrore } from "@/lib/erroreSupabase";

/** La parte di `usage` che ci serve: è la forma che il SDK restituisce. */
export type ConsumoModello = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function argomentiConsumo(processo: string, modello: string, diProva: boolean, uso: ConsumoModello | null | undefined) {
  const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  return {
    p_processo: processo,
    p_modello: modello,
    p_di_prova: diProva,
    p_input: n(uso?.input_tokens),
    p_output: n(uso?.output_tokens),
    p_cache_scrittura: n(uso?.cache_creation_input_tokens),
    p_cache_lettura: n(uso?.cache_read_input_tokens),
  };
}

export async function registraConsumo(processo: string, modello: string, diProva: boolean, uso: ConsumoModello | null | undefined): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("registra_consumo_ai", argomentiConsumo(processo, modello, diProva, uso));
    if (error) console.error(`Consumo AI — conto non scritto (${processo}):`, descriviErrore(error));
  } catch (errore) {
    console.error(`Consumo AI — conto non scritto (${processo}, eccezione):`, errore);
  }
}
