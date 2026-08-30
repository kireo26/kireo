import type { SupabaseClient } from "@supabase/supabase-js";

// QUALE ISCRIZIONE STAI GUARDANDO: una regola del prodotto, in un posto solo.
//
// PERCHÉ ESISTE. Fino al 2026-08-30 uno studente aveva al massimo UNA riga per
// workshop — lo imponeva `unique (workshop_id, student_id)` — e le pagine
// potevano fare `.eq(...).maybeSingle()` senza pensarci. Tolto quel vincolo
// (perché impediva di cambiare ruolo), le righe diventano più d'una, e
// `maybeSingle()` con due righe **non prende la prima: fallisce**. Due pagine
// su tre lo facevano ancora, e il modo in cui fallivano era il peggiore
// possibile: nessun errore, un `redirect` alla pagina di prima. Lo studente
// clicca «Vai al progetto» e torna dov'era, senza una riga nei log.
//
// Non tre `.eq("stato", …)` aggiunti a mano in tre file: la scelta è una
// REGOLA — prima l'attiva, poi la completata, poi la lasciata — e se domani si
// aggiunge uno stato si cambia qui. Tre copie della stessa regola divergono, e
// lo sappiamo per averlo già visto succedere in poche ore.
//
// La priorità è per STATO, non per data: la data decide solo fra due righe
// nello stesso stato (che l'indice unico parziale rende impossibile per
// «attivo», ma non per le altre due).

export const PRIORITA_STATI = ["attivo", "completato", "ritirato"] as const;
export type StatoIscrizione = (typeof PRIORITA_STATI)[number];

// Le pagine di LAVORO — il progetto e la chat col cliente — si aprono solo su
// un'iscrizione attiva o completata. Un'iscrizione lasciata non ci finisce
// dentro in sola lettura: la pagina del workshop la accoglie con il pannello
// che spiega che il lavoro è ancora lì e offre di riprenderlo, che è più utile
// di un editor spento senza spiegazione.
export const STATI_APRIBILI: StatoIscrizione[] = ["attivo", "completato"];

export type RigaIscrizione = { stato: string; created_at?: string | null };

// Pura, così la regola si prova senza rete (npm run test:iscrizione).
export function scegliIscrizione<T extends RigaIscrizione>(righe: T[] | null | undefined, ammessi: readonly string[] = PRIORITA_STATI): T | null {
  const candidate = (righe ?? []).filter((r) => ammessi.includes(r.stato));
  if (candidate.length === 0) return null;
  return [...candidate].sort((a, b) => {
    const perStato = PRIORITA_STATI.indexOf(a.stato as StatoIscrizione) - PRIORITA_STATI.indexOf(b.stato as StatoIscrizione);
    if (perStato !== 0) return perStato;
    return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  })[0];
}

// Un solo `select` per tutti e tre i chiamanti: è un soprainsieme di quello che
// serve a ognuno, e vale la manciata di byte in più per non avere tre forme
// diverse della stessa riga.
const COLONNE =
  "id, ruolo_id, stato, created_at, workshop_ruoli(id, slug, titolo, area_slug, descrizione)";

export type IscrizioneWorkshop = {
  id: string;
  ruolo_id: string;
  stato: string;
  created_at: string;
  workshop_ruoli: { id: string; slug: string; titolo: string; area_slug: string; descrizione: string | null } | null;
};

const unRuolo = (v: unknown) => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

// Restituisce TUTTE le righe dello studente per quel workshop, già ordinate, e
// quella scelta secondo la regola. Le pagine prendono quello che gli serve:
// `page.tsx` guarda anche lo stato per decidere cosa mostrare, le altre due
// passano `STATI_APRIBILI` e reindirizzano se non trovano niente.
export async function getIscrizioniWorkshop(
  supabase: SupabaseClient,
  workshopId: string,
  userId: string,
): Promise<IscrizioneWorkshop[]> {
  const { data, error } = await supabase
    .from("workshop_iscrizioni")
    .select(COLONNE)
    .eq("workshop_id", workshopId)
    .eq("student_id", userId)
    .order("created_at", { ascending: false });

  // L'errore si stampa: è esattamente quello che è mancato il 2026-08-31,
  // quando `maybeSingle()` falliva su due righe e nessuno guardava il motivo.
  if (error) console.error("[workshop] lettura iscrizioni:", error.message);

  return (data ?? []).map((r) => ({ ...r, workshop_ruoli: unRuolo(r.workshop_ruoli) }) as IscrizioneWorkshop);
}
