import type { SupabaseClient } from "@supabase/supabase-js";
import { formattaDataOra } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

// I POST DEGLI ENTI SI PUBBLICANO SUBITO, E KIREO PUÒ TOGLIERLI (Mario, 29/10;
// migrazioni 20261113100000/110000/120000).
//
// ⚠️ IL TETTO NON LIMITA QUANTO UN ENTE PUÒ SCRIVERE: LIMITA QUANTE VOLTE AL
// GIORNO PUÒ INTERROMPERE LO STESSO STUDENTE (Mario). Ogni pubblicazione di un
// ente con un piano a pagamento avvisa tutti i suoi follower: è quello il
// numero che dice se 3 è giusto, non i post in Bacheca. 3 è il numero che
// l'ente leggeva già («al massimo 3 post in attesa»), con un orologio diverso.
// La regola vera sta nel database (`limite_post_nelle_24_ore`,
// `max_post_nelle_24_ore()`); questo è lo specchio per dirlo prima del gesto, e
// `npm run test:bacheca` pretende che i due numeri siano lo stesso.
export const MAX_POST_NELLE_24_ORE = 3;
const FINESTRA_MS = 24 * 60 * 60 * 1000;

/**
 * Da quando l'ente può pubblicare di nuovo, o `null` se può adesso. Contano
 * tutti i post nati nelle ultime 24 ore, anche quelli tolti, come nel
 * database: la loro notifica è già partita.
 */
export function prossimoPostDalle(creatiIl: string[], adesso: Date): Date | null {
  const recenti = creatiIl
    .map((c) => new Date(c).getTime())
    .filter((t) => adesso.getTime() - t < FINESTRA_MS)
    .sort((a, b) => b - a);
  if (recenti.length < MAX_POST_NELLE_24_ORE) return null;
  // Si libera un posto quando esce dalla finestra il più vecchio dei tre più recenti.
  return new Date(recenti[MAX_POST_NELLE_24_ORE - 1] + FINESTRA_MS);
}

// ⚠️ Testi miei e provvisori.
export const TESTI_POST = {
  intestazione: "Compaiono subito nel feed degli studenti che ti seguono. KIREO può toglierne uno che non rispetta il regolamento, e ti scrive perché.",
  tetto: `Puoi pubblicare al massimo ${MAX_POST_NELLE_24_ORE} post nelle ultime 24 ore.`,
  pubblicato: "Post pubblicato",
  pubblicatoDettaglio: "È già nel feed degli studenti che ti seguono.",
  pubblicatoConNotifica: "È già nel feed degli studenti che ti seguono, e ognuno di loro riceve una notifica.",
  bottone: "Pubblica",
  bottoneTetto: "Tetto raggiunto",
  // Il rifiuto del database, quando la pagina non sapeva ancora del tetto (un
  // altro post pubblicato da un'altra finestra): l'ora la dice la pagina, che
  // si rilegge.
  tettoDalDatabase: `Hai già pubblicato ${MAX_POST_NELLE_24_ORE} post nelle ultime 24 ore: qui sopra c'è da quando potrai pubblicare il prossimo.`,
  linkSocialSoloAPagamento: "I post con un link Instagram o TikTok sono riservati ai piani a pagamento.",
  motivoNonLetto: "Non siamo riusciti a leggere il motivo: ricarica la pagina.",
} as const;

export function testoTettoRaggiunto(dalle: Date): string {
  return `Hai pubblicato ${MAX_POST_NELLE_24_ORE} post nelle ultime 24 ore: il prossimo potrai pubblicarlo dal ${formattaDataOra(dalle)}.`;
}

// Gli stati come li legge l'ente. `approvato` e `rifiutato` sono la storia di
// prima del 29/10 (li ha guardati una persona), e restano detti così. Uno
// stato che qui non c'è si mostra col suo nome: dirlo «in approvazione» (com'era
// fino al 29/10) affermava una cosa falsa.
export const ETICHETTA_STATO_POST: Record<string, { label: string; classe: string }> = {
  pubblicato: { label: "Pubblicato", classe: "bg-kireo-green/15 text-kireo-green-light" },
  approvato: { label: "Approvato", classe: "bg-kireo-green/15 text-kireo-green-light" },
  tolto: { label: "Tolto da KIREO", classe: "bg-red-500/15 text-red-300" },
  in_approvazione: { label: "In approvazione", classe: "bg-kireo-orange/15 text-kireo-orange" },
  rifiutato: { label: "Rifiutato", classe: "bg-red-500/15 text-red-300" },
};

export function etichettaStatoPost(stato: string): { label: string; classe: string } {
  return ETICHETTA_STATO_POST[stato] ?? { label: stato, classe: "bg-white/10 text-kireo-light/80" };
}

export type MotiviPost = { motivo_rifiuto: string | null; motivo_rimozione: string | null };

/**
 * I motivi dei post chiesti, letti da `motivi_post_enti` (il client non li
 * legge dalla tabella, 20261113120000). Un id assente vuol dire «non tuo». Se
 * la lettura fallisce restituisce `null`: non letti, che non vuol dire senza
 * motivo.
 */
export async function leggiMotiviPost(supabase: SupabaseClient, ids: string[]): Promise<Map<string, MotiviPost> | null> {
  const motivi = new Map<string, MotiviPost>();
  if (ids.length === 0) return motivi;
  const { data, error } = await supabase.rpc("motivi_post_enti", { p_ids: ids });
  if (error) {
    console.error("[post] motivi_post_enti:", descriviErrore(error));
    return null;
  }
  for (const r of (data ?? []) as Array<{ post_id: string } & MotiviPost>) {
    motivi.set(r.post_id, { motivo_rifiuto: r.motivo_rifiuto, motivo_rimozione: r.motivo_rimozione });
  }
  return motivi;
}

/** La riga del motivo sotto un post, o `null` se non c'è niente da dire. */
export function rigaMotivo(stato: string, motivi: Map<string, MotiviPost> | null, id: string, toltoIl: string | null): string | null {
  if (stato !== "tolto" && stato !== "rifiutato") return null;
  if (motivi === null) return TESTI_POST.motivoNonLetto;
  const m = motivi.get(id);
  if (stato === "tolto") {
    const quando = toltoIl ? ` il ${formattaDataOra(toltoIl)}` : "";
    return m?.motivo_rimozione ? `KIREO ha tolto questo post dal feed${quando}. Motivo: ${m.motivo_rimozione}` : `KIREO ha tolto questo post dal feed${quando}.`;
  }
  return m?.motivo_rifiuto ? `Motivo del rifiuto: ${m.motivo_rifiuto}` : null;
}
